#!/usr/bin/env node

/**
 * mcp-scan - CLI tool for discovering unprotected MCP servers
 *
 * This is a security auditing tool that scans networks for MCP (Model Context Protocol)
 * servers that may be exposed without authentication.
 *
 * Usage: mcp-scan [target] [options]
 *
 * ETHICAL USE NOTICE:
 * This tool is intended for security professionals to audit their own networks.
 * Only scan networks and systems you own or have explicit permission to test.
 *
 * @license MIT
 */

import { scan, DEFAULT_PORTS, MCP_PATHS, getLocalNetworkRange } from '../src/scanner.js';

// ANSI color codes (no dependencies needed)
const colors = {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    dim: '\x1b[2m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    bgRed: '\x1b[41m',
    bgGreen: '\x1b[42m'
};

// Detect if colors are supported
const supportsColor = process.stdout.isTTY && !process.env.NO_COLOR;
const c = (color, text) => supportsColor ? `${colors[color]}${text}${colors.reset}` : text;

const VERSION = '1.0.0';
const HELP = `
${c('bold', 'mcp-scan')} - Scan for unprotected MCP servers

${c('bold', 'USAGE')}
    mcp-scan [target] [options]

${c('bold', 'TARGETS')}
    localhost           Scan localhost only (fastest)
    local               Scan local network (/24 range)
    192.168.1.100       Scan a single IP address
    192.168.1.0/24      Scan a CIDR range (max /24)
    example.com         Scan a domain and common subdomains
    *.example.com       Scan subdomains of a domain

${c('bold', 'OPTIONS')}
    -p, --ports <list>  Ports to scan (comma-separated)
                        Default: ${DEFAULT_PORTS.join(',')}
    -t, --timeout <ms>  Request timeout in milliseconds
                        Default: 2000
    --https             Use HTTPS instead of HTTP
    -j, --json          Output results as JSON
    -q, --quiet         Suppress banner and progress
    -h, --help          Show this help message
    -v, --version       Show version number

${c('bold', 'EXAMPLES')}
    ${c('dim', '# Quick scan of localhost')}
    mcp-scan localhost

    ${c('dim', '# Scan local network')}
    mcp-scan local

    ${c('dim', '# Scan specific IP with custom ports')}
    mcp-scan 192.168.1.100 -p 3000,8080,9000

    ${c('dim', '# Scan domain and output JSON')}
    mcp-scan api.example.com --json

${c('bold', 'WHAT THIS TOOL DOES')}
    - Sends HTTP requests to detect MCP server endpoints
    - Checks for SSE and Streamable HTTP transport types
    - Reports if endpoints require authentication

${c('bold', 'WHAT THIS TOOL DOES NOT DO')}
    - Does not exploit any vulnerabilities
    - Does not send data to external servers
    - Does not attempt to bypass authentication
    - Does not perform any attacks

${c('bold', 'ETHICAL USE')}
    Only scan networks and systems you own or have explicit permission to test.
    Unauthorized network scanning may violate laws and regulations.

${c('bold', 'MORE INFO')}
    https://github.com/oidebrett/context-mesh
`;

const BANNER = `
${c('cyan', '╔═══════════════════════════════════════════════════════════════╗')}
${c('cyan', '║')}  ${c('bold', 'mcp-scan')} v${VERSION}                                             ${c('cyan', '║')}
${c('cyan', '║')}  Scan for unprotected MCP (Model Context Protocol) servers    ${c('cyan', '║')}
${c('cyan', '╚═══════════════════════════════════════════════════════════════╝')}
`;

/**
 * Parse command line arguments (no dependencies)
 */
function parseArgs(args) {
    const options = {
        target: null,
        ports: DEFAULT_PORTS,
        timeout: 2000,
        https: false,
        json: false,
        quiet: false,
        help: false,
        version: false
    };

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];

        if (arg === '-h' || arg === '--help') {
            options.help = true;
        } else if (arg === '-v' || arg === '--version') {
            options.version = true;
        } else if (arg === '-j' || arg === '--json') {
            options.json = true;
        } else if (arg === '-q' || arg === '--quiet') {
            options.quiet = true;
        } else if (arg === '--https') {
            options.https = true;
        } else if (arg === '-p' || arg === '--ports') {
            const portsStr = args[++i];
            if (!portsStr) {
                console.error(c('red', 'Error: --ports requires a value'));
                process.exit(1);
            }
            options.ports = portsStr.split(',').map(p => parseInt(p.trim(), 10)).filter(p => !isNaN(p));
        } else if (arg === '-t' || arg === '--timeout') {
            const timeoutStr = args[++i];
            if (!timeoutStr) {
                console.error(c('red', 'Error: --timeout requires a value'));
                process.exit(1);
            }
            options.timeout = parseInt(timeoutStr, 10);
        } else if (!arg.startsWith('-')) {
            options.target = arg;
        } else {
            console.error(c('red', `Error: Unknown option: ${arg}`));
            console.error(`Run 'mcp-scan --help' for usage`);
            process.exit(1);
        }
    }

    return options;
}

/**
 * Format a scan result for display
 */
