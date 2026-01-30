/**
 * MCP Server Scanner
 *
 * Zero-dependency network scanner for discovering MCP (Model Context Protocol) servers.
 * Uses only Node.js built-in modules for maximum auditability and security.
 *
 * This module scans network endpoints for MCP servers that may be exposed without
 * authentication. It checks for both SSE (Server-Sent Events) and Streamable HTTP
 * transport protocols.
 *
 * WHAT THIS TOOL DOES:
 * - Sends HTTP GET requests to specified hosts/ports to detect MCP endpoints
 * - Checks response headers and content to identify MCP server types
 * - Reports whether endpoints require authentication
 *
 * WHAT THIS TOOL DOES NOT DO:
 * - Does not exploit any vulnerabilities
 * - Does not send data to any external servers
 * - Does not store or transmit scan results anywhere
 * - Does not attempt to bypass authentication
 * - Does not perform any denial-of-service attacks
 *
 * @license MIT
 */

import http from 'node:http';
import https from 'node:https';
import { networkInterfaces } from 'node:os';
import dns from 'node:dns/promises';

// Default ports commonly used by MCP servers
export const DEFAULT_PORTS = [3000, 3001, 3010, 3011, 8000, 8080, 8888, 9000, 9090];

// MCP endpoint paths to check
export const MCP_PATHS = [
    '/sse',
    '/mcp/sse',
    '/events',
    '/stream',
    '/mcp',
    '/'
];

/**
 * Result of scanning a single endpoint
 * @typedef {Object} ScanResult
 * @property {string} host - The hostname or IP that was scanned
 * @property {number} port - The port number
 * @property {string} url - Full URL of the endpoint
 * @property {'sse'|'streamable-http'|'unknown'} type - The detected MCP transport type
 * @property {boolean} requiresAuth - Whether the endpoint requires authentication
 * @property {Object} [serverInfo] - Optional server information if available
 * @property {string} [serverInfo.name] - Server name
 * @property {string} [serverInfo.version] - Server version
 * @property {string[]} [serverInfo.capabilities] - Server capabilities
 */

/**
 * Parse CIDR notation to get all IPs in range
 * Limited to /24 or smaller ranges to prevent accidental large scans
 *
 * @param {string} cidr - CIDR notation (e.g., "192.168.1.0/24")
 * @returns {string[]} Array of IP addresses in the range
 * @throws {Error} If CIDR prefix is larger than /24
 */
export function parseCIDR(cidr) {
    const [ip, prefixStr] = cidr.split('/');
    const prefix = parseInt(prefixStr || '32', 10);

    if (prefix < 24) {
        throw new Error('CIDR prefix must be /24 or larger (e.g., /24, /25, /32) to prevent scanning too many hosts');
    }

    const parts = ip.split('.').map(Number);
    if (parts.length !== 4 || parts.some(p => isNaN(p) || p < 0 || p > 255)) {
        throw new Error('Invalid IP address format');
    }

    const ipNum = (parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3];
    const mask = ~((1 << (32 - prefix)) - 1);
    const network = ipNum & mask;
    const broadcast = network | ~mask;

    const ips = [];
    // Start from network+1 (skip network address) and end before broadcast
    for (let i = network + 1; i < broadcast && ips.length < 256; i++) {
        ips.push([
            (i >>> 24) & 255,
            (i >>> 16) & 255,
            (i >>> 8) & 255,
            i & 255
        ].join('.'));
    }

    return ips;
}

/**
 * Get the local network range based on the machine's network interfaces
 *
 * @returns {string|null} CIDR notation of local network (e.g., "192.168.1.0/24") or null
 */
export function getLocalNetworkRange() {
    const interfaces = networkInterfaces();

    for (const name of Object.keys(interfaces)) {
        const iface = interfaces[name];
        if (!iface) continue;

        for (const info of iface) {
            // Skip internal/loopback interfaces and IPv6
            if (info.family === 'IPv4' && !info.internal) {
                const parts = info.address.split('.');
                return `${parts[0]}.${parts[1]}.${parts[2]}.0/24`;
            }
        }
    }

    return null;
}

/**
 * Resolve common subdomains for a domain
 *
 * @param {string} domain - Base domain to check
 * @returns {Promise<string[]>} Array of resolvable hostnames
 */
export async function resolveSubdomains(domain) {
    const commonSubdomains = [
        '', 'mcp', 'api', 'server', 'sse', 'stream', 'events',
        'dev', 'staging', 'prod', 'app'
    ];

    const hosts = [];

    for (const sub of commonSubdomains) {
        const hostname = sub ? `${sub}.${domain}` : domain;
        try {
            await dns.resolve4(hostname);
            hosts.push(hostname);
        } catch {
            // Subdomain doesn't resolve, skip
        }
    }

    return hosts;
}

/**
 * Make an HTTP(S) request with timeout
 *
 * @param {string} url - URL to request
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<{status: number, headers: Object, body: string}>}
 */
function httpGet(url, timeout) {
    return new Promise((resolve, reject) => {
        const parsedUrl = new URL(url);
        const client = parsedUrl.protocol === 'https:' ? https : http;

        const req = client.get(url, {
            timeout,
            headers: {
                'Accept': 'text/event-stream, application/json, */*',
                'User-Agent': 'mcp-scan/1.0'
            }
        }, (res) => {
            let body = '';

            // Limit body size to prevent memory issues
            const maxSize = 64 * 1024; // 64KB
            let size = 0;

            res.on('data', (chunk) => {
                size += chunk.length;
                if (size <= maxSize) {
                    body += chunk;
                }
            });

            res.on('end', () => {
                resolve({
                    status: res.statusCode || 0,
                    headers: res.headers,
                    body
                });
            });
        });

        req.on('error', reject);
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });
    });
}

