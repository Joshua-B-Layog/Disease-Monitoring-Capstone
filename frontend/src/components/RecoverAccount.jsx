import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../config';
import BackButton from './BackButton';

export default function RecoverAccount() {
  const navigate = useNavigate();
  const [identity, setIdentity] = useState('');
  const [status, setStatus] = useState({ type: '', msg: '' });

  const handleRequest = async (e) => {
    e.preventDefault();
    setStatus({ type: '', msg: '' });
    try {
      const response = await fetch(API_URL + '/api/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identity }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to send request.');

      setStatus({ type: 'success', msg: data.message || 'Recovery link sent to your registered email address.' });
    } catch (err) {
      setStatus({ type: 'error', msg: err.message });
    }
  };

  return (
    <div style={containerStyle}>
      <div style={rightPaneStyle}>
        <div style={cardWrapperStyle}>
          <h2 style={{ color: 'white', marginBottom: '8px' }}>Recover Account</h2>
          <p style={{ color: '#9ca3af', marginBottom: '20px', fontSize: '15px' }}>
            Enter your registered email or username to receive a password reset link.
          </p>

          {status.msg && (
            <div style={{
              color: status.type === 'error' ? '#ef4444' : '#129968',
              background: status.type === 'error' ? 'rgba(239,68,68,0.1)' : 'rgba(18,153,104,0.1)',
              padding: '10px', borderRadius: '6px', marginBottom: '15px', fontSize: '15px',
              border: `1px solid ${status.type === 'error' ? '#ef4444' : '#129968'}`
            }}>
              {status.type === 'success' ? '✓ ' : '✗ '}{status.msg}
            </div>
          )}

          <form onSubmit={handleRequest}>
            <input
              type="text"
              placeholder="Username or email address"
              value={identity}
              onChange={(e) => setIdentity(e.target.value)}
              style={inputStyle}
              required
            />
            <button type="submit" style={actionBtn}>Send Reset Link</button>
          </form>

          <div style={{ textAlign: 'center', marginTop: '20px' }}>
            <BackButton onClick={() => navigate('/login')} color="#129968">Back to Login</BackButton>
          </div>
        </div>
      </div>
    </div>
  );
}

const containerStyle = { display: 'flex', height: '100vh', background: '#0B111E', justifyContent: 'center' };
const rightPaneStyle = { width: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#111827' };
const cardWrapperStyle = { width: '85%' };
const inputStyle = { width: '100%', padding: '12px', marginBottom: '15px', borderRadius: '6px', background: '#1f2937', color: 'white', border: '1px solid #374151', boxSizing: 'border-box', fontSize: '15px' };
const actionBtn = { width: '100%', padding: '12px', background: '#129968', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' };