function formatResult(result, index) {
    const typeColors = {
        'sse': 'magenta',
        'streamable-http': 'blue',
        'unknown': 'dim'
    };

    const typeLabels = {
        'sse': 'SSE',
        'streamable-http': 'HTTP',
        'unknown': '???'
    };

    const authIcon = result.requiresAuth
        ? c('green', '🔒 Protected')
        : c('red', '⚠️  UNPROTECTED');

    let output = `
${c('bold', `[${index + 1}]`)} ${c('cyan', result.url)}
    Type: ${c(typeColors[result.type], typeLabels[result.type])}
    Auth: ${authIcon}`;

    if (result.serverInfo) {
        if (result.serverInfo.name) {
            output += `\n    Name: ${result.serverInfo.name}`;
        }
        if (result.serverInfo.version) {
            output += `\n    Version: ${result.serverInfo.version}`;
        }
        if (result.serverInfo.capabilities?.length) {
            output += `\n    Capabilities: ${result.serverInfo.capabilities.join(', ')}`;
        }
    }

    return output;
}

/**
 * Main function
 */
async function main() {
    const args = process.argv.slice(2);
    const options = parseArgs(args);

    if (options.help) {
        console.log(HELP);
        process.exit(0);
    }

    if (options.version) {
        console.log(VERSION);
        process.exit(0);
    }

    if (!options.quiet && !options.json) {
        console.log(BANNER);
    }

    const target = options.target || 'localhost';

    if (!options.quiet && !options.json) {
        console.log(`${c('bold', 'Target:')} ${target}`);
        console.log(`${c('bold', 'Ports:')} ${options.ports.join(', ')}`);
        console.log(`${c('bold', 'Timeout:')} ${options.timeout}ms`);
        console.log(`${c('bold', 'Protocol:')} ${options.https ? 'HTTPS' : 'HTTP'}`);
        console.log('');
        console.log(c('dim', 'Scanning...'));
    }

    try {
        const result = await scan(target, {
            ports: options.ports,
            timeout: options.timeout,
            https: options.https
        });

        if (options.json) {
            console.log(JSON.stringify(result, null, 2));
            process.exit(0);
        }

        console.log('');
        console.log(c('bold', '═══════════════════════════════════════════════════════════════'));
        console.log(c('bold', 'SCAN RESULTS'));
        console.log(c('bold', '═══════════════════════════════════════════════════════════════'));
        console.log('');
        console.log(`${c('bold', 'Hosts scanned:')} ${result.hosts.length}`);
        console.log(`${c('bold', 'Scan duration:')} ${(result.duration / 1000).toFixed(2)}s`);
        console.log(`${c('bold', 'MCP servers found:')} ${result.results.length}`);

        const unprotected = result.results.filter(r => !r.requiresAuth);
        const protected_ = result.results.filter(r => r.requiresAuth);

        if (unprotected.length > 0) {
            console.log('');
            console.log(c('bgRed', c('white', c('bold', ` ⚠️  ${unprotected.length} UNPROTECTED SERVER(S) FOUND `))));
            console.log('');
            console.log(c('yellow', 'These MCP servers are accessible without authentication.'));
            console.log(c('yellow', 'Anyone on the network can connect to them.'));

            unprotected.forEach((r, i) => console.log(formatResult(r, i)));

            console.log('');
            console.log(c('bold', '───────────────────────────────────────────────────────────────'));
            console.log(c('bold', 'HOW TO PROTECT YOUR MCP SERVERS'));
            console.log(c('bold', '───────────────────────────────────────────────────────────────'));
            console.log('');
            console.log('1. Add authentication to your MCP server configuration');
            console.log('2. Use a reverse proxy with auth (nginx, Caddy, etc.)');
            console.log('3. Bind servers to localhost only (127.0.0.1)');
            console.log('4. Use firewall rules to restrict access');
            console.log('');
            console.log(c('cyan', 'For managed MCP security, visit: https://contextmesh.com'));
            console.log('');
        }

        if (protected_.length > 0) {
            console.log('');
            console.log(c('bgGreen', c('white', c('bold', ` ✓ ${protected_.length} PROTECTED SERVER(S) `))));
            protected_.forEach((r, i) => console.log(formatResult(r, i)));
        }

        if (result.results.length === 0) {
            console.log('');
            console.log(c('green', '✓ No MCP servers found on the scanned targets.'));
            console.log('');
            console.log(c('dim', 'This could mean:'));
            console.log(c('dim', '  - No MCP servers are running'));
            console.log(c('dim', '  - Servers are on different ports (use -p to specify)'));
            console.log(c('dim', '  - Servers are behind a firewall'));
            console.log(c('dim', '  - Servers are using HTTPS (use --https)'));
        }

        console.log('');

        // Exit with code 1 if unprotected servers found (useful for CI/CD)
        process.exit(unprotected.length > 0 ? 1 : 0);

    } catch (error) {
        if (options.json) {
            console.log(JSON.stringify({ error: error.message }));
        } else {
            console.error('');
            console.error(c('red', `Error: ${error.message}`));
        }
        process.exit(2);
    }
}

main();
