#!/usr/bin/env node

/**
 * mcp-scan - CLI tool for discovering unprotected MCP servers
 *
 * This is a security auditing tool that helps identify MCP (Model Context Protocol)
 * servers that may be exposed without authentication.
 *
 * TWO SCAN MODES:
 * 1. Network scan - Probe network endpoints for running MCP servers
 * 2. Config scan - Check local AI tool config files for unprotected server definitions
 *
 * ETHICAL USE NOTICE:
 * This tool is intended for security professionals to audit their own systems.
 * Only scan networks and systems you own or have explicit permission to test.
 *
 * TRANSPARENCY:
 * - This tool does not modify any files
 * - This tool does not transmit any data externally
 * - This tool does not execute commands found in config files
 * - Use --show-paths to see exactly which files will be checked
 *
 * @license MIT
 */

import { scan, DEFAULT_PORTS } from '../src/scanner.js';
import { scanConfigFiles, summarizeResults, getCheckedPaths, CONFIG_LOCATIONS } from '../src/config-scanner.js';

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
    bgGreen: '\x1b[42m',
    bgYellow: '\x1b[43m'
};

// Detect if colors are supported
const supportsColor = process.stdout.isTTY && !process.env.NO_COLOR;
const c = (color, text) => supportsColor ? `${colors[color]}${text}${colors.reset}` : text;

const VERSION = '1.1.0';

const HELP = `
${c('bold', 'mcp-scan')} - Scan for unprotected MCP servers

${c('bold', 'USAGE')}
    mcp-scan [command] [target] [options]

${c('bold', 'COMMANDS')}
    network [target]    Scan network for running MCP servers (default)
    configs             Scan local AI tool config files
    all [target]        Run both network and config scans
    show-paths          List all config file paths that will be checked

${c('bold', 'NETWORK TARGETS')}
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
    --include-local     Include local (stdio) servers in config scan
    -j, --json          Output results as JSON
    -q, --quiet         Suppress banner and progress
    -h, --help          Show this help message
    -v, --version       Show version number

${c('bold', 'EXAMPLES')}
    ${c('dim', '# Scan localhost for running MCP servers')}
    mcp-scan localhost

    ${c('dim', '# Scan local AI tool configs for unprotected servers')}
    mcp-scan configs

    ${c('dim', '# Run both scans')}
    mcp-scan all

    ${c('dim', '# See what config files will be checked (transparency)')}
    mcp-scan show-paths

    ${c('dim', '# Scan network with custom ports')}
    mcp-scan network 192.168.1.0/24 -p 3000,8080

    ${c('dim', '# Output as JSON for scripting')}
    mcp-scan configs --json

${c('bold', 'CONFIG FILES CHECKED')}
    The config scan checks these AI tools:
    - Claude Desktop     (~/.config/claude/, ~/Library/Application Support/Claude/)
    - Cline/Roo Code     (~/.cline/, ~/.roo-cline/)
    - Continue.dev       (~/.continue/)
    - Cursor             (~/.cursor/)
    - Windsurf           (~/.windsurf/, ~/.codeium/)
    - Zed                (~/.config/zed/)
    - Generic MCP        (~/.mcp/, ~/.config/mcp/)

    Run 'mcp-scan show-paths' to see the exact paths for your system.

${c('bold', 'WHAT THIS TOOL DOES')}
    ${c('green', '✓')} Sends HTTP requests to detect MCP server endpoints
    ${c('green', '✓')} Reads local config files to find MCP server definitions
    ${c('green', '✓')} Reports if servers/configs lack authentication

${c('bold', 'WHAT THIS TOOL DOES NOT DO')}
    ${c('red', '✗')} Does not modify any files (read-only)
    ${c('red', '✗')} Does not execute commands from config files
    ${c('red', '✗')} Does not send data to external servers
    ${c('red', '✗')} Does not exploit any vulnerabilities

${c('bold', 'ETHICAL USE')}
    Only scan networks and systems you own or have explicit permission to test.

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
 * Parse command line arguments
 */
function parseArgs(args) {
    const options = {
        command: 'network',  // default command
        target: null,
        ports: DEFAULT_PORTS,
        timeout: 2000,
        https: false,
        includeLocal: false,
        json: false,
        quiet: false,
        help: false,
        version: false
    };

    let i = 0;

    // Check for command as first argument
    if (args.length > 0 && !args[0].startsWith('-')) {
        const cmd = args[0].toLowerCase();
        if (['network', 'configs', 'config', 'all', 'show-paths', 'showpaths'].includes(cmd)) {
            options.command = cmd === 'config' ? 'configs' : cmd === 'showpaths' ? 'show-paths' : cmd;
            i = 1;
        }
    }

    for (; i < args.length; i++) {
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
        } else if (arg === '--include-local') {
            options.includeLocal = true;
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
 * Format a network scan result for display
 */
function formatNetworkResult(result, index) {
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
    Type: ${c(typeColors[result.type] || 'dim', typeLabels[result.type] || result.type)}
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
 * Format a config scan result for display
 */
function formatConfigServer(server, index) {
    const typeColors = {
        'sse': 'magenta',
        'http': 'blue',
        'stdio': 'dim'
    };

    const authIcon = server.hasAuth
        ? c('green', '🔒 Auth configured')
        : c('red', '⚠️  NO AUTH');

    let output = `
