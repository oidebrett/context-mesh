# mcp-scan

A zero-dependency CLI tool for discovering unprotected [MCP (Model Context Protocol)](https://modelcontextprotocol.io/) servers on your network.

## Why This Tool Exists

MCP servers allow AI assistants to interact with local tools, files, and services. When these servers are exposed without authentication, anyone on the network can connect to them and potentially:

- Read sensitive files
- Execute commands
- Access private APIs
- Exfiltrate data

This tool helps security teams and developers identify vulnerable MCP endpoints before attackers do.

## Installation

```bash
npm install -g mcp-scan
```

Or run directly with npx:

```bash
npx mcp-scan localhost
```

## Usage

```bash
# Quick scan of localhost
mcp-scan localhost

# Scan your local network
mcp-scan local

# Scan a specific IP
mcp-scan 192.168.1.100

# Scan a CIDR range
mcp-scan 192.168.1.0/24

# Scan a domain
mcp-scan api.example.com

# Scan with custom ports
mcp-scan localhost -p 3000,8080,9000

# Output as JSON (for scripting)
mcp-scan localhost --json

# Use HTTPS
mcp-scan secure.example.com --https
```

## Options

| Option | Description |
|--------|-------------|
| `-p, --ports <list>` | Ports to scan (comma-separated). Default: 3000,3001,3010,3011,8000,8080,8888,9000,9090 |
| `-t, --timeout <ms>` | Request timeout in milliseconds. Default: 2000 |
| `--https` | Use HTTPS instead of HTTP |
| `-j, --json` | Output results as JSON |
| `-q, --quiet` | Suppress banner and progress output |
| `-h, --help` | Show help message |
| `-v, --version` | Show version number |

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | No unprotected servers found |
| 1 | Unprotected server(s) found |
| 2 | Error during scan |

This makes it easy to use in CI/CD pipelines:

```bash
mcp-scan localhost || echo "Unprotected MCP servers detected!"
```

## What It Scans For

The tool checks for MCP servers using:

**Transports:**
- SSE (Server-Sent Events)
- Streamable HTTP

**Endpoints:**
- `/sse`
- `/mcp/sse`
- `/events`
- `/stream`
- `/mcp`
- `/`

## How It Works

1. Resolves the target to a list of IP addresses or hostnames
2. For each host, connects to each port/path combination
3. Analyzes HTTP response headers and body to identify MCP servers
4. Reports whether endpoints require authentication

## What This Tool Does NOT Do

- **Does not exploit vulnerabilities** - It only checks if endpoints exist and require auth
- **Does not send data externally** - All scanning is local, no telemetry or data collection
- **Does not bypass authentication** - It reports auth requirements, doesn't circumvent them
- **Does not perform attacks** - No fuzzing, injection, or denial of service

## Security Considerations

### Ethical Use

This tool is intended for:
- Security professionals auditing their own networks
- Developers checking their MCP server configurations
- DevOps teams validating deployment security

**Only scan networks and systems you own or have explicit permission to test.**

### Auditability

This tool has:
- **Zero runtime dependencies** - Uses only Node.js built-in modules
- **Single-file scanner** - Easy to review (~300 lines of code)
- **MIT license** - Fully open source

Feel free to audit the code before running it on your systems.

## Protecting Your MCP Servers

If this tool finds unprotected servers, here's how to fix them:

### 1. Add Authentication

Most MCP server frameworks support auth configuration:

```javascript
// Example: Adding auth to an MCP server
const server = new MCPServer({
  auth: {
    type: 'bearer',
    token: process.env.MCP_AUTH_TOKEN
  }
});
```

### 2. Use a Reverse Proxy

Put nginx or Caddy in front of your MCP server:

```nginx
location /mcp {
    auth_basic "MCP Server";
    auth_basic_user_file /etc/nginx/.htpasswd;
    proxy_pass http://localhost:3000;
}
```

### 3. Bind to Localhost Only

If the server only needs local access:

```javascript
server.listen({ host: '127.0.0.1', port: 3000 });
```

### 4. Use Firewall Rules

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

## License

MIT License - see [LICENSE](LICENSE) file.

## Related

- [MCP Specification](https://spec.modelcontextprotocol.io/)
- [Context Mesh](https://contextmesh.com) - Managed MCP security and integration platform
