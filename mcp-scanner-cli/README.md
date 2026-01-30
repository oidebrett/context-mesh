# mcp-scan

A zero-dependency CLI tool for discovering unprotected [MCP (Model Context Protocol)](https://modelcontextprotocol.io/) servers.

## Why This Tool Exists

MCP servers allow AI assistants to interact with local tools, files, and services. When these servers are exposed without authentication, anyone on the network can connect to them and potentially:

- Read sensitive files
- Execute commands
- Access private APIs
- Exfiltrate data

This tool helps security teams and developers identify vulnerable MCP endpoints before attackers do.

## Features

- **Network Scanning** - Probe network endpoints for running MCP servers
- **Config Scanning** - Check local AI tool config files for unprotected server definitions
- **Zero Dependencies** - Uses only Node.js built-in modules
- **Full Transparency** - View exactly which files are checked with `show-paths`
- **CI/CD Ready** - Exit codes and JSON output for automation

## Installation

```bash
npm install -g mcp-scan
```

Or run directly with npx:

```bash
npx mcp-scan configs
```

## Quick Start

```bash
# Check your local AI tool configs for unprotected MCP servers
mcp-scan configs

# Scan localhost for running MCP servers
mcp-scan localhost

# Run both scans
mcp-scan all

# See exactly which config files will be checked
mcp-scan show-paths
```

## Commands

| Command | Description |
|---------|-------------|
| `mcp-scan network [target]` | Scan network for running MCP servers (default) |
| `mcp-scan configs` | Scan local AI tool config files |
| `mcp-scan all [target]` | Run both network and config scans |
| `mcp-scan show-paths` | List all config file paths that will be checked |

## Network Scan Targets

| Target | Description |
|--------|-------------|
| `localhost` | Scan localhost only (fastest) |
| `local` | Scan local network (/24 range) |
| `192.168.1.100` | Scan a single IP |
| `192.168.1.0/24` | Scan a CIDR range (max /24) |
| `example.com` | Scan domain + common subdomains |
| `*.example.com` | Scan subdomains of a domain |

## Options

| Option | Description |
|--------|-------------|
| `-p, --ports <list>` | Ports to scan (comma-separated). Default: 3000,3001,3010,3011,8000,8080,8888,9000,9090 |
| `-t, --timeout <ms>` | Request timeout in milliseconds. Default: 2000 |
| `--https` | Use HTTPS instead of HTTP |
| `--include-local` | Include local (stdio) servers in config scan |
| `-j, --json` | Output results as JSON |
| `-q, --quiet` | Suppress banner and progress output |
| `-h, --help` | Show help message |
| `-v, --version` | Show version number |

## Config Files Checked

The config scan checks these AI tools:

| Tool | Config Locations |
|------|------------------|
| Claude Desktop | `~/.config/claude/`, `~/Library/Application Support/Claude/` |
| Cline | `~/.cline/`, `~/.config/cline/` |
| Roo Code | `~/.roo-cline/`, `~/.roo/` |
| Continue.dev | `~/.continue/`, `~/.config/continue/` |
| Cursor | `~/.cursor/`, `~/Library/Application Support/Cursor/` |
| Windsurf | `~/.windsurf/`, `~/.codeium/` |
| Zed | `~/.config/zed/` |
| Generic MCP | `~/.mcp/`, `~/.config/mcp/`, `mcp.json` |

Run `mcp-scan show-paths` to see the exact paths for your system.

## Example Output

### Config Scan
```
═══════════════════════════════════════════════════════════════
CONFIG FILE SCAN
═══════════════════════════════════════════════════════════════

Checking local AI tool configuration files...

Config files found:
  ✓ Claude Desktop: /home/user/.config/claude/claude_desktop_config.json
      2 remote MCP server(s) configured

Remote MCP servers configured: 2

 ⚠️  1 SERVER(S) WITHOUT AUTH CONFIGURED

These MCP server configurations do not appear to have authentication.
If these servers are network-accessible, they may be vulnerable.

[1] my-remote-server
    URL: http://192.168.1.50:3000/sse
    Type: SSE
    Auth: ⚠️  NO AUTH
    Tool: Claude Desktop
    Config: /home/user/.config/claude/claude_desktop_config.json

 ✓ 1 SERVER(S) WITH AUTH

[1] secure-server
    URL: https://api.example.com/mcp
    Type: HTTP
    Auth: 🔒 Auth configured
    Auth indicators: env.API_KEY, auth headers configured
    Tool: Claude Desktop
    Config: /home/user/.config/claude/claude_desktop_config.json
```

### Network Scan
```
═══════════════════════════════════════════════════════════════
NETWORK SCAN
═══════════════════════════════════════════════════════════════

Target: localhost
Ports: 3000, 3001, 3010, 3011, 8000, 8080, 8888, 9000, 9090
Timeout: 2000ms
Protocol: HTTP

Hosts scanned: 2
Scan duration: 1.23s
MCP servers found: 1

 ⚠️  1 UNPROTECTED SERVER(S) FOUND

[1] http://localhost:3000/sse
    Type: SSE
    Auth: ⚠️  UNPROTECTED
```

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | No unprotected servers found |
| 1 | Unprotected server(s) found |
| 2 | Error during scan |

Use in CI/CD pipelines:

```bash
mcp-scan all || echo "Security issue found!"
```

## Transparency Commitment

This tool is designed to be fully auditable by security professionals:

### What This Tool Does
- ✅ Sends HTTP requests to detect MCP server endpoints
- ✅ Reads local config files to find MCP server definitions
- ✅ Reports if servers/configs lack authentication
- ✅ Shows exactly which files will be checked (`show-paths`)

### What This Tool Does NOT Do
- ❌ **Does not modify any files** - Read-only operations only
- ❌ **Does not execute commands** - Never runs commands found in configs
- ❌ **Does not send data externally** - No telemetry, no phone-home
- ❌ **Does not exploit vulnerabilities** - Detection only
- ❌ **Does not read secrets** - Only checks for presence of auth config
- ❌ **Does not bypass authentication** - Reports auth status, doesn't circumvent it

### Auditability
- **Zero runtime dependencies** - Uses only Node.js built-in modules
- **~500 lines of code** - Small enough to review completely
- **MIT license** - Fully open source

Run `mcp-scan show-paths --json` to get a machine-readable list of all file paths that will be checked.

## How Auth Detection Works

The config scanner looks for the **presence** of authentication-related settings, not their values:

**Detected as "has auth":**
- Environment variables with auth-related names (`API_KEY`, `TOKEN`, `SECRET`, etc.)
- `auth` or `authentication` config blocks
- Headers with auth-related names (`Authorization`, `X-API-Key`, etc.)
- `token`, `apiKey`, `bearer` fields

**Not detected:**
- Whether the auth values are actually valid
- Whether the server actually enforces authentication

This tool gives you a starting point for security review, not a guarantee.

## Protecting Your MCP Servers

If this tool finds unprotected servers:

### 1. Add Authentication to Configs

```json
{
  "mcpServers": {
    "my-server": {
      "url": "http://example.com:3000/sse",
      "headers": {
        "Authorization": "Bearer ${MCP_AUTH_TOKEN}"
      }
    }
  }
}
```

### 2. Use Environment Variables

```json
{
  "mcpServers": {
    "my-server": {
      "command": "node",
      "args": ["server.js"],
      "env": {
        "API_KEY": "${MY_SECRET_KEY}"
      }
    }
  }
}
```

### 3. For Network Servers

```bash
# Bind to localhost only
server.listen({ host: '127.0.0.1', port: 3000 });

# Or use a reverse proxy with auth
# nginx, Caddy, etc.
```

### 4. Firewall Rules

```bash
# Only allow localhost
iptables -A INPUT -p tcp --dport 3000 -s 127.0.0.1 -j ACCEPT
iptables -A INPUT -p tcp --dport 3000 -j DROP
```

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

When adding support for new AI tools, add entries to `CONFIG_LOCATIONS` in `src/config-scanner.js`.

## Ethical Use

This tool is intended for:
- Security professionals auditing their own networks
- Developers checking their MCP server configurations
- DevOps teams validating deployment security

**Only scan networks and systems you own or have explicit permission to test.**

Unauthorized network scanning may violate laws and regulations.

## License

MIT License - see [LICENSE](LICENSE) file.

## Related

- [MCP Specification](https://spec.modelcontextprotocol.io/)
- [Context Mesh](https://contextmesh.com) - Managed MCP security and integration platform
