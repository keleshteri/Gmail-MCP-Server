import fs from 'fs';
import path from 'path';
import os from 'os';
import { OAuth2Client, Credentials } from 'google-auth-library';
import { google } from 'googleapis';

// Configuration paths
const CONFIG_DIR = path.join(os.homedir(), '.gmail-mcp');
const ACCOUNTS_DIR = path.join(CONFIG_DIR, 'accounts');
const ACCOUNTS_META_PATH = path.join(CONFIG_DIR, 'accounts.json');
const OAUTH_PATH = process.env.GMAIL_OAUTH_PATH || path.join(CONFIG_DIR, 'gcp-oauth.keys.json');

// Type definitions for account management
export interface AccountInfo {
    email: string;
    name: string;
    tag: string;
    createdAt: string;
    lastUsed: string;
}

export interface AccountsMetadata {
    accounts: Record<string, AccountInfo>;
    defaultAccount?: string;
}

export interface AccountCredentials {
    access_token?: string | null;
    refresh_token?: string | null;
    scope?: string;
    token_type?: string | null;
    expiry_date?: number | null;
}

/**
 * Multi-account manager for Gmail MCP Server
 * Handles OAuth2 clients, credentials, and account metadata
 */
export class AccountManager {
    private accountsMetadata: AccountsMetadata;
    private oauth2Clients: Map<string, OAuth2Client> = new Map();
    private oauthKeys: any;

    constructor() {
        this.ensureDirectoriesExist();
        this.loadOAuthKeys();
        this.accountsMetadata = this.loadAccountsMetadata();
    }

    /**
     * Ensure all required directories exist
     */
    private ensureDirectoriesExist(): void {
        if (!fs.existsSync(CONFIG_DIR)) {
            fs.mkdirSync(CONFIG_DIR, { recursive: true });
        }
        if (!fs.existsSync(ACCOUNTS_DIR)) {
            fs.mkdirSync(ACCOUNTS_DIR, { recursive: true });
        }
    }

    /**
     * Load OAuth2 application keys
     */
    private loadOAuthKeys(): void {
        // Check for OAuth keys in current directory first, then in config directory
        const localOAuthPath = path.join(process.cwd(), 'gcp-oauth.keys.json');

        if (fs.existsSync(localOAuthPath)) {
            // If found in current directory, copy to config directory
            fs.copyFileSync(localOAuthPath, OAUTH_PATH);
            console.log('OAuth keys found in current directory, copied to global config.');
        }

        if (!fs.existsSync(OAUTH_PATH)) {
            throw new Error('OAuth keys file not found. Please place gcp-oauth.keys.json in current directory or ' + CONFIG_DIR);
        }

        const keysContent = JSON.parse(fs.readFileSync(OAUTH_PATH, 'utf8'));
        this.oauthKeys = keysContent.installed || keysContent.web;

        if (!this.oauthKeys) {
            throw new Error('Invalid OAuth keys file format. File should contain either "installed" or "web" credentials.');
        }
    }

    /**
     * Load accounts metadata from file
     */
    private loadAccountsMetadata(): AccountsMetadata {
        if (!fs.existsSync(ACCOUNTS_META_PATH)) {
            return { accounts: {} };
        }

        try {
            return JSON.parse(fs.readFileSync(ACCOUNTS_META_PATH, 'utf8'));
        } catch (error) {
            console.error('Error loading accounts metadata:', error);
            return { accounts: {} };
        }
    }

    /**
     * Save accounts metadata to file
     */
    private saveAccountsMetadata(): void {
        fs.writeFileSync(ACCOUNTS_META_PATH, JSON.stringify(this.accountsMetadata, null, 2));
    }

    /**
     * Create OAuth2 client for account
     */
    private createOAuth2Client(redirectUri: string = "http://localhost:3000/oauth2callback"): OAuth2Client {
        return new OAuth2Client(
            this.oauthKeys.client_id,
            this.oauthKeys.client_secret,
            redirectUri
        );
    }

    /**
     * Get OAuth2 client for specific account
     */
    public getOAuth2Client(accountId: string): OAuth2Client | null {
        if (!this.oauth2Clients.has(accountId)) {
            const credentialsPath = path.join(ACCOUNTS_DIR, `${accountId}.json`);
            
            if (!fs.existsSync(credentialsPath)) {
                return null;
            }

            try {
                const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
                const client = this.createOAuth2Client();
                client.setCredentials(credentials);
                this.oauth2Clients.set(accountId, client);
            } catch (error) {
                console.error(`Error loading credentials for account ${accountId}:`, error);
                return null;
            }
        }

        return this.oauth2Clients.get(accountId) || null;
    }

    /**
     * List all available accounts
     */
    public listAccounts(): Record<string, AccountInfo> {
        return this.accountsMetadata.accounts;
    }

    /**
     * Get specific account info
     */
    public getAccount(accountId: string): AccountInfo | null {
        return this.accountsMetadata.accounts[accountId] || null;
    }

    /**
     * Get default account ID
     */
    public getDefaultAccountId(): string | null {
        return this.accountsMetadata.defaultAccount || Object.keys(this.accountsMetadata.accounts)[0] || null;
    }

