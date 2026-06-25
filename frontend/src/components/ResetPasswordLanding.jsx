import React, { useEffect, useState } from 'react';

export default function ResetPasswordLanding() {
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [status, setStatus] = useState({ type: '', msg: '' });
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setEmail(params.get('email') || '');
    setToken(params.get('token') || '');
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      return setStatus({ type: 'error', msg: 'Passwords do not match.' });
    }
    if (newPassword.length < 6) {
      return setStatus({ type: 'error', msg: 'Password must be at least 6 characters.' });
    }

    setLoading(true);
    setStatus({ type: '', msg: '' });

    try {
      const response = await fetch('http://localhost:5000/api/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, token, newPassword })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Reset failed.');
      }

      setStatus({ type: 'success', msg: 'Password updated successfully!' });
      setDone(true);

      setTimeout(() => {
        window.location.href = '/';
      }, 2500);

    } catch (err) {
      setStatus({ type: 'error', msg: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      width: '100vw', height: '100vh', background: '#0B1120',
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <div style={{
        width: '420px', background: '#1E293B', borderRadius: '12px',
        border: '1px solid #334155', padding: '40px',
        boxShadow: '0 20px 40px rgba(0,0,0,0.4)'
      }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: '#1E3A8A' }}></div>
          <span style={{ color: '#ffffff', fontSize: '20px', fontWeight: 'bold' }}>Cabuyao Health</span>
        </div>

        <h2 style={{ color: '#ffffff', fontSize: '26px', fontWeight: '700', margin: '0 0 8px 0' }}>
          Set New Password
        </h2>
        <p style={{ color: '#9CA3AF', fontSize: '14px', margin: '0 0 28px 0' }}>
          Enter your new password below for:
          <br />
          <span style={{ color: '#10B981', fontWeight: '500' }}>{email}</span>
        </p>

        {/* Status Messages */}
        {status.msg && (
          <div style={{
            padding: '12px 16px', borderRadius: '8px', marginBottom: '20px', fontSize: '14px',
            background: status.type === 'error' ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)',
            border: `1px solid ${status.type === 'error' ? '#ef4444' : '#10b981'}`,
            color: status.type === 'error' ? '#ef4444' : '#10b981'
          }}>
            {status.type === 'success' ? '✅ ' : '❌ '}{status.msg}
            {done && (
              <span style={{ display: 'block', fontSize: '12px', marginTop: '4px', color: '#9CA3AF' }}>
                Redirecting to login...
              </span>
            )}
          </div>
        )}

        {!done && (
          <form onSubmit={handleSubmit}>

            {/* New Password */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block', color: '#9CA3AF', fontSize: '13px',
                fontWeight: '500', marginBottom: '8px'
              }}>
                New Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showNew ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  style={{
                    width: '100%', padding: '12px 44px 12px 14px',
                    background: '#0F172A', border: '1px solid #334155',
                    borderRadius: '8px', color: '#ffffff', fontSize: '14px',
                    boxSizing: 'border-box', outline: 'none'
                  }}
                />
                <button type="button" onClick={() => setShowNew(!showNew)} style={{
                  position: 'absolute', right: '14px', top: '50%',
                  transform: 'translateY(-50%)', background: 'none',
                  border: 'none', cursor: 'pointer', color: '#9CA3AF', fontSize: '16px'
                }}>
                  {showNew ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div style={{ marginBottom: '28px' }}>
              <label style={{
                display: 'block', color: '#9CA3AF', fontSize: '13px',
                fontWeight: '500', marginBottom: '8px'
              }}>
                Confirm New Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  style={{
                    width: '100%', padding: '12px 44px 12px 14px',
                    background: '#0F172A', border: '1px solid #334155',
                    borderRadius: '8px', color: '#ffffff', fontSize: '14px',
                    boxSizing: 'border-box', outline: 'none'
                  }}
                />
                <button type="button" onClick={() => setShowConfirm(!showConfirm)} style={{
                  position: 'absolute', right: '14px', top: '50%',
                  transform: 'translateY(-50%)', background: 'none',
                  border: 'none', cursor: 'pointer', color: '#9CA3AF', fontSize: '16px'
                }}>
                  {showConfirm ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>

              {/* Live match indicator */}
              {confirmPassword && (
                <p style={{
                  fontSize: '12px', marginTop: '6px',
                  color: newPassword === confirmPassword ? '#10b981' : '#ef4444'
                }}>
                  {newPassword === confirmPassword ? '✓ Passwords match' : '✗ Passwords do not match'}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', padding: '14px',
                background: loading ? '#065f46' : '#10B981',
                color: '#ffffff', border: 'none', borderRadius: '8px',
                fontSize: '15px', fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'background 0.2s'
              }}
            >
              {loading ? 'Updating...' : 'Apply New Password'}
            </button>
          </form>
        )}

      </div>
    </div>
  );
}
