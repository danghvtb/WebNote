// ============================================================
// MyNotes — Google Auth Service
// Uses Google Identity Services (GIS) for OAuth 2.0
// ============================================================

import type { GoogleUser } from '../../types';

const SCOPES = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email';

// Dynamically get the client ID — allows build-time or runtime config
function getClientId(): string {
  // Try environment variable first (Vite build-time)
  const envClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  if (envClientId && envClientId !== 'YOUR_GOOGLE_CLIENT_ID') {
    return envClientId;
  }
  // Fallback for development — must be configured
  console.warn('[Auth] No VITE_GOOGLE_CLIENT_ID configured. Google login will not work.');
  return '';
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
let tokenExpiresAt: number | null = null;

// Promise resolvers for the token callback
let tokenResolve: ((token: string) => void) | null = null;
let tokenReject: ((error: Error) => void) | null = null;

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
export function loadGapiScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.getElementById('gapi-script')) {
      if (window.gapi) {
        resolve();
      }
      return;
    }
    const script = document.createElement('script');
    script.id = 'gapi-script';
    script.src = 'https://apis.google.com/js/api.js';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      window.gapi.load('client', async () => {
        try {
          await window.gapi.client.init({});
          resolve();
        } catch (err) {
          reject(err);
        }
      });
    };
    script.onerror = () => reject(new Error('Failed to load Google API client'));
    document.head.appendChild(script);
  });
}

/**
 * Initialize Google Auth — loads scripts and creates token client.
 */
export async function initGoogleAuth(): Promise<void> {
  await Promise.all([loadGISScript(), loadGapiScript()]);

  const clientId = getClientId();
  if (!clientId) {
    throw new Error('Google Client ID is not configured. Set VITE_GOOGLE_CLIENT_ID in .env');
  }

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
      tokenExpiresAt = Date.now() + response.expires_in * 1000;
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
 * Sign in with Google — triggers OAuth popup.
 * Returns the access token.
 */
export function signIn(): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!tokenClient) {
      reject(new Error('Google Auth not initialized'));
      return;
    }
    tokenResolve = resolve;
    tokenReject = reject;
    tokenClient.requestAccessToken({});
  });
}

/**
 * Sign in silently (no popup) — used for token refresh.
 */
export function signInSilent(): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!tokenClient) {
      reject(new Error('Google Auth not initialized'));
      return;
    }
    tokenResolve = resolve;
    tokenReject = reject;
    tokenClient.requestAccessToken({ prompt: '' });
  });
}

/**
 * Sign out — revoke the token and clear stored session.
 */
export function signOut(): void {
  if (currentAccessToken) {
    google.accounts.oauth2.revoke(currentAccessToken, () => {
      console.log('[Auth] Token revoked');
    });
  }
  currentAccessToken = null;
  tokenExpiresAt = null;
  localStorage.removeItem('mynotes_user');
  localStorage.removeItem('mynotes_token');
  localStorage.removeItem('mynotes_root_folder');
}

/**
 * Get the current valid access token.
 * Returns null if not logged in or token expired.
 */
export function getAccessToken(): string | null {
  if (!currentAccessToken) return null;
  if (tokenExpiresAt && Date.now() > tokenExpiresAt - 60000) {
    // Token is about to expire (within 1 minute)
    return null;
  }
  return currentAccessToken;
}

/**
 * Ensure we have a valid access token — refresh if needed.
 */
export async function ensureAccessToken(): Promise<string> {
  const token = getAccessToken();
  if (token) return token;

  // Try silent refresh
  try {
    return await signInSilent();
  } catch {
    throw new Error('Session expired. Please sign in again.');
  }
}

/**
 * Check if the user is authenticated.
 */
export function isAuthenticated(): boolean {
  return getAccessToken() !== null;
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
      requestAccessToken(config?: { prompt?: string }): void;
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
  interface Window {
    gapi: {
      load: (api: string, callback: () => void) => void;
      client: {
        init: (config: Record<string, unknown>) => Promise<void>;
        setToken: (token: { access_token: string }) => void;
      };
    };
  }
}
