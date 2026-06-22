import React, { useEffect, useState } from 'react';

export default function Verify2FALanding() {
  const [status, setStatus] = useState('verifying'); // 'verifying' | 'success' | 'error'
  const [message, setMessage] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const userId = params.get('userId');

    if (!token || !userId) {
      setStatus('error');
      setMessage('Invalid verification link.');
      return;
    }

    fetch('http://localhost:5000/api/verify-2fa-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, token })
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Verification failed.');
        setStatus('success');
        setMessage(data.message || '2FA has been activated for your account.');
      })
      .catch((err) => {
        setStatus('error');
        setMessage(err.message);
      });
  }, []);

  return (
    <div style={{
      width: '100vw', height: '100vh', background: '#0B1120',
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <div style={{
        width: '420px', background: '#1E293B', borderRadius: '12px',
        border: '1px solid #334155', padding: '40px',
        boxShadow: '0 20px 40px rgba(0,0,0,0.4)', textAlign: 'center'
      }}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginBottom: '28px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: '#1E3A8A' }}></div>
          <span style={{ color: '#ffffff', fontSize: '20px', fontWeight: 'bold' }}>Cabuyao Health</span>
        </div>

        {status === 'verifying' && (
          <>
            <div style={{ fontSize: '40px', marginBottom: '16px' }}>⏳</div>
            <h2 style={{ color: '#ffffff', fontSize: '22px', fontWeight: '700', margin: '0 0 8px 0' }}>
              Verifying your email...
            </h2>
            <p style={{ color: '#9CA3AF', fontSize: '14px', margin: 0 }}>
              Please wait a moment.
            </p>
          </>
        )}

        {status === 'success' && (
          <>
            <div style={{ fontSize: '40px', marginBottom: '16px' }}>✅</div>
            <h2 style={{ color: '#ffffff', fontSize: '22px', fontWeight: '700', margin: '0 0 12px 0' }}>
              Two-Factor Authentication Enabled
            </h2>
            <p style={{ color: '#9CA3AF', fontSize: '14px', margin: '0 0 24px 0', lineHeight: '1.6' }}>
              {message}
              <br />
              From now on, you'll receive a 6-digit code by email every time you log in.
            </p>
            <button
              onClick={() => { window.location.href = '/'; }}
              style={{
                width: '100%', padding: '14px',
                background: '#10B981', color: '#ffffff', border: 'none',
                borderRadius: '8px', fontSize: '15px', fontWeight: '600', cursor: 'pointer'
              }}
            >
              Return to Login
            </button>
          </>
        )}

        {status === 'error' && (
          <>
            <div style={{ fontSize: '40px', marginBottom: '16px' }}>❌</div>
            <h2 style={{ color: '#ffffff', fontSize: '22px', fontWeight: '700', margin: '0 0 12px 0' }}>
              Verification Failed
            </h2>
            <p style={{ color: '#ef4444', fontSize: '14px', margin: '0 0 24px 0' }}>
              {message}
            </p>
            <button
              onClick={() => { window.location.href = '/'; }}
              style={{
                width: '100%', padding: '14px',
                background: '#334155', color: '#ffffff', border: 'none',
                borderRadius: '8px', fontSize: '15px', fontWeight: '600', cursor: 'pointer'
              }}
            >
              Back to Login
            </button>
          </>
        )}
      </div>
    </div>
  );
}