    /**
     * Set default account
     */
    public setDefaultAccount(accountId: string): boolean {
        if (!this.accountsMetadata.accounts[accountId]) {
            return false;
        }
        this.accountsMetadata.defaultAccount = accountId;
        this.saveAccountsMetadata();
        return true;
    }

    /**
     * Add new account (during OAuth flow)
     */
    public async addAccount(accountId: string, tag: string, name: string, credentials: AccountCredentials, userEmail: string): Promise<void> {
        // Save credentials
        const credentialsPath = path.join(ACCOUNTS_DIR, `${accountId}.json`);
        fs.writeFileSync(credentialsPath, JSON.stringify(credentials, null, 2));

        // Save account metadata
        const now = new Date().toISOString();
        this.accountsMetadata.accounts[accountId] = {
            email: userEmail,
            name: name,
            tag: tag,
            createdAt: now,
            lastUsed: now
        };

        // Set as default if it's the first account
        if (Object.keys(this.accountsMetadata.accounts).length === 1) {
            this.accountsMetadata.defaultAccount = accountId;
        }

        this.saveAccountsMetadata();

        // Cache the OAuth2 client
        const client = this.createOAuth2Client();
        client.setCredentials(credentials);
        this.oauth2Clients.set(accountId, client);
    }

    /**
     * Remove account
     */
    public removeAccount(accountId: string): boolean {
        if (!this.accountsMetadata.accounts[accountId]) {
            return false;
        }

        // Remove credentials file
        const credentialsPath = path.join(ACCOUNTS_DIR, `${accountId}.json`);
        if (fs.existsSync(credentialsPath)) {
            fs.unlinkSync(credentialsPath);
        }

        // Remove from metadata
        delete this.accountsMetadata.accounts[accountId];

        // Update default account if needed
        if (this.accountsMetadata.defaultAccount === accountId) {
            const remainingAccounts = Object.keys(this.accountsMetadata.accounts);
            this.accountsMetadata.defaultAccount = remainingAccounts.length > 0 ? remainingAccounts[0] : undefined;
        }

        this.saveAccountsMetadata();

        // Remove cached client
        this.oauth2Clients.delete(accountId);

        return true;
    }

    /**
     * Update account metadata
     */
    public updateAccount(accountId: string, updates: Partial<Pick<AccountInfo, 'name' | 'tag'>>): boolean {
        if (!this.accountsMetadata.accounts[accountId]) {
            return false;
        }

        Object.assign(this.accountsMetadata.accounts[accountId], updates);
        this.accountsMetadata.accounts[accountId].lastUsed = new Date().toISOString();
        this.saveAccountsMetadata();
        return true;
    }

    /**
     * Update last used timestamp for account
     */
    public touchAccount(accountId: string): void {
        if (this.accountsMetadata.accounts[accountId]) {
            this.accountsMetadata.accounts[accountId].lastUsed = new Date().toISOString();
            this.saveAccountsMetadata();
        }
    }

    /**
     * Validate account exists and return OAuth2 client
     */
    public validateAndGetClient(accountId: string | null): { client: OAuth2Client; accountId: string } | null {
        // Use default account if none specified
        const targetAccountId = accountId || this.getDefaultAccountId();
        
        if (!targetAccountId) {
            return null;
        }

        const client = this.getOAuth2Client(targetAccountId);
        if (!client) {
            return null;
        }

        // Update last used timestamp
        this.touchAccount(targetAccountId);

        return { client, accountId: targetAccountId };
    }

    /**
     * Generate OAuth URL for new account
     */
    public generateAuthUrl(redirectUri: string = "http://localhost:3000/oauth2callback"): string {
        const client = this.createOAuth2Client(redirectUri);
        return client.generateAuthUrl({
            access_type: 'offline',
            scope: [
                'https://www.googleapis.com/auth/gmail.modify',
                'https://www.googleapis.com/auth/gmail.settings.basic'
            ],
        });
    }

    /**
     * Exchange auth code for tokens
     */
    public async exchangeCodeForTokens(code: string, redirectUri: string = "http://localhost:3000/oauth2callback"): Promise<AccountCredentials> {
        const client = this.createOAuth2Client(redirectUri);
        const { tokens } = await client.getToken(code);
        return tokens;
    }

    /**
     * Get user info from OAuth2 client (to get email address)
     */
    public async getUserInfo(client: OAuth2Client): Promise<{ email: string }> {
        try {
            const oauth2 = google.oauth2({ version: 'v2', auth: client });
            const response = await oauth2.userinfo.get();
            return { email: response.data.email || 'unknown@unknown.com' };
        } catch (error) {
            // Fallback: try to get email from Gmail API
            try {
                const gmail = google.gmail({ version: 'v1', auth: client });
                const profile = await gmail.users.getProfile({ userId: 'me' });
                return { email: profile.data.emailAddress || 'unknown@unknown.com' };
            } catch (gmailError) {
                console.error('Error getting user email:', error, gmailError);
                return { email: 'unknown@unknown.com' };
            }
        }
    }
}

// Export singleton instance
export const accountManager = new AccountManager();