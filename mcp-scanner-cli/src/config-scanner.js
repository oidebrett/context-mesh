/**
 * MCP Configuration File Scanner
 *
 * Scans local configuration files used by AI agents/tools to store MCP server settings.
 * Checks if configured servers have authentication enabled.
 *
 * WHAT THIS MODULE DOES:
 * - Reads JSON configuration files from known locations
 * - Parses MCP server configurations
 * - Checks for presence of authentication settings
 * - Reports servers that appear to lack authentication
 *
 * WHAT THIS MODULE DOES NOT DO:
 * - Does not modify any files (read-only)
 * - Does not execute any configured commands
 * - Does not connect to any configured servers
 * - Does not transmit file contents anywhere
 * - Does not store or cache any data
 * - Does not read environment variables referenced in configs
 *
 * TRANSPARENCY:
 * The exact file paths checked are listed in CONFIG_LOCATIONS below.
 * You can verify this module only uses fs.readFileSync and path operations.
 *
 * @license MIT
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

/**
 * Known MCP configuration file locations
 *
 * Each entry specifies:
 * - tool: Name of the AI tool/agent
 * - paths: Array of possible config file paths (relative to home directory unless absolute)
 * - parser: Function to extract MCP servers from the config structure
 *
 * To add support for a new tool, add an entry here.
 */
export const CONFIG_LOCATIONS = [
    {
        tool: 'Claude Desktop',
        description: 'Anthropic Claude desktop application',
        paths: [
            // macOS
            'Library/Application Support/Claude/claude_desktop_config.json',
            // Windows (handled specially)
            'AppData/Roaming/Claude/claude_desktop_config.json',
            // Linux
            '.config/claude/claude_desktop_config.json',
            '.config/Claude/claude_desktop_config.json',
        ],
        parser: parseClaudeDesktopConfig
    },
    {
        tool: 'Cline',
        description: 'Cline VS Code extension (formerly Claude Dev)',
        paths: [
            '.cline/mcp_settings.json',
            '.config/cline/mcp_settings.json',
            // VS Code settings location
            '.vscode/cline_mcp_settings.json',
        ],
        parser: parseClineConfig
    },
    {
        tool: 'Roo Code',
        description: 'Roo Code / Roo Cline VS Code extension',
        paths: [
            '.roo-cline/mcp_settings.json',
            '.config/roo-cline/mcp_settings.json',
            '.roo/mcp_settings.json',
        ],
        parser: parseClineConfig  // Same format as Cline
    },
    {
        tool: 'Continue',
        description: 'Continue.dev VS Code/JetBrains extension',
        paths: [
            '.continue/config.json',
            '.config/continue/config.json',
        ],
        parser: parseContinueConfig
    },
    {
        tool: 'Cursor',
        description: 'Cursor AI code editor',
        paths: [
            '.cursor/mcp.json',
            '.config/cursor/mcp.json',
            'Library/Application Support/Cursor/mcp.json',
            'AppData/Roaming/Cursor/mcp.json',
        ],
        parser: parseClaudeDesktopConfig  // Similar format
    },
    {
        tool: 'Windsurf',
        description: 'Windsurf AI code editor (Codeium)',
        paths: [
            '.windsurf/mcp.json',
            '.codeium/windsurf/mcp.json',
            '.config/windsurf/mcp.json',
        ],
        parser: parseClaudeDesktopConfig
    },
    {
        tool: 'Zed',
        description: 'Zed code editor',
        paths: [
            '.config/zed/settings.json',
            'Library/Application Support/Zed/settings.json',
        ],
        parser: parseZedConfig
    },
    {
        tool: 'Generic MCP',
        description: 'Generic MCP configuration locations',
        paths: [
            '.mcp/config.json',
            '.mcp/servers.json',
            '.config/mcp/config.json',
            '.config/mcp/servers.json',
            'mcp.json',
            '.mcp.json',
        ],
        parser: parseGenericMCPConfig
    }
];

/**
 * Result of scanning a configuration file
 * @typedef {Object} ConfigScanResult
 * @property {string} tool - Name of the tool
 * @property {string} configPath - Full path to the config file
 * @property {boolean} exists - Whether the file was found
 * @property {McpServerConfig[]} servers - Array of server configurations found
 * @property {string} [error] - Error message if parsing failed
 */

/**
 * MCP server configuration extracted from a config file
 * @typedef {Object} McpServerConfig
 * @property {string} name - Server name/identifier
 * @property {string} type - Transport type: 'stdio', 'sse', 'http'
 * @property {string} [command] - Command for stdio servers
 * @property {string} [url] - URL for SSE/HTTP servers
 * @property {boolean} hasAuth - Whether authentication appears to be configured
 * @property {string[]} authIndicators - What auth settings were detected
 * @property {boolean} isRemote - Whether this is a remote (network) server
 */