${c('bold', `[${index + 1}]`)} ${c('cyan', server.name)}`;

    if (server.url) {
        output += `\n    URL: ${server.url}`;
    } else if (server.command) {
        output += `\n    Command: ${server.command}`;
    }

    output += `\n    Type: ${c(typeColors[server.type] || 'dim', server.type.toUpperCase())}`;
    output += `\n    Auth: ${authIcon}`;

    if (server.hasAuth && server.authIndicators?.length) {
        output += `\n    Auth indicators: ${c('dim', server.authIndicators.join(', '))}`;
    }

    output += `\n    Tool: ${c('dim', server.tool)}`;
    output += `\n    Config: ${c('dim', server.configPath)}`;

    return output;
}

/**
 * Show all config paths that will be checked
 */
function showPaths(options) {
    const paths = getCheckedPaths();

    if (options.json) {
        console.log(JSON.stringify({ configPaths: paths }, null, 2));
        return;
    }

    if (!options.quiet) {
        console.log(BANNER);
    }

    console.log(c('bold', '═══════════════════════════════════════════════════════════════'));
    console.log(c('bold', 'CONFIG FILE PATHS'));
    console.log(c('bold', '═══════════════════════════════════════════════════════════════'));
    console.log('');
    console.log(c('dim', 'These are the exact file paths that will be checked on your system.'));
    console.log(c('dim', 'Files that don\'t exist are silently skipped.'));
    console.log('');

    let currentTool = '';
    for (const { tool, description, path } of paths) {
        if (tool !== currentTool) {
            console.log('');
            console.log(c('bold', `${tool}`));
            console.log(c('dim', `  ${description}`));
            currentTool = tool;
        }
        console.log(`  ${c('cyan', path)}`);
    }

    console.log('');
    console.log(c('dim', '───────────────────────────────────────────────────────────────'));
    console.log(c('dim', 'This tool ONLY reads these files. It does not modify them.'));
    console.log(c('dim', 'It does not execute any commands found in these files.'));
    console.log(c('dim', 'It does not transmit any file contents anywhere.'));
    console.log('');
}

/**
 * Run config file scan
 */
async function runConfigScan(options) {
    if (!options.quiet && !options.json) {
        console.log(c('bold', '═══════════════════════════════════════════════════════════════'));
        console.log(c('bold', 'CONFIG FILE SCAN'));
        console.log(c('bold', '═══════════════════════════════════════════════════════════════'));
        console.log('');
        console.log(c('dim', 'Checking local AI tool configuration files...'));
        console.log(c('dim', 'Run "mcp-scan show-paths" to see exactly which files are checked.'));
        console.log('');
    }

    const configResults = scanConfigFiles({
        includeStdio: options.includeLocal
    });

    const summary = summarizeResults(configResults);

    if (options.json) {
        return {
            configScan: {
                filesChecked: configResults.filter(r => r.exists).map(r => ({
                    tool: r.tool,
                    path: r.configPath,
                    serversFound: r.servers.length,
                    error: r.error
                })),
                servers: {
                    total: summary.total,
                    unprotected: summary.unprotected,
                    protected: summary.protected
                }
            }
        };
    }

    // Show files that were found
    const foundFiles = configResults.filter(r => r.exists);
    if (foundFiles.length > 0) {
        console.log(c('bold', 'Config files found:'));
        for (const result of foundFiles) {
            const serverCount = result.servers.length;
            const icon = result.error ? c('yellow', '⚠') : c('green', '✓');
            console.log(`  ${icon} ${result.tool}: ${c('dim', result.configPath)}`);
            if (result.error) {
                console.log(`      ${c('yellow', result.error)}`);
            } else if (serverCount > 0) {
                console.log(`      ${serverCount} remote MCP server(s) configured`);
            }
        }
        console.log('');
    } else {
        console.log(c('dim', 'No MCP configuration files found.'));
        console.log('');
    }

    // Show results
    if (summary.total === 0) {
        console.log(c('green', '✓ No remote MCP servers configured in local config files.'));
        if (!options.includeLocal) {
            console.log(c('dim', '  (Use --include-local to also show local/stdio servers)'));
        }
    } else {
        console.log(`${c('bold', 'Remote MCP servers configured:')} ${summary.total}`);

        if (summary.unprotected.length > 0) {
            console.log('');
            console.log(c('bgRed', c('white', c('bold', ` ⚠️  ${summary.unprotected.length} SERVER(S) WITHOUT AUTH CONFIGURED `))));
            console.log('');
            console.log(c('yellow', 'These MCP server configurations do not appear to have authentication.'));
            console.log(c('yellow', 'If these servers are network-accessible, they may be vulnerable.'));

            summary.unprotected.forEach((s, i) => console.log(formatConfigServer(s, i)));
        }

        if (summary.protected.length > 0) {
            console.log('');
            console.log(c('bgGreen', c('white', c('bold', ` ✓ ${summary.protected.length} SERVER(S) WITH AUTH `))));
            summary.protected.forEach((s, i) => console.log(formatConfigServer(s, i)));
        }
    }

    return {
        unprotectedCount: summary.unprotected.length,
        summary
    };
}

/**
 * Run network scan
 */
async function runNetworkScan(options) {
    const target = options.target || 'localhost';

    if (!options.quiet && !options.json) {
        console.log(c('bold', '═══════════════════════════════════════════════════════════════'));
        console.log(c('bold', 'NETWORK SCAN'));
        console.log(c('bold', '═══════════════════════════════════════════════════════════════'));
        console.log('');
        console.log(`${c('bold', 'Target:')} ${target}`);
        console.log(`${c('bold', 'Ports:')} ${options.ports.join(', ')}`);
        console.log(`${c('bold', 'Timeout:')} ${options.timeout}ms`);
        console.log(`${c('bold', 'Protocol:')} ${options.https ? 'HTTPS' : 'HTTP'}`);
        console.log('');
        console.log(c('dim', 'Scanning...'));
    }

    const result = await scan(target, {
        ports: options.ports,
        timeout: options.timeout,
        https: options.https
    });

    if (options.json) {
        return { networkScan: result };
    }

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

        unprotected.forEach((r, i) => console.log(formatNetworkResult(r, i)));
    }

    if (protected_.length > 0) {
        console.log('');
        console.log(c('bgGreen', c('white', c('bold', ` ✓ ${protected_.length} PROTECTED SERVER(S) `))));
        protected_.forEach((r, i) => console.log(formatNetworkResult(r, i)));
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

    return {
        unprotectedCount: unprotected.length,
        result
    };
}

/**
 * Print protection advice
 */
function printProtectionAdvice() {
    console.log('');
    console.log(c('bold', '───────────────────────────────────────────────────────────────'));
    console.log(c('bold', 'HOW TO PROTECT YOUR MCP SERVERS'));
    console.log(c('bold', '───────────────────────────────────────────────────────────────'));
    console.log('');
    console.log('1. Add authentication to your MCP server configuration');
    console.log('2. Use a reverse proxy with auth (nginx, Caddy, etc.)');
    console.log('3. Bind servers to localhost only (127.0.0.1)');
    console.log('4. Use firewall rules to restrict access');
    console.log('5. Set auth tokens/API keys in your AI tool configs');
    console.log('');
    console.log(c('cyan', 'For managed MCP security, visit: https://contextmesh.com'));
    console.log('');
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

    try {
        let totalUnprotected = 0;
        let jsonOutput = {};

        // Handle show-paths command
        if (options.command === 'show-paths') {
            showPaths(options);
            process.exit(0);
        }

        // Handle configs command
        if (options.command === 'configs' || options.command === 'all') {
            const result = await runConfigScan(options);
            if (options.json) {
                jsonOutput = { ...jsonOutput, ...result };
            } else {
                totalUnprotected += result.unprotectedCount;
            }
        }

        // Handle network command
        if (options.command === 'network' || options.command === 'all') {
            if (options.command === 'all' && !options.json) {
                console.log('');
            }
            const result = await runNetworkScan(options);
            if (options.json) {
                jsonOutput = { ...jsonOutput, ...result };
            } else {
                totalUnprotected += result.unprotectedCount;
            }
        }

        // Output JSON if requested
        if (options.json) {
            console.log(JSON.stringify(jsonOutput, null, 2));
            const networkUnprotected = jsonOutput.networkScan?.results?.filter(r => !r.requiresAuth)?.length || 0;
            const configUnprotected = jsonOutput.configScan?.servers?.unprotected?.length || 0;
            process.exit((networkUnprotected + configUnprotected) > 0 ? 1 : 0);
        }

        // Print protection advice if any unprotected servers found
        if (totalUnprotected > 0) {
            printProtectionAdvice();
        }

        console.log('');

        // Exit with code 1 if unprotected servers found (useful for CI/CD)
        process.exit(totalUnprotected > 0 ? 1 : 0);

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
