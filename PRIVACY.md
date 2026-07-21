# Privacy

Discord MCP runs locally as a `stdio` process. It has no telemetry, analytics,
advertising, hosted proxy, or project-operated database.

When an MCP client invokes a tool or reads a resource, the server sends only the
corresponding bot-authenticated request to Discord's REST API. Discord responses
are normalized and returned to the local MCP client; this project does not
persist or independently transmit them. Your MCP client and Discord may retain
data under their own settings and privacy policies.

The Discord Bot Token is read from the process environment or a client-managed
secret store. It is used only to authenticate requests to Discord and is not
included in normal results, logs, package artifacts, or telemetry. The server
does not support Discord user tokens.

For the smallest data scope, use a dedicated test server, minimal Discord bot
permissions, and both guild and channel allowlists. See
[docs/secrets.md](docs/secrets.md) for setup and token-rotation guidance and
[Discord's Privacy Policy](https://discord.com/privacy) for Discord's handling
of API data.

Do not include tokens or private Discord content in a public issue.
