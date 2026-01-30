import type { FastifyRequest, FastifyReply } from 'fastify';
import dns from 'dns/promises';
import { networkInterfaces } from 'os';

interface ScanRequest {
    target: string; // IP range (192.168.1.0/24), domain (example.com), or subdomain pattern (*.example.com)
    ports?: number[];
    timeout?: number;
}

interface DiscoveredServer {
    host: string;
    port: number;
    url: string;
    type: 'sse' | 'streamable-http' | 'unknown';
    requiresAuth: boolean;
    serverInfo?: {
        name?: string;
        version?: string;
        capabilities?: string[];
    };
    discoveredAt: string;
}

interface ScanResult {
    target: string;
    scannedHosts: number;
    discoveredServers: DiscoveredServer[];
    scanDuration: number;
    errors: string[];
}

// Common MCP server ports to scan
const DEFAULT_PORTS = [3000, 3001, 3010, 3011, 8000, 8080, 8888, 9000, 9090];

// MCP endpoint paths to check
const MCP_PATHS = [
    '/sse',           // SSE endpoint
    '/mcp/sse',       // SSE under /mcp
    '/events',        // Events endpoint
    '/stream',        // Stream endpoint
    '/mcp',           // Root MCP endpoint (streamable HTTP)
    '/',              // Root (some servers expose MCP at root)
];

/**
 * Parse CIDR notation to get all IPs in range
 */
function parseCIDR(cidr: string): string[] {
    const [ip, prefixStr] = cidr.split('/');
    const prefix = parseInt(prefixStr || '32', 10);

    if (prefix < 24) {
        // Limit to /24 to prevent scanning too many IPs
        throw new Error('CIDR prefix must be /24 or larger for safety');
    }

    const parts = ip.split('.').map(Number);
    const ipNum = (parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3];
    const mask = ~((1 << (32 - prefix)) - 1);
    const network = ipNum & mask;
    const broadcast = network | ~mask;

    const ips: string[] = [];
    for (let i = network + 1; i < broadcast && ips.length < 256; i++) {
        ips.push([
            (i >> 24) & 255,
            (i >> 16) & 255,
            (i >> 8) & 255,
            i & 255
        ].join('.'));
    }

    return ips;
}

/**
 * Get local network range based on the machine's network interfaces
 */
function getLocalNetworkRange(): string | null {
    const interfaces = networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        const iface = interfaces[name];
        if (!iface) continue;

        for (const info of iface) {
            if (info.family === 'IPv4' && !info.internal) {
                // Return the /24 network for this interface
                const parts = info.address.split('.');
                return `${parts[0]}.${parts[1]}.${parts[2]}.0/24`;
            }
        }
    }
    return null;
}

/**
 * Resolve subdomains for a domain
 */
async function resolveSubdomains(domain: string): Promise<string[]> {
    const commonSubdomains = [
        '', 'mcp', 'api', 'server', 'sse', 'stream', 'events',
        'dev', 'staging', 'prod', 'app', 'localhost'
    ];

    const hosts: string[] = [];

    for (const sub of commonSubdomains) {
        const hostname = sub ? `${sub}.${domain}` : domain;
        try {
            const addresses = await dns.resolve4(hostname);
            if (addresses.length > 0) {
                hosts.push(hostname);
            }
        } catch {
            // Subdomain doesn't exist, skip
        }
    }

    return hosts;
}

/**
 * Check if a URL is an MCP server
 */
