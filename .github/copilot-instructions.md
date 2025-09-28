# Gmail MCP Server - AI Coding Assistant Instructions

This is a Model Context Protocol (MCP) server that provides AI assistants like Claude Desktop with comprehensive Gmail integration through OAuth2 authentication.

## Architecture Overview

The server follows a modular MCP architecture:
- **`src/index.ts`** - Main server entry point with MCP tool registration and OAuth2 flow
- **`src/label-manager.ts`** - Gmail label CRUD operations 
- **`src/filter-manager.ts`** - Gmail filter management with templates
- **`src/utl.ts`** - Email composition utilities with MIME/RFC 2047 encoding
- **`src/evals/evals.ts`** - mcp-evals test framework integration

## Key Patterns & Conventions

### OAuth2 Credential Management
- Global credentials stored in `~/.gmail-mcp/` (cross-platform via `os.homedir()`)
- Supports both Desktop and Web application credential types
- Auto-copies local `gcp-oauth.keys.json` to global location during auth
- Environment variables: `GMAIL_OAUTH_PATH`, `GMAIL_CREDENTIALS_PATH`

### MCP Tool Structure
Tools use Zod schemas with `zodToJsonSchema()` for input validation:
```typescript
const schema = z.object({ /* validation */ });
inputSchema: zodToJsonSchema(schema)
```

### Gmail API Patterns
- **Batch operations** for efficiency (see `batch_modify_emails`, `batch_delete_emails`)
- **MIME parsing** - Complex recursive email content extraction in `extractEmailContent()`
- **Attachment handling** - Full download/upload with proper MIME type detection
- **Label resolution** - Always resolve label names to IDs before Gmail API calls

### Email Encoding
International character support via RFC 2047 MIME encoding in `encodeEmailHeader()`. All subject lines and headers are properly encoded for non-ASCII characters.

## Development Workflows

### Building & Running
```bash
npm run build          # TypeScript compilation to dist/
npm start             # Run compiled server
npm run auth          # Interactive OAuth2 setup
```

### Docker Development
- Multi-stage build with credential volume mounts
- Environment variables for containerized credential paths
- Port 3000 exposed for OAuth callback server

### Authentication Flow
1. Place `gcp-oauth.keys.json` in current directory or `~/.gmail-mcp/`
2. Run `npm run auth` to start OAuth flow
3. Browser launches automatically for Google consent
4. Credentials saved to `~/.gmail-mcp/credentials.json`

### Testing with mcp-evals
Integration tests use OpenAI GPT-4 for tool evaluation:
- Email sending, drafting, reading functionality
- Search syntax validation  
- Label and filter management

## Integration Points

### Claude Desktop Configuration
```json
{
  "mcpServers": {
    "gmail": {
      "command": "npx",
      "args": ["@keleshteri/server-gmail-autoauth-mcp"]
    }
  }
}
```

### Gmail API Scopes Required
The server requires these Gmail API scopes:
- `https://www.googleapis.com/auth/gmail.readonly`
- `https://www.googleapis.com/auth/gmail.send`
- `https://www.googleapis.com/auth/gmail.modify`
- `https://www.googleapis.com/auth/gmail.settings.basic`

### External Dependencies
- **googleapis** - Official Google APIs client
- **google-auth-library** - OAuth2 flow management
- **@modelcontextprotocol/sdk** - MCP protocol implementation
- **nodemailer** - Alternative email composition (fallback)
- **mcp-evals** - Testing framework for MCP tools

## Critical Implementation Details

- **Error handling**: Gmail API errors are caught and re-thrown with user-friendly messages
- **Rate limiting**: Batch operations use Gmail's batch API endpoints
- **Security**: OAuth tokens auto-refresh, stored securely in user home directory
- **Cross-platform**: Uses Node.js path utilities for Windows/Unix compatibility
- **Memory efficiency**: Large email content streams through base64 decoding without full buffer loads

When modifying this codebase, ensure OAuth flows remain intact and all Gmail API calls include proper error handling and batch processing where applicable.