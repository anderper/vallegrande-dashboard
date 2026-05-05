'use client';

import { useState, useEffect } from 'react';
import LoginModal from './LoginModal';

export default function LoginModalWrapper() {
  const [showLogin, setShowLogin] = useState(false);
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
    const auth = localStorage.getItem('dashboard_auth_v2');
    if (!auth) {
      setShowLogin(true);
    }
  }, []);

  if (!mounted || !showLogin) return null;

  return (
    <LoginModal isOpen={showLogin} onClose={() => setShowLogin(false)} />
  );
}