/**
 * Parse Claude Desktop configuration format
 * Format: { "mcpServers": { "name": { "command": "...", "args": [...], "env": {...} } } }
 */
function parseClaudeDesktopConfig(config) {
    const servers = [];
    const mcpServers = config.mcpServers || config.mcp_servers || {};

    for (const [name, serverConfig] of Object.entries(mcpServers)) {
        if (!serverConfig || typeof serverConfig !== 'object') continue;

        const server = analyzeServerConfig(name, serverConfig);
        servers.push(server);
    }

    return servers;
}

/**
 * Parse Cline/Roo configuration format
 * Format: { "mcpServers": { "name": { ... } } }
 */
function parseClineConfig(config) {
    return parseClaudeDesktopConfig(config);  // Same format
}

/**
 * Parse Continue.dev configuration format
 * Format: { "experimental": { "modelContextProtocolServers": [...] } }
 */
function parseContinueConfig(config) {
    const servers = [];
    const mcpServers = config?.experimental?.modelContextProtocolServers ||
                       config?.modelContextProtocolServers ||
                       [];

    if (Array.isArray(mcpServers)) {
        for (const serverConfig of mcpServers) {
            const name = serverConfig.name || serverConfig.id || 'unnamed';
            const server = analyzeServerConfig(name, serverConfig);
            servers.push(server);
        }
    }

    return servers;
}

/**
 * Parse Zed configuration format
 * MCP servers may be in context_servers section
 */
function parseZedConfig(config) {
    const servers = [];
    const contextServers = config?.context_servers || config?.mcp_servers || {};

    for (const [name, serverConfig] of Object.entries(contextServers)) {
        if (!serverConfig || typeof serverConfig !== 'object') continue;

        const server = analyzeServerConfig(name, serverConfig);
        servers.push(server);
    }

    return servers;
}

/**
 * Parse generic MCP configuration format
 * Tries multiple common structures
 */
function parseGenericMCPConfig(config) {
    const servers = [];

    // Try object format: { "servers": { "name": {...} } }
    if (config.servers && typeof config.servers === 'object') {
        for (const [name, serverConfig] of Object.entries(config.servers)) {
            if (!serverConfig || typeof serverConfig !== 'object') continue;
            servers.push(analyzeServerConfig(name, serverConfig));
        }
    }

    // Try array format: { "servers": [...] }
    if (Array.isArray(config.servers)) {
        for (const serverConfig of config.servers) {
            const name = serverConfig.name || serverConfig.id || 'unnamed';
            servers.push(analyzeServerConfig(name, serverConfig));
        }
    }

    // Try mcpServers format
    if (config.mcpServers) {
        servers.push(...parseClaudeDesktopConfig(config));
    }

    return servers;
}

/**
 * Analyze a server configuration to determine type and auth status
 */
function analyzeServerConfig(name, config) {
    const authIndicators = [];
    let type = 'stdio';  // Default
    let url = null;
    let command = null;
    let isRemote = false;

    // Determine transport type
    if (config.url || config.uri || config.endpoint) {
        url = config.url || config.uri || config.endpoint;
        type = url.includes('/sse') ? 'sse' : 'http';
        isRemote = true;
    } else if (config.command) {
        type = 'stdio';
        command = config.command;
        // Check if command is a remote proxy (e.g., npx mcp-remote)
        const cmdStr = Array.isArray(config.args)
            ? `${config.command} ${config.args.join(' ')}`
            : config.command;
        if (cmdStr.includes('http://') || cmdStr.includes('https://')) {
            isRemote = true;
            // Extract URL from args if present
            const urlMatch = cmdStr.match(/(https?:\/\/[^\s]+)/);
            if (urlMatch) url = urlMatch[1];
        }
    } else if (config.transport) {
        type = config.transport;
        if (type === 'sse' || type === 'http' || type === 'streamable-http') {
            isRemote = true;
            url = config.url || config.uri || config.endpoint;
        }
    }

    // Check for authentication indicators
    // We check for the PRESENCE of auth config, not its value
    // (we don't want to read/expose actual secrets)

    // Check env vars that suggest auth
    if (config.env && typeof config.env === 'object') {
        const envKeys = Object.keys(config.env);
        const authEnvPatterns = [
            /auth/i, /token/i, /key/i, /secret/i, /password/i,
            /credential/i, /bearer/i, /api.?key/i
        ];
        for (const key of envKeys) {
            if (authEnvPatterns.some(p => p.test(key))) {
                authIndicators.push(`env.${key}`);
            }
        }
    }

    // Check for explicit auth configuration
    if (config.auth) {
        authIndicators.push('auth config present');
    }
    if (config.authentication) {
        authIndicators.push('authentication config present');
    }
    if (config.headers) {
        const headerKeys = Object.keys(config.headers);
        if (headerKeys.some(h => /auth|token|bearer|key/i.test(h))) {
            authIndicators.push('auth headers configured');
        }
    }
    if (config.token || config.apiKey || config.api_key) {
        authIndicators.push('token/apiKey field present');
    }
    if (config.bearer || config.bearerToken) {
        authIndicators.push('bearer token configured');
    }

    // Check args for auth-related flags
    if (Array.isArray(config.args)) {
        const argsStr = config.args.join(' ');
        if (/--token|--auth|--key|--secret|--bearer/i.test(argsStr)) {
            authIndicators.push('auth args present');
        }
    }

    return {
        name,
        type,
        command,
        url,
        isRemote,
        hasAuth: authIndicators.length > 0,
        authIndicators
    };
}

