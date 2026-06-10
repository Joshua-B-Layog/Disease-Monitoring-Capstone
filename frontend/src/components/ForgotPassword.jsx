import React, { useState } from 'react';

export default function ForgotPasswordModal({ onClose }) {
  // Navigation State: 'request' | 'otp_verify' | 'new_password'
  const [step, setStep] = useState('request'); 
  
  // Form input states
  const [identity, setIdentity] = useState('');
  const [method, setMethod] = useState('gmail'); // 'gmail' | 'mobile'
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // Status and interface logs
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  // STEP 1: Submit Identity & Method to Backend
  const handleRequestReset = async (e) => {
    e.preventDefault();
    if (!identity.trim()) return setError('Please fill in your identifier field.');
    
    setError('');
    setLoading(true);
    try {
      const response = await fetch('http://localhost:5000/api/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identity, method }),
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Request processing error.');

      if (method === 'gmail') {
        setMessage('A secure password reset hyperlink has been dispatched to your registered email account.');
        // Email users can close modal or wait; verification happens when they click the email link
      } else {
        setMessage('A secure 6-digit verification code has been dispatched to your mobile terminal.');
        setStep('otp_verify'); // Advance to code input matrix
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // STEP 2: Validate 6-Digit Mobile Code
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (otpCode.length !== 6) return setError('Please enter a valid 6-digit code.');

    setError('');
    setLoading(true);
    try {
      const response = await fetch('http://localhost:5000/api/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identity, otpCode }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'OTP verification failed.');

      setMessage('Code authorized successfully. Please configure your new access credentials.');
      setStep('new_password'); // Advance to changing password fields
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // STEP 3: Save New Credentials to Database
  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) return setError('Password entries do not match.');
    if (newPassword.length < 6) return setError('Security rule: Password must be at least 6 characters.');

    setError('');
    setLoading(true);
    try {
      const response = await fetch('http://localhost:5000/api/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: identity, newPassword }), // coordinates clean fallback syncs
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Credential updates rejected.');

      alert('Success! Your password has been updated in phpMyAdmin.');
      onClose(); // Shut down modal window container
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

        {/* VIEW STAGE 1: REQUEST INITIALIZATION */}
        {step === 'request' && (
          <form onSubmit={handleRequestReset}>
            <p style={{ fontSize: '14px', marginBottom: '16px' }}>Enter your administrative registration email, username, or phone number to clear verification flags.</p>
            
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: 'var(--text-h)', marginBottom: '6px' }}>Account Identifier</label>
            <input 
              type="text" 
              placeholder="Username, Email, or Mobile"
              value={identity} 
              onChange={(e) => setIdentity(e.target.value)}
              style={inputStyle}
            />

            <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: 'var(--text-h)', marginBottom: '6px', marginTop: '12px' }}>Recovery Dispatch Gateway</label>
            <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
              <button type="button" onClick={() => setMethod('gmail')} style={method === 'gmail' ? activeMethodStyle : inactiveMethodStyle}>
                Gmail Link
              </button>
              <button type="button" onClick={() => setMethod('mobile')} style={method === 'mobile' ? activeMethodStyle : inactiveMethodStyle}>
                Mobile OTP
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'end', gap: '12px' }}>
              <button type="button" onClick={onClose} style={cancelButtonStyle}>Cancel</button>
              <button type="submit" disabled={loading} style={submitButtonStyle}>
                {loading ? 'Processing...' : 'Send Verification'}
              </button>
            </div>
          </form>
        )}

        {/* VIEW STAGE 2: OTP MATRIX CODE INPUT */}
        {step === 'otp_verify' && (
          <form onSubmit={handleVerifyOtp}>
            <p style={{ fontSize: '14px', marginBottom: '16px' }}>Enter the secure 6-digit authentication numerical passkey printed on your terminal log:</p>
            
            <input 
              type="text" 
              maxLength="6"
              placeholder="000000"
              value={otpCode} 
              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
              style={{ ...inputStyle, letterSpacing: '8px', textAlign: 'center', fontSize: '20px', fontWeight: 'bold' }}
            />

            <div style={{ display: 'flex', justifyContent: 'end', gap: '12px', marginTop: '24px' }}>
              <button type="button" onClick={() => setStep('request')} style={cancelButtonStyle}>Back</button>
              <button type="submit" disabled={loading} style={submitButtonStyle}>
                {loading ? 'Verifying...' : 'Confirm Code'}
              </button>
            </div>
          </form>
        )}

        {/* VIEW STAGE 3: WRITE UPDATE PASSWORD */}
        {step === 'new_password' && (
          <form onSubmit={handleResetPassword}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: 'var(--text-h)', marginBottom: '6px' }}>Configure New Password</label>
            <input 
              type="password" 
              value={newPassword} 
              onChange={(e) => setNewPassword(e.target.value)}
              style={inputStyle}
            />

            <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: 'var(--text-h)', marginBottom: '6px', marginTop: '12px' }}>Confirm Password Entry</label>
            <input 
              type="password" 
              value={confirmPassword} 
              onChange={(e) => setConfirmPassword(e.target.value)}
              style={inputStyle}
            />

            <div style={{ display: 'flex', justifyContent: 'end', gap: '12px', marginTop: '24px' }}>
              <button type="submit" disabled={loading} style={{ ...submitButtonStyle, width: '100%' }}>
                {loading ? 'Saving Data...' : 'Commit New Password'}
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
}

// Inline Shared Style Formations mapped to your active global css variables
const inputStyle = {
  width: '100%', height: '42px', padding: '0 12px', border: '1px solid var(--border)',
  borderRadius: '6px', background: 'var(--code-bg)', color: 'var(--text-h)', boxSizing: 'border-box'
};

const activeMethodStyle = {
  flex: 1, padding: '10px', background: 'var(--accent)', color: '#fff', 
  border: '1px solid var(--accent)', borderRadius: '6px', cursor: 'pointer', fontWeight: '500'
};

const inactiveMethodStyle = {
  flex: 1, padding: '10px', background: 'var(--bg)', color: 'var(--text)', 
  border: '1px solid var(--border)', borderRadius: '6px', cursor: 'pointer'
};

const submitButtonStyle = {
  padding: '10px 16px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer'
};

const cancelButtonStyle = {
  padding: '10px 16px', background: 'transparent', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '6px', cursor: 'pointer'
};