/**
 * Check if a URL is an MCP server endpoint
 *
 * @param {string} host - Hostname or IP
 * @param {number} port - Port number
 * @param {string} path - URL path to check
 * @param {number} timeout - Request timeout in ms
 * @param {boolean} useHttps - Whether to use HTTPS
 * @returns {Promise<ScanResult|null>}
 */
export async function checkEndpoint(host, port, path, timeout, useHttps = false) {
    const protocol = useHttps ? 'https' : 'http';
    const url = `${protocol}://${host}:${port}${path}`;

    try {
        const response = await httpGet(url, timeout);

        const contentType = response.headers['content-type'] || '';
        const authHeader = response.headers['www-authenticate'];
        const requiresAuth = response.status === 401 || response.status === 403 || !!authHeader;

        let type = 'unknown';
        let serverInfo = undefined;

        // Check for SSE
        if (contentType.includes('text/event-stream')) {
            type = 'sse';
        }
        // Check for JSON-based MCP
        else if (contentType.includes('application/json')) {
            try {
                const json = JSON.parse(response.body);
                if (json.capabilities || json.protocolVersion || json.serverInfo) {
                    type = 'streamable-http';
                    serverInfo = {
                        name: json.serverInfo?.name || json.name,
                        version: json.serverInfo?.version || json.version,
                        capabilities: json.capabilities ? Object.keys(json.capabilities) : undefined
                    };
                    // Clean up undefined values
                    serverInfo = Object.fromEntries(
                        Object.entries(serverInfo).filter(([_, v]) => v !== undefined)
                    );
                    if (Object.keys(serverInfo).length === 0) serverInfo = undefined;
                } else if (json.jsonrpc || json.method || json.result) {
                    type = 'streamable-http';
                }
            } catch {
                // Not valid JSON
            }
        }

        // Only return if this looks like an MCP endpoint
        if (response.status >= 200 && response.status < 500) {
            if (type !== 'unknown' || path.includes('mcp') || path.includes('sse')) {
                return {
                    host,
                    port,
                    url,
                    type,
                    requiresAuth,
                    serverInfo
                };
            }
        }

        return null;
    } catch {
        return null;
    }
}

/**
 * Scan a single host for MCP servers
 *
 * @param {string} host - Hostname or IP to scan
 * @param {Object} options - Scan options
 * @param {number[]} [options.ports] - Ports to scan
 * @param {string[]} [options.paths] - Paths to check
 * @param {number} [options.timeout] - Request timeout in ms
 * @param {boolean} [options.https] - Use HTTPS
 * @param {function} [options.onProgress] - Progress callback
 * @returns {Promise<ScanResult[]>}
 */
export async function scanHost(host, options = {}) {
    const {
        ports = DEFAULT_PORTS,
        paths = MCP_PATHS,
        timeout = 2000,
        https: useHttps = false,
        onProgress
    } = options;

    const results = [];
    const seenPorts = new Set();

    for (const port of ports) {
        for (const path of paths) {
            if (onProgress) {
                onProgress({ host, port, path });
            }

            const result = await checkEndpoint(host, port, path, timeout, useHttps);

            if (result && !seenPorts.has(port)) {
                seenPorts.add(port);
                results.push(result);
            }
        }
    }

    return results;
}

/**
 * Parse a target string into a list of hosts to scan
 *
 * @param {string} target - Target specification (IP, CIDR, domain, or "local")
 * @returns {Promise<string[]>}
 */
export async function parseTarget(target) {
    if (!target || target === 'local') {
        const range = getLocalNetworkRange();
        if (!range) {
            throw new Error('Could not determine local network range');
        }
        return parseCIDR(range);
    }

    if (target === 'localhost') {
        return ['localhost', '127.0.0.1'];
    }

    if (target.includes('/')) {
        return parseCIDR(target);
    }

    if (target.startsWith('*.')) {
        const domain = target.slice(2);
        return resolveSubdomains(domain);
    }

    if (/^\d+\.\d+\.\d+\.\d+$/.test(target)) {
        return [target];
    }

    // Domain name
    const hosts = [target];
    try {
        const subdomains = await resolveSubdomains(target);
        return [...new Set([...hosts, ...subdomains])];
    } catch {
        return hosts;
    }
}

/**
 * Main scan function
 *
 * @param {string} target - Target to scan
 * @param {Object} options - Scan options
 * @returns {Promise<{target: string, hosts: string[], results: ScanResult[], duration: number}>}
 */
export async function scan(target, options = {}) {
    const startTime = Date.now();

    const hosts = await parseTarget(target);
    const allResults = [];

    const { concurrency = 10, ...scanOptions } = options;

    // Scan hosts with limited concurrency
    for (let i = 0; i < hosts.length; i += concurrency) {
        const batch = hosts.slice(i, i + concurrency);
        const batchResults = await Promise.all(
            batch.map(host => scanHost(host, scanOptions).catch(() => []))
        );
        allResults.push(...batchResults.flat());
    }

    return {
        target: target || 'local network',
        hosts,
        results: allResults,
        duration: Date.now() - startTime
    };
}