async function checkMCPEndpoint(
    host: string,
    port: number,
    path: string,
    timeout: number
): Promise<DiscoveredServer | null> {
    const url = `http://${host}:${port}${path}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
        // First, try a HEAD/GET request to see if the endpoint exists
        const response = await fetch(url, {
            method: 'GET',
            signal: controller.signal,
            headers: {
                'Accept': 'text/event-stream, application/json, */*',
            },
        });

        clearTimeout(timeoutId);

        const contentType = response.headers.get('content-type') || '';
        const authHeader = response.headers.get('www-authenticate');
        const requiresAuth = response.status === 401 || response.status === 403 || !!authHeader;

        // Check if this looks like an MCP server
        let type: 'sse' | 'streamable-http' | 'unknown' = 'unknown';
        let serverInfo: DiscoveredServer['serverInfo'] = {};

        if (contentType.includes('text/event-stream')) {
            type = 'sse';
        } else if (contentType.includes('application/json')) {
            // Try to parse response for MCP capabilities
            try {
                const text = await response.text();
                const json = JSON.parse(text);
                if (json.capabilities || json.protocolVersion || json.serverInfo) {
                    type = 'streamable-http';
                    serverInfo = {
                        name: json.serverInfo?.name || json.name,
                        version: json.serverInfo?.version || json.version,
                        capabilities: json.capabilities ? Object.keys(json.capabilities) : undefined,
                    };
                } else if (json.jsonrpc || json.method || json.result) {
                    // Looks like JSON-RPC which MCP uses
                    type = 'streamable-http';
                }
            } catch {
                // Not valid JSON, might still be MCP
            }
        }

        // Accept connection header check for SSE
        const connectionHeader = response.headers.get('connection');
        if (connectionHeader?.toLowerCase() === 'keep-alive' && path.includes('sse')) {
            type = 'sse';
        }

        // Only return if we found something that looks like MCP or if the endpoint exists
        if (response.ok || response.status === 401 || response.status === 403) {
            // For SSE endpoints, they usually stay open, so a response is a good sign
            if (type !== 'unknown' || (response.ok && (path.includes('mcp') || path.includes('sse')))) {
                return {
                    host,
                    port,
                    url,
                    type,
                    requiresAuth,
                    serverInfo: Object.keys(serverInfo).length > 0 ? serverInfo : undefined,
                    discoveredAt: new Date().toISOString(),
                };
            }
        }

        return null;
    } catch (error: any) {
        clearTimeout(timeoutId);
        // Connection refused or timeout means no server
        return null;
    }
}

/**
 * Scan a single host for MCP servers
 */
async function scanHost(
    host: string,
    ports: number[],
    timeout: number
): Promise<DiscoveredServer[]> {
    const discovered: DiscoveredServer[] = [];
    const seenUrls = new Set<string>();

    // Scan all ports and paths in parallel (with some limiting)
    const promises: Promise<DiscoveredServer | null>[] = [];

    for (const port of ports) {
        for (const path of MCP_PATHS) {
            promises.push(checkMCPEndpoint(host, port, path, timeout));
        }
    }

    const results = await Promise.all(promises);

    for (const result of results) {
        if (result && !seenUrls.has(`${result.host}:${result.port}`)) {
            seenUrls.add(`${result.host}:${result.port}`);
            discovered.push(result);
        }
    }

    return discovered;
}

/**
 * Main scan endpoint handler
 */
export async function scanMCPServers(
    request: FastifyRequest<{ Body: ScanRequest }>,
    reply: FastifyReply
): Promise<ScanResult> {
    const startTime = Date.now();
    const { target, ports = DEFAULT_PORTS, timeout = 2000 } = request.body;

    const errors: string[] = [];
    let hosts: string[] = [];

    try {
        if (!target || target === 'local') {
            // Scan local network
            const localRange = getLocalNetworkRange();
            if (!localRange) {
                throw new Error('Could not determine local network range');
            }
            hosts = parseCIDR(localRange);
        } else if (target.includes('/')) {
            // CIDR notation
            hosts = parseCIDR(target);
        } else if (target.startsWith('*.')) {
            // Subdomain wildcard
            const domain = target.slice(2);
            hosts = await resolveSubdomains(domain);
        } else if (/^\d+\.\d+\.\d+\.\d+$/.test(target)) {
            // Single IP
            hosts = [target];
        } else {
            // Domain name - resolve and also check subdomains
            try {
                const addresses = await dns.resolve4(target);
                hosts = [target, ...addresses];
            } catch {
                hosts = [target];
            }
            // Also check common subdomains
            const subdomainHosts = await resolveSubdomains(target);
            hosts = [...new Set([...hosts, ...subdomainHosts])];
        }
    } catch (error: any) {
        errors.push(`Failed to parse target: ${error.message}`);
        return {
            target,
            scannedHosts: 0,
            discoveredServers: [],
            scanDuration: Date.now() - startTime,
            errors,
        };
    }

    // Limit concurrent scans to avoid overwhelming the network
    const BATCH_SIZE = 10;
    const allDiscovered: DiscoveredServer[] = [];

    for (let i = 0; i < hosts.length; i += BATCH_SIZE) {
        const batch = hosts.slice(i, i + BATCH_SIZE);
        const batchResults = await Promise.all(
            batch.map(host => scanHost(host, ports, timeout).catch(err => {
                errors.push(`Error scanning ${host}: ${err.message}`);
                return [];
            }))
        );

        for (const results of batchResults) {
            allDiscovered.push(...results);
        }
    }

    // Sort by whether they require auth (unprotected first)
    allDiscovered.sort((a, b) => {
        if (a.requiresAuth === b.requiresAuth) return 0;
        return a.requiresAuth ? 1 : -1;
    });

    return {
        target: target || 'local network',
        scannedHosts: hosts.length,
        discoveredServers: allDiscovered,
        scanDuration: Date.now() - startTime,
        errors,
    };
}

/**
 * Quick scan endpoint - just scans localhost and common ports
 */
export async function quickScanMCPServers(
    _request: FastifyRequest,
    _reply: FastifyReply
): Promise<ScanResult> {
    const startTime = Date.now();
    const hosts = ['localhost', '127.0.0.1'];
    const ports = DEFAULT_PORTS;
    const timeout = 1500;

    const allDiscovered: DiscoveredServer[] = [];

    for (const host of hosts) {
        const results = await scanHost(host, ports, timeout);
        allDiscovered.push(...results);
    }

    // Dedupe by URL
    const seen = new Set<string>();
    const deduped = allDiscovered.filter(server => {
        if (seen.has(server.url)) return false;
        seen.add(server.url);
        return true;
    });

    return {
        target: 'localhost',
        scannedHosts: hosts.length,
        discoveredServers: deduped,
        scanDuration: Date.now() - startTime,
        errors: [],
    };
}
