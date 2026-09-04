// ============================================================
// MyNotes — Login Page
// Full-screen login with Google OAuth.
// ============================================================

import { useState } from 'react';
import { Brain, Cloud, Shield, Zap } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { initGoogleAuth, signIn, fetchUserProfile } from '../../services/google/auth';
import { ensureRootFolder } from '../../services/google/rootFolderManager';
import { syncFromCloud } from '../../services/sync/syncManager';
import { useNotesStore } from '../../stores/notesStore';

export function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<string>('');

  const { setAuth, setRootFolderId, setInitialized, setNeedsFolderCreation } = useAppStore();

  const handleLogin = async () => {
    setLoading(true);
    setError(null);

    try {
      // Step 1: Initialize Google Auth
      setStep('Initializing...');
      await initGoogleAuth();

      // Step 2: Sign in
      setStep('Signing in with Google...');
      const accessToken = await signIn();

      // Step 3: Get user profile
      setStep('Getting your profile...');
      const user = await fetchUserProfile(accessToken);
      setAuth(user, accessToken);

      // Step 4: Find or detect root folder
      setStep('Looking for MyNotes folder...');
      const result = await ensureRootFolder();

      if (result.status === 'found') {
        setRootFolderId(result.folderId);
        setStep('Loading your notes...');
        await syncFromCloud();
        const notesStore = useNotesStore.getState();
        await notesStore.loadDays();
        await notesStore.loadRecentNotebooks();
        await notesStore.selectToday();
        setInitialized(true);
      } else if (result.status === 'not_found') {
        // Need to ask user to create folder
        setNeedsFolderCreation(true);
        setInitialized(true);
      } else if (result.status === 'multiple') {
        // Multiple folders — use the first one with database
        const best = result.folders.find((f) => f.hasDatabase) || result.folders[0];
        setRootFolderId(best.id);
        setStep('Loading your notes...');
        await syncFromCloud();
        const notesStore = useNotesStore.getState();
        await notesStore.loadDays();
        await notesStore.loadRecentNotebooks();
        await notesStore.selectToday();
        setInitialized(true);
      } else if (result.status === 'error') {
        setError(result.error);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Login failed';
      setError(msg);
      console.error('[Login]', err);
    } finally {
      setLoading(false);
      setStep('');
    }
  };

  return (
    <div className="h-screen w-screen flex items-center justify-center" style={{ background: 'var(--color-bg-primary)' }}>
      <div className="animate-fade-in w-full max-w-md px-6">
        {/* Logo & Title */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-6" style={{ background: 'var(--color-accent-dim)' }}>
            <Brain className="w-8 h-8" style={{ color: 'var(--color-accent)' }} />
          </div>
          <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--color-text-primary)' }}>MyNotes</h1>
          <p className="text-base" style={{ color: 'var(--color-text-secondary)' }}>Personal Knowledge Base</p>
        </div>

        {/* Features */}
        <div className="grid grid-cols-3 gap-4 mb-10">
          {[
            { icon: Cloud, label: 'Google Drive', desc: 'Cloud sync' },
            { icon: Shield, label: 'Your data', desc: 'Private & secure' },
            { icon: Zap, label: 'Offline-first', desc: 'Always available' },
          ].map((feature) => (
            <div
              key={feature.label}
              className="flex flex-col items-center text-center p-3 rounded-xl"
              style={{ background: 'var(--color-bg-secondary)' }}
            >
              <feature.icon className="w-5 h-5 mb-2" style={{ color: 'var(--color-accent)' }} />
              <span className="text-xs font-medium" style={{ color: 'var(--color-text-primary)' }}>{feature.label}</span>
              <span className="text-xs mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>{feature.desc}</span>
            </div>
          ))}
        </div>

        {/* Login Button */}
        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 px-6 py-3.5 rounded-xl text-base font-medium transition-all duration-200 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          style={{
            background: loading ? 'var(--color-bg-tertiary)' : 'var(--color-text-primary)',
            color: loading ? 'var(--color-text-secondary)' : 'var(--color-bg-primary)',
          }}
          onMouseEnter={(e) => !loading && ((e.target as HTMLElement).style.opacity = '0.9')}
          onMouseLeave={(e) => ((e.target as HTMLElement).style.opacity = '1')}
        >
          {loading ? (
            <>
              <div className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--color-text-tertiary)', borderTopColor: 'var(--color-text-primary)' }} />
              <span>{step || 'Please wait...'}</span>
            </>
          ) : (
            <>
              <svg width="20" height="20" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              <span>Continue with Google</span>
            </>
          )}
        </button>

        {/* Offline Demo Mode Button */}
        <button
          onClick={async () => {
            setAuth(
              { name: 'Demo User', email: 'demo@mynotes.local' },
              'demo-token'
            );
            setRootFolderId('demo-folder-id');
            setInitialized(true);
            const notesStore = useNotesStore.getState();
            await notesStore.loadDays();
            await notesStore.selectToday();
          }}
          className="w-full mt-3 py-2.5 px-4 rounded-xl font-medium text-xs flex items-center justify-center gap-2 border transition-all cursor-pointer"
          style={{
            borderColor: 'var(--color-border)',
            color: 'var(--color-text-secondary)',
            background: 'var(--color-bg-tertiary)',
          }}
        >
          <span>🚀 Explore in Offline Demo Mode</span>
        </button>

        {/* Error Message */}
        {error && (
          <div className="mt-4 p-3 rounded-lg text-sm animate-slide-up" style={{ background: 'rgba(248, 81, 73, 0.1)', color: 'var(--color-error)' }}>
            {error}
          </div>
        )}

        {/* Footer */}
        <p className="text-center text-xs mt-8" style={{ color: 'var(--color-text-tertiary)' }}>
          Your notes are stored securely in your own Google Drive.
          <br />
          No data is stored on our servers.
        </p>
      </div>
    </div>
  );
}
