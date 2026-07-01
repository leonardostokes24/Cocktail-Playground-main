import React, { useState, useEffect } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { supabase } from './lib/supabase/client';
import LineageCanvas from './components/canvas/LineageCanvas';
import LoginModal from './components/LoginModal';

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [loginOpen, setLoginOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) =>
      setUser(session?.user ?? null)
    );
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_evt, session) => {
      setUser(session?.user ?? null);
      if (session?.user) setLoginOpen(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  return (
    <ReactFlowProvider>
      <LineageCanvas
        user={user}
        onLoginClick={() => setLoginOpen(true)}
        onLogoutClick={handleLogout}
      />
      {loginOpen && (
        <LoginModal
          isOpen={loginOpen}
          onClose={() => setLoginOpen(false)}
          onAuthChange={(session: any) => setUser(session?.user ?? null)}
        />
      )}
    </ReactFlowProvider>
  );
}
