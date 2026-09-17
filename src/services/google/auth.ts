// ============================================================
// MyNotes — Google Auth Service
// Uses Google Identity Services (GIS) for OAuth 2.0
// ============================================================

import type { GoogleUser } from '../../types';

const SCOPES = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email';

// The client ID must be configured explicitly so it remains stable between builds.
function getClientId(): string {
  const envClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  return envClientId && envClientId !== 'YOUR_GOOGLE_CLIENT_ID' ? envClientId : '';
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
  error?: string;
  error_description?: string;
}

// Token client from Google Identity Services
let tokenClient: google.accounts.oauth2.TokenClient | null = null;
let currentAccessToken: string | null = null;

// Promise resolvers for the token callback
let tokenResolve: ((token: string) => void) | null = null;
let tokenReject: ((error: Error) => void) | null = null;

export type SignInOptions = {
  prompt?: '' | 'select_account' | 'consent' | 'none';
  loginHint?: string;
};

/**
 * Load the Google Identity Services script.
 */
export function loadGISScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.getElementById('gis-script')) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.id = 'gis-script';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Identity Services'));
    document.head.appendChild(script);
  });
}

/**
 * Load the Google API client library (for Drive API calls).
 */
/**
 * Initialize Google Auth — loads scripts and creates token client.
 */
export async function initGoogleAuth(): Promise<void> {
  // Drive requests use authenticated fetch; do not load the unused GAPI
  // client on the startup critical path.
  await loadGISScript();

  const clientId = getClientId();
  if (!clientId) {
    throw new Error('Google Client ID is not configured. Set VITE_GOOGLE_CLIENT_ID in .env');
  }

  // Restore a token only while it is still valid. Expired tokens must not trigger
  // an OAuth popup during application startup.
  currentAccessToken = getValidAccessToken();

  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: SCOPES,
    callback: (response: TokenResponse) => {
      if (response.error) {
        tokenReject?.(new Error(response.error_description || response.error));
        tokenResolve = null;
        tokenReject = null;
        return;
      }
      currentAccessToken = response.access_token;
      localStorage.setItem('mynotes_token', response.access_token);
      
      // Calculate token expiration timestamp (expires_in is in seconds, minus 60s safety window)
      const expiresAt = Date.now() + (response.expires_in || 3600) * 1000 - 60000;
      localStorage.setItem('mynotes_token_expiry', expiresAt.toString());

      tokenResolve?.(response.access_token);
      tokenResolve = null;
      tokenReject = null;
    },
    error_callback: (error: google.accounts.oauth2.ClientConfigError) => {
      tokenReject?.(new Error(error.message || 'OAuth error'));
      tokenResolve = null;
      tokenReject = null;
    },
  });
}

/**
 * Request a token from a user gesture. The default is the first-login flow.
 */
export function signIn(options: SignInOptions = {}): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!tokenClient) {
      reject(new Error('Google Auth not initialized'));
      return;
    }
    tokenResolve = resolve;
    tokenReject = reject;
    const request: { prompt?: string; login_hint?: string } = {};
    request.prompt = options.prompt ?? 'select_account';
    if (options.loginHint) request.login_hint = options.loginHint;
    tokenClient.requestAccessToken(request);
  });
}

/**
 * Reconnect Drive after an access token expires. This is intentionally called
 * only from a user gesture; GIS token model does not support a browser-only
 * refresh token.
 */
export function connectGoogleDrive(loginHint?: string): Promise<string> {
  return signIn({ prompt: '', loginHint });
}

/**
 * Sign out — revoke the token and clear stored session.
 */
export function signOut(): void {
  const savedUser = localStorage.getItem('mynotes_user');
  let accountRootKey: string | null = null;
  try {
    const email = savedUser ? (JSON.parse(savedUser) as { email?: string }).email : '';
    if (email) accountRootKey = `mynotes_root_folder:${email.toLowerCase()}`;
  } catch {
    // Ignore malformed legacy session data.
  }
  if (currentAccessToken) {
    try {
      google.accounts.oauth2.revoke(currentAccessToken, () => {
        console.log('[Auth] Token revoked');
      });
    } catch {
      // Ignore if GIS script isn't loaded
    }
  }
  currentAccessToken = null;
  localStorage.removeItem('mynotes_user');
  localStorage.removeItem('mynotes_token');
  localStorage.removeItem('mynotes_token_expiry');
  localStorage.removeItem('mynotes_root_folder');
  localStorage.removeItem('mynotes_rootFolderId');
  if (accountRootKey) localStorage.removeItem(accountRootKey);
}

/**
 * Get the current access token if it has not expired.
 */
export function getValidAccessToken(): string | null {
  const token = currentAccessToken || localStorage.getItem('mynotes_token');
  const expiry = localStorage.getItem('mynotes_token_expiry');
  if (!token) return null;

  if (expiry) {
    const expiresAt = parseInt(expiry, 10);
    if (Date.now() >= expiresAt) {
      currentAccessToken = null;
      localStorage.removeItem('mynotes_token');
      localStorage.removeItem('mynotes_token_expiry');
      return null;
    }
  }
  currentAccessToken = token;
  return currentAccessToken;
}

// Backwards-compatible alias for consumers that only need a read-only check.
export const getAccessToken = getValidAccessToken;

/**
 * Require a valid token without ever opening an OAuth UI.
 */
export async function ensureAccessToken(): Promise<string> {
  const token = getValidAccessToken();
  if (token) return token;
  window.dispatchEvent(new CustomEvent('mynotes_auth_required'));
  throw new Error('AUTH_REQUIRED');
}

/**
 * Check if the user is authenticated.
 */
export function isAuthenticated(): boolean {
  return getValidAccessToken() !== null;
}

/**
 * Fetch the current Google user profile.
 */
export async function fetchUserProfile(accessToken: string): Promise<GoogleUser> {
  try {
    const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (response.ok) {
      const data = await response.json();
      return {
        email: data.email || 'user@google.com',
        name: data.name || 'MyNotes User',
        picture: data.picture,
      };
    }
  } catch (err) {
    console.warn('[Auth] Could not fetch user profile details:', err);
  }

  // Graceful fallback if userinfo fails or scope wasn't consented
  return {
    email: 'user@google.com',
    name: 'MyNotes User',
  };
}

// GIS type declarations — extend the global namespace
declare global {
  namespace google.accounts.oauth2 {
    interface TokenClient {
      requestAccessToken(config?: { prompt?: string; login_hint?: string }): void;
    }
    interface ClientConfigError {
      message?: string;
      type?: string;
    }
    function initTokenClient(config: {
      client_id: string;
      scope: string;
      callback: (response: TokenResponse) => void;
      error_callback?: (error: ClientConfigError) => void;
    }): TokenClient;
    function revoke(token: string, callback: () => void): void;
  }
}
