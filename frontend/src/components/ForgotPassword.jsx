import React, { useState } from 'react';
import { API_URL } from '../config';

export default function ForgotPasswordModal({ onClose }) {
  const [identity, setIdentity] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!identity.trim()) return setError('Please fill in your identifier field.');
    
    setError('');
    setLoading(true);
    try {
      const response = await fetch(API_URL + '/api/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identity }),
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Request processing error.');

      setMessage('A secure password reset hyperlink has been dispatched to your registered email account.');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
      backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
    }}>
      <div style={{
        width: '420px', padding: '32px', background: 'var(--bg)', 
        border: '1px solid var(--border)', borderRadius: '12px', boxShadow: 'var(--shadow)',
        textAlign: 'left', color: 'var(--text)'
      }}>
        
        <h2 style={{ color: 'var(--text-h)', marginBottom: '16px' }}>Account Recovery</h2>
        
        {message && <div style={{ color: '#10b981', background: 'var(--accent-bg)', padding: '10px', borderRadius: '6px', marginBottom: '16px', fontSize: '14px' }}>{message}</div>}
        {error && <div style={{ color: '#ef4444', background: 'rgba(239,68,68,0.1)', padding: '10px', borderRadius: '6px', marginBottom: '16px', fontSize: '14px' }}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <p style={{ fontSize: '14px', marginBottom: '16px' }}>Enter your email address or username to receive a password reset link.</p>
          
          <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: 'var(--text-h)', marginBottom: '6px' }}>Account Identifier</label>
          <input 
            type="text" 
            placeholder="Username or Email"
            value={identity} 
            onChange={(e) => setIdentity(e.target.value)}
            style={inputStyle}
          />

          <div style={{ display: 'flex', justifyContent: 'end', gap: '12px', marginTop: '24px' }}>
            <button type="button" onClick={onClose} style={cancelButtonStyle}>Cancel</button>
            <button type="submit" disabled={loading} style={submitButtonStyle}>
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}

const inputStyle = {
  width: '100%', height: '42px', padding: '0 12px', border: '1px solid var(--border)',
  borderRadius: '6px', background: 'var(--code-bg)', color: 'var(--text-h)', boxSizing: 'border-box'
};

const submitButtonStyle = {
  padding: '10px 16px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer'
};

const cancelButtonStyle = {
  padding: '10px 16px', background: 'transparent', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '6px', cursor: 'pointer'
};
