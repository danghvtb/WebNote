import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ensureAccessToken, getValidAccessToken } from './auth';

class MemoryStorage {
  private values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
  clear() { this.values.clear(); }
}

describe('Google Drive token lifecycle', () => {
  let storage: MemoryStorage;

  beforeEach(() => {
    storage = new MemoryStorage();
    Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true });
    Object.defineProperty(globalThis, 'window', {
      value: { dispatchEvent: vi.fn() },
      configurable: true,
    });
  });

  it('returns a stored token while it is valid', () => {
    storage.setItem('mynotes_token', 'valid-token');
    storage.setItem('mynotes_token_expiry', String(Date.now() + 60_000));

    expect(getValidAccessToken()).toBe('valid-token');
  });

  it('clears an expired token without opening OAuth UI', async () => {
    storage.setItem('mynotes_token', 'expired-token');
    storage.setItem('mynotes_token_expiry', String(Date.now() - 1));

    expect(getValidAccessToken()).toBeNull();
    await expect(ensureAccessToken()).rejects.toThrow('AUTH_REQUIRED');
    expect(storage.getItem('mynotes_token')).toBeNull();
    expect(window.dispatchEvent).toHaveBeenCalledWith(expect.any(CustomEvent));
  });
});
