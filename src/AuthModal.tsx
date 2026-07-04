import React, { useState } from 'react';
import { Lock, User, AlertCircle, ArrowRight, X } from 'lucide-react';

interface AuthModalProps {
  role: 'manager' | 'mp';
  onSuccess: () => void;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ role, onSuccess, onClose }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isSignUp) {
      if (username.length < 3 || password.length < 3) {
        setError('Username and password must be at least 3 characters');
        return;
      }
      // Demo sign up: save their credentials to local storage and log them in
      localStorage.setItem(`demo_${role}_user`, username);
      localStorage.setItem(`demo_${role}_pass`, password);
      sessionStorage.setItem(`${role}_auth`, 'true');
      onSuccess();
    } else {
      // Login mode
      const defaultUser = role === 'manager' ? 'manager' : 'mp';
      const defaultPass = 'password';
      
      const savedUser = localStorage.getItem(`demo_${role}_user`) || defaultUser;
      const savedPass = localStorage.getItem(`demo_${role}_pass`) || defaultPass;

      if (username === savedUser && password === savedPass) {
        sessionStorage.setItem(`${role}_auth`, 'true');
        onSuccess();
      } else {
        setError('Invalid username or password');
      }
    }
  };

  const roleTitle = role === 'manager' ? 'Manager Console' : 'MP Dashboard';
  const themeColor = role === 'manager' ? '#2dd4bf' : '#fb923c';

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      backdropFilter: 'blur(12px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <div style={{
        backgroundColor: '#1a1835',
        border: `1px solid rgba(255, 255, 255, 0.1)`,
        borderRadius: '16px',
        padding: '32px',
        width: '100%',
        maxWidth: '400px',
        boxShadow: `0 20px 40px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05)`,
        color: 'white',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Subtle accent glow */}
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, height: '4px',
          background: `linear-gradient(90deg, transparent, ${themeColor}, transparent)`
        }} />

        {/* Close Button */}
        <button 
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '16px',
            left: '16px',
            background: 'rgba(255, 255, 255, 0.1)',
            border: 'none',
            borderRadius: '50%',
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: 'rgba(255, 255, 255, 0.7)',
            transition: 'all 0.2s'
          }}
          onMouseOver={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)')}
          onMouseOut={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)')}
        >
          <X size={18} />
        </button>

        <div style={{ textAlign: 'center', marginBottom: '32px', marginTop: '8px' }}>
          <div style={{
            width: '64px', height: '64px',
            borderRadius: '50%',
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
            border: `1px solid rgba(255, 255, 255, 0.1)`
          }}>
            <Lock size={32} color={themeColor} />
          </div>
          <h2 style={{ margin: '0 0 8px 0', fontSize: '1.5rem', fontWeight: '600' }}>
            {isSignUp ? `Sign up for ${roleTitle}` : `${roleTitle} Login`}
          </h2>
          <p style={{ margin: 0, color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.9rem' }}>
            {isSignUp ? 'Create a new demo account.' : 'Please authenticate to access the dashboard.'}
          </p>
        </div>

        {error && (
          <div style={{
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '8px',
            padding: '12px 16px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            color: '#f87171',
            fontSize: '0.9rem'
          }}>
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.7)' }}>Username</label>
            <div style={{ position: 'relative' }}>
              <User size={18} color="rgba(255, 255, 255, 0.4)" style={{ position: 'absolute', left: '12px', top: '13px' }} />
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Username"
                style={{
                  width: '100%',
                  backgroundColor: 'rgba(0, 0, 0, 0.2)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '8px',
                  padding: '12px 12px 12px 40px',
                  color: 'white',
                  fontSize: '1rem',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.7)' }}>Password</label>
            <div style={{ position: 'relative' }}>
              <Lock size={18} color="rgba(255, 255, 255, 0.4)" style={{ position: 'absolute', left: '12px', top: '13px' }} />
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Password"
                style={{
                  width: '100%',
                  backgroundColor: 'rgba(0, 0, 0, 0.2)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '8px',
                  padding: '12px 12px 12px 40px',
                  color: 'white',
                  fontSize: '1rem',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          </div>

          <button
            type="submit"
            style={{
              marginTop: '8px',
              backgroundColor: themeColor,
              color: '#000',
              border: 'none',
              borderRadius: '8px',
              padding: '14px',
              fontSize: '1rem',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'all 0.2s'
            }}
          >
            <span>{isSignUp ? 'Create Account & Login' : 'Login to Portal'}</span>
            <ArrowRight size={18} />
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '24px' }}>
          <button 
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError('');
            }}
            style={{
              background: 'none',
              border: 'none',
              color: 'rgba(255, 255, 255, 0.6)',
              fontSize: '0.9rem',
              cursor: 'pointer',
              textDecoration: 'underline'
            }}
          >
            {isSignUp ? 'Already have an account? Login' : "Don't have an account? Sign up"}
          </button>
        </div>
      </div>
    </div>
  );
};
