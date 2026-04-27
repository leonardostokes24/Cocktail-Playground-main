import React, { useState } from 'react';
import { supabase } from '../services/supabaseClient';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthChange: (session: any) => void;
}

export default function LoginModal({ isOpen, onClose, onAuthChange }: LoginModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);

    try {
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
        },
      });

      if (authError) throw authError;
      
      // The user will be redirected to Google and then back to the app.
      // The session will be handled by the onAuthStateChange listener in App.tsx.
      onClose();
    } catch (err: any) {
      setError(err.message || 'An error occurred during Google authentication');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(2, 6, 23, 0.8)', zIndex: 3000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backdropFilter: 'blur(8px)'
    }}>
      <div style={{
        background: '#1e293b', padding: '32px', borderRadius: '24px',
        width: '400px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        border: '1px solid #334155', color: 'white', textAlign: 'center'
      }}>
        <div style={{ 
          background: 'white', width: '48px', height: '48px', borderRadius: '50%', 
          margin: '0 auto 20px', display: 'flex', alignItems: 'center', justifyContent: 'center' 
        }}>
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" style={{ width: '24px' }} />
        </div>
        
        <h2 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '8px' }}>
          Welcome to Cocktail Playground
        </h2>
        <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '24px' }}>
          Sign in with your Google account to save your creations and access your private library.
        </p>

        {error && <div style={{ color: '#f87171', fontSize: '12px', fontWeight: 600, marginBottom: '16px' }}>{error}</div>}
        
        <button 
          onClick={handleGoogleLogin}
          disabled={loading}
          style={{ 
            width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #334155', 
            background: 'white', color: '#0f172a', fontWeight: 700, 
            cursor: 'pointer', transition: 'all 0.2s', display: 'flex', 
            alignItems: 'center', justifyContent: 'center', gap: '12px'
          }}
        >
          {loading ? 'Connecting...' : (
            <>
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" style={{ width: '18px' }} />
              Continue with Google
            </>
          )}
        </button>

        <button 
          onClick={onClose}
          style={{ 
            marginTop: '24px', background: 'none', border: 'none', 
            color: '#64748b', cursor: 'pointer', fontSize: '12px' 
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
