import React, { useEffect, useState } from 'react';
import { API_URL } from '../config';

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
      const response = await fetch(API_URL + '/api/reset-password', {
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
      width: '100vw', minHeight: '100vh', background: 'var(--bg-main)', padding: '24px',
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <div style={{
        width: '420px', maxWidth: '100%', background: 'var(--bg-surface)', borderRadius: '16px',
        border: '1px solid var(--border-color)', padding: '40px',
        boxShadow: '0 10px 30px rgba(0,7,104,.10)'
      }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: 'var(--primary-900, #000768)' }}></div>
          <span style={{ color: 'var(--text-main)', fontSize: '20px', fontWeight: 'bold' }}>Cabuyao Health</span>
        </div>

        <h2 style={{ color: 'var(--text-main)', fontSize: '26px', fontWeight: '700', margin: '0 0 8px 0' }}>
          Set New Password
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '15px', margin: '0 0 28px 0' }}>
          Enter your new password below for:
          <br />
          <span style={{ color: 'var(--primary-600, #000ECB)', fontWeight: '500' }}>{email}</span>
        </p>

        {/* Status Messages */}
        {status.msg && (
          <div style={{
            padding: '12px 16px', borderRadius: '8px', marginBottom: '20px', fontSize: '15px',
            background: status.type === 'error' ? 'rgba(239,68,68,0.1)' : 'rgba(0,14,203,0.1)',
            border: `1px solid ${status.type === 'error' ? '#ef4444' : 'var(--primary-600, #000ECB)'}`,
            color: status.type === 'error' ? '#ef4444' : 'var(--primary-600, #000ECB)'
          }}>
            {status.type === 'success' ? '✅ ' : '❌ '}{status.msg}
            {done && (
              <span style={{ display: 'block', fontSize: '15px', marginTop: '4px', color: 'var(--text-muted)' }}>
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
                display: 'block', color: 'var(--text-muted)', fontSize: '15px',
                fontWeight: '500', marginBottom: '8px'
              }}>
                New Password <span style={{ color: '#f87171' }}>*</span>
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
                    background: 'var(--input-bg)', border: '1px solid var(--border-color)',
                    borderRadius: '8px', color: 'var(--text-main)', fontSize: '15px',
                    boxSizing: 'border-box', outline: 'none'
                  }}
                />
                <button type="button" onClick={() => setShowNew(!showNew)} style={{
                  position: 'absolute', right: '14px', top: '50%',
                  transform: 'translateY(-50%)', background: 'none',
                  border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '16px'
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
                display: 'block', color: 'var(--text-muted)', fontSize: '15px',
                fontWeight: '500', marginBottom: '8px'
              }}>
                Confirm New Password <span style={{ color: '#f87171' }}>*</span>
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
                    background: 'var(--input-bg)', border: '1px solid var(--border-color)',
                    borderRadius: '8px', color: 'var(--text-main)', fontSize: '15px',
                    boxSizing: 'border-box', outline: 'none'
                  }}
                />
                <button type="button" onClick={() => setShowConfirm(!showConfirm)} style={{
                  position: 'absolute', right: '14px', top: '50%',
                  transform: 'translateY(-50%)', background: 'none',
                  border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '16px'
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
                  fontSize: '15px', marginTop: '6px',
                  color: newPassword === confirmPassword ? '#129968' : '#ef4444'
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
                background: loading ? 'rgba(0,14,203,.55)' : 'var(--primary-600, #000ECB)',
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