/**
 * Expand ~ to home directory and handle platform-specific paths
 */
function expandPath(filePath) {
    const home = os.homedir();

    if (filePath.startsWith('~')) {
        return path.join(home, filePath.slice(1));
    }

    if (filePath.startsWith('/') || /^[A-Z]:/i.test(filePath)) {
        return filePath;  // Already absolute
    }

    return path.join(home, filePath);
}

/**
 * Scan a single configuration file
 *
 * @param {string} tool - Tool name
 * @param {string} configPath - Path to config file
 * @param {Function} parser - Parser function for this config format
 * @returns {ConfigScanResult}
 */
function scanConfigFile(tool, configPath, parser) {
    const fullPath = expandPath(configPath);

    const result = {
        tool,
        configPath: fullPath,
        exists: false,
        servers: [],
        error: null
    };

    try {
        // Check if file exists (read-only check)
        if (!fs.existsSync(fullPath)) {
            return result;
        }

        result.exists = true;

        // Read file contents
        const content = fs.readFileSync(fullPath, 'utf-8');

        // Parse JSON
        const config = JSON.parse(content);

        // Extract server configurations
        result.servers = parser(config);

    } catch (error) {
        if (error.code === 'ENOENT') {
            // File doesn't exist, not an error
            return result;
        } else if (error.code === 'EACCES') {
            result.error = 'Permission denied';
        } else if (error instanceof SyntaxError) {
            result.exists = true;
            result.error = 'Invalid JSON';
        } else {
            result.error = error.message;
        }
    }

    return result;
}

/**
 * Scan all known configuration locations
 *
 * @param {Object} options - Scan options
 * @param {boolean} [options.includeStdio=false] - Include stdio (local) servers in results
 * @param {string[]} [options.additionalPaths] - Additional config paths to check
 * @returns {ConfigScanResult[]}
 */
export function scanConfigFiles(options = {}) {
    const { includeStdio = false, additionalPaths = [] } = options;
    const results = [];

    // Scan all known locations
    for (const location of CONFIG_LOCATIONS) {
        for (const configPath of location.paths) {
            const result = scanConfigFile(location.tool, configPath, location.parser);

            // Only include if file exists or had an error (skip missing files silently)
            if (result.exists || result.error) {
                // Filter out stdio servers unless requested
                if (!includeStdio) {
                    result.servers = result.servers.filter(s => s.isRemote);
                }
                results.push(result);
            }
        }
    }

    // Scan additional paths if provided
    for (const configPath of additionalPaths) {
        const result = scanConfigFile('Custom', configPath, parseGenericMCPConfig);
        if (result.exists || result.error) {
            if (!includeStdio) {
                result.servers = result.servers.filter(s => s.isRemote);
            }
            results.push(result);
        }
    }

    return results;
}

/**
 * Get a summary of unprotected servers from scan results
 *
 * @param {ConfigScanResult[]} results - Scan results
 * @returns {{ total: number, unprotected: McpServerConfig[], protected: McpServerConfig[] }}
 */
export function summarizeResults(results) {
    const allServers = [];

    for (const result of results) {
        for (const server of result.servers) {
            allServers.push({
                ...server,
                tool: result.tool,
                configPath: result.configPath
            });
        }
    }

    return {
        total: allServers.length,
        unprotected: allServers.filter(s => !s.hasAuth),
        protected: allServers.filter(s => s.hasAuth)
    };
}

/**
 * Get list of all paths that will be checked
 * (For transparency - users can see exactly what we look for)
 *
 * @returns {string[]}
 */
export function getCheckedPaths() {
    const paths = [];
    for (const location of CONFIG_LOCATIONS) {
        for (const configPath of location.paths) {
            paths.push({
                tool: location.tool,
                description: location.description,
                path: expandPath(configPath)
            });
        }
    }
    return paths;
}
