import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function RecoverAccount() {
  const navigate = useNavigate();
  const [step, setStep] = useState('request'); // 'request', 'otp_verify', 'new_password'
  const [method, setMethod] = useState('email'); // 'email' or 'mobile'
  const [identity, setIdentity] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [status, setStatus] = useState({ type: '', msg: '' });

  // Handle the initial request (Requesting the link or the OTP)
  const handleRequest = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('http://localhost:5000/api/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identity, method }),
      });
      
      if (!response.ok) throw new Error('Failed to send request.');

      if (method === 'email') {
        setStatus({ type: 'success', msg: 'Recovery link sent to your email address.' });
      } else {
        setStep('otp_verify'); // Move to OTP entry if mobile
      }
    } catch (err) {
      setStatus({ type: 'error', msg: err.message });
    }
  };

  return (
    <div style={containerStyle}>
      <div style={rightPaneStyle}>
        <div style={cardWrapperStyle}>
          <h2 style={{ color: 'white', marginBottom: '8px' }}>Recover Account</h2>
          <p style={{ color: '#9ca3af', marginBottom: '20px', fontSize: '14px' }}>
            {method === 'email' 
              ? "Enter your registered email to receive recovery instructions." 
              : "Enter your mobile number to receive an OTP code."}
          </p>

          {/* METHOD TOGGLE */}
          <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
            <button onClick={() => setMethod('email')} style={method === 'email' ? activeBtn : inactiveBtn}>Email</button>
            <button onClick={() => setMethod('mobile')} style={method === 'mobile' ? activeBtn : inactiveBtn}>Mobile</button>
          </div>

          {status.msg && <div style={{ color: status.type === 'error' ? '#ef4444' : '#10b981', marginBottom: '15px', fontSize: '14px' }}>{status.msg}</div>}

          {/* STEP 1: REQUEST */}
          {step === 'request' && (
            <form onSubmit={handleRequest}>
              <input 
                type="text" 
                placeholder={method === 'email' ? "name@cabuyaohealth.gov.ph" : "09123456789"} 
                value={identity} 
                onChange={(e) => setIdentity(e.target.value)} 
                style={inputStyle} 
                required 
              />
              <button type="submit" style={actionBtn}>
                {method === 'email' ? 'Send Recovery Link' : 'Send OTP'}
              </button>
            </form>
          )}

          {/* ADD YOUR OTP_VERIFY AND NEW_PASSWORD STEPS HERE SIMILAR TO YOUR PREVIOUS CODE */}
          
          <p onClick={() => navigate('/login')} style={backLink}>← Back to Login</p>
        </div>
      </div>
    </div>
  );
}

// Minimal Styles (matching your existing dark theme)
const containerStyle = { display: 'flex', height: '100vh', background: '#0B111E', justifyContent: 'center' };
const rightPaneStyle = { width: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#111827' };
const cardWrapperStyle = { width: '85%' };
const inputStyle = { width: '100%', padding: '12px', marginBottom: '15px', borderRadius: '6px', background: '#1f2937', color: 'white', border: '1px solid #374151', boxSizing: 'border-box' };
const actionBtn = { width: '100%', padding: '12px', background: '#10B981', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' };
const activeBtn = { flex: 1, padding: '10px', background: '#10B981', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' };
const inactiveBtn = { flex: 1, padding: '10px', background: '#1f2937', color: '#9ca3af', border: 'none', borderRadius: '6px', cursor: 'pointer' };
const backLink = { color: '#10B981', cursor: 'pointer', textAlign: 'center', marginTop: '20px', fontSize: '14px' };