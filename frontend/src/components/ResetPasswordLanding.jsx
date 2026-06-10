import React, { useEffect, useState } from 'react';

export default function ResetPasswordLanding() {
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState({ type: '', msg: '' });

  useEffect(() => {
    // Read secure verification values directly out of URL parameters
    const params = new URLSearchParams(window.location.search);
    setEmail(params.get('email') || '');
    setToken(params.get('token') || '');
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) return setStatus({ type: 'error', msg: 'Password fields mismatch.' });

    try {
      const response = await fetch('http://localhost:5000/api/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, token, newPassword })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Link validation expired.');

      setStatus({ type: 'success', msg: 'Credentials synchronized! You can now log into the CHO platform.' });
    } catch (err) {
      setStatus({ type: 'error', msg: err.message });
    }
  };

  return (
    <div style={{ maxWidth: '400px', margin: '80px auto', padding: '24px', border: '1px solid var(--border)', borderRadius: '8px' }}>
      <h2>Set New Password</h2>
      {status.msg && <div style={{ color: status.type === 'error' ? 'red' : 'green', marginBottom: '12px' }}>{status.msg}</div>}
      <form onSubmit={handleSubmit}>
        <input type="password" placeholder="New Password" value={newPassword} onChange={e => setNewPassword(e.target.value)} style={{ width: '100%', marginBottom: '12px', padding: '8px' }} />
        <input type="password" placeholder="Confirm Password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} style={{ width: '100%', marginBottom: '12px', padding: '8px' }} />
        <button type="submit" style={{ width: '100%', padding: '10px', background: 'var(--accent)', color: 'white', border: 'none' }}>Update Database</button>
      </form>
    </div>
  );
}