# Changelog

## [2.0.0] - 2025-09-28

### 🚀 Major New Features
- **Multi-Account Support**: Complete rewrite to support multiple Gmail accounts with tags (personal, work, etc.)
- **Account Management Tools**: Added 5 new MCP tools for managing accounts:
  - `list_accounts` - View all configured accounts
  - `add_account` - Add new accounts via interactive OAuth
  - `remove_account` - Remove accounts and credentials
  - `set_default_account` - Change default account
  - `update_account` - Update account metadata

### 🔧 Technical Changes
- **New Architecture**: Introduced `AccountManager` class for centralized account handling
- **Enhanced Authentication**: OAuth2 flow now supports multiple accounts with custom tags and names
- **Account Parameter**: All Gmail tools now accept optional `account` parameter for account selection
- **Storage Structure**: New file structure in `~/.gmail-mcp/`:
  - `accounts.json` - Account metadata
  - `accounts/` directory with individual credential files
- **Legacy Migration**: Automatic migration of single-account credentials to new multi-account system

### 📖 Documentation Updates
- Updated README with comprehensive multi-account usage examples
- Added new npm scripts for common account setups (`auth:personal`, `auth:work`)
- Enhanced feature list highlighting multi-account capabilities
- Detailed account management workflow documentation

### 🔄 Breaking Changes
- Minimum version bump to 2.0.0 due to new account parameter in all tools
- Legacy single-credential setup will be automatically migrated on first run
- New command syntax for adding accounts: `npm run auth <accountId> <tag> <name>`

### 🛠 Developer Experience
- Enhanced error messages for account-related issues
- Better validation and user feedback for account operations
- Improved OAuth2 flow with account-specific success messages

## [1.1.11] - Previous Version
- Previous single-account functionality
- Basic Gmail operations and filters
- Attachment support
- Label management