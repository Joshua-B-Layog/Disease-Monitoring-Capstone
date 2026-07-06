  import React, { useState, useEffect, useRef } from 'react';
  import { API_URL } from '../config';
  import ChoLogoIcon from '../assets/ChoLogo';

  export default function Login({ onLoginSuccess, onForgotPassword, theme, toggleTheme }) {
    const [step, setStep] = useState('role'); // 'role', 'cho_select', 'bhw_select', 'auth', 'forgot_password', 'signup', 'cho_contact'
    const [pendingUser, setPendingUser] = useState(null); // holds session data while waiting for OTP
    const [loginOtp, setLoginOtp] = useState('');
    const [otpError, setOtpError] = useState('');
    const [otpLoading, setOtpLoading] = useState(false);
    const [selectedRole, setSelectedRole] = useState('CHO'); 
    const [selectedContext, setSelectedContext] = useState(''); 
    
    // Login Form States
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loginError, setLoginError] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);

    // Forgot Password States
    const [recoveryIdentity, setRecoveryIdentity] = useState('');
    const [recoverySuccess, setRecoverySuccess] = useState('');

    // Sign-Up Form States
    const [signupName, setSignupName] = useState('');
    const [signupUsername, setSignupUsername] = useState('');
    const [signupEmail, setSignupEmail] = useState('');
    const [signupPassword, setSignupPassword] = useState('');
    const [signupConfirmPassword, setSignupConfirmPassword] = useState('');
    const [signupRole, setSignupRole] = useState('BHW');
    const [signupContext, setSignupContext] = useState('');
    const [signupError, setSignupError] = useState('');
    const [signupSuccess, setSignupSuccess] = useState('');
    const [signupMobile, setSignupMobile] = useState('');
    const [showSignupPassword, setShowSignupPassword] = useState(false);
    const [signupBarangayOpen, setSignupBarangayOpen] = useState(false);
    const signupBarangayRef = useRef(null);
    const [showSignupConfirm, setShowSignupConfirm] = useState(false);
    const [barangayList, setBarangayList] = useState([]);

    const cabuyaoBarangays = [
      { name: 'Barangay Uno (Poblacion)', district: 'CHO I' },
      { name: 'Barangay Dos (Poblacion)', district: 'CHO I' },
      { name: 'Barangay Tres (Poblacion)', district: 'CHO I' },
      { name: 'Sala', district: 'CHO I' },
      { name: 'Bigaa', district: 'CHO I' },
      { name: 'Butong', district: 'CHO I' },
      { name: 'Marinig', district: 'CHO I' },
      { name: 'Gulod', district: 'CHO I' },
      { name: 'Niugan', district: 'CHO I' },
      { name: 'Baclaran', district: 'CHO I' },
      { name: 'Pulo', district: 'CHO II' },
      { name: 'Banay-Banay', district: 'CHO II' },
      { name: 'Banlic', district: 'CHO II' },
      { name: 'Mamatid', district: 'CHO II' },
      { name: 'San Isidro', district: 'CHO II' },
      { name: 'Diezmo', district: 'CHO II' },
      { name: 'Pittland', district: 'CHO II' },
      { name: 'Casile', district: 'CHO II' },
    ];

    // --- REMEMBER ME LOCAL STORAGE INITIALIZATION ---
    useEffect(() => {
      const savedEmail = localStorage.getItem('remembered_user_email');
      const rememberChecked = localStorage.getItem('remember_me_status') === 'true';
      if (rememberChecked && savedEmail) {
        setEmail(savedEmail);
        setRememberMe(true);
      }
    }, []
  );

    useEffect(() => {
      fetch(API_URL + '/api/barangays')
        .then(res => res.json())
        .then(data => setBarangayList(data))
        .catch(err => console.error('Could not load barangays:', err));
    }, []
  );

    useEffect(() => {
      const handler = (e) => {
        if (signupBarangayRef.current && !signupBarangayRef.current.contains(e.target)) {
          setSignupBarangayOpen(false);
        }
      };
      document.addEventListener('mousedown', handler);
      return () => document.removeEventListener('mousedown', handler);
    }, []);



    const handleRoleSelection = (role) => {
      setSelectedRole(role);
      if (role === 'CHO') {
        setStep('cho_select');
      } else {
        setStep('bhw_select');
      }
    };

    const handleChoSelection = (choUnit) => {
      setSelectedContext(choUnit);
      setStep('auth');
    };

    const handleBhwProceed = () => {
      if (!selectedContext) {
        setLoginError('Please select your assigned barangay to proceed.');
        return;
      }
      setLoginError('');
      setStep('auth');
    };

    const handleFormSubmit = async (e) => {
    e.preventDefault();
    setLoginError('');

    // ── Capture device info from user agent ──
    const getDeviceInfo = () => {
        const ua = navigator.userAgent;
        let browser = 'Browser';
        let os = 'Device';

        if (ua.includes('Chrome') && !ua.includes('Edg')) browser = 'Chrome';
        else if (ua.includes('Firefox')) browser = 'Firefox';
        else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';
        else if (ua.includes('Edg')) browser = 'Edge';

        if (ua.includes('Windows')) os = 'Windows';
        else if (ua.includes('Android')) os = 'Android';
        else if (ua.includes('iPhone')) os = 'iPhone';
        else if (ua.includes('iPad')) os = 'iPad';
        else if (ua.includes('Mac')) os = 'Mac';
        else if (ua.includes('Linux')) os = 'Linux';

        return `${browser} on ${os}`;
    };

    // ── Capture location from IP ──
    const getLocation = async () => {
        try {
            const res = await fetch('https://ipapi.co/json/');
            if (!res.ok) throw new Error('geo failed');
            const data = await res.json();
            return `${data.city || 'Unknown'}, ${data.region || ''}, ${data.country_name || ''}`.trim();
        } catch {
            return 'Cabuyao, Calabarzon, Philippines';
        }
    };

    try {
        const device = getDeviceInfo();
        const location = 'Cabuyao, Calabarzon, Philippines';

        const response = await fetch(API_URL + '/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                email: email, 
                password: password, 
                role: selectedRole,
                context: selectedContext,
                device: device,
                location: location
            }),
        });

        const data = await response.json();

       if (response.ok) {
            if (rememberMe) {
                localStorage.setItem('remembered_user_email', email);
                localStorage.setItem('remember_me_status', 'true');
            } else {
                localStorage.removeItem('remembered_user_email');
                localStorage.removeItem('remember_me_status');
            }

            const sessionPayload = {
                id: data.user.id,
                role: selectedRole,
                context: selectedContext,
                username: email,
                name: data.user.name,
                barangay: data.user.barangay
            };

            if (data.requires2FA) {
                // Hold off on logging in — send OTP and move to verification step
                setPendingUser(sessionPayload);
                try {
                    await fetch(API_URL + '/api/send-login-otp', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ userId: data.user.id })
                    });
                } catch (e) { /* fallback OTP will print server-side */ }
                setStep('otp_login');
            } else {
                onLoginSuccess(sessionPayload);
            }
        } else {
            setLoginError(data.error || 'Invalid credentials or account not found.');
        }
    } catch (error) {
        console.error("Transmission Error:", error);
        setLoginError('Cannot connect to surveillance gateway. Confirm backend runtime.');
    }
};

const handleLoginOtpSubmit = async (e) => {
    e.preventDefault();
    setOtpError('');
    if (loginOtp.length !== 6) {
        setOtpError('Please enter the 6-digit code sent to your email.');
        return;
    }
    setOtpLoading(true);
    try {
        const response = await fetch(API_URL + '/api/verify-login-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: pendingUser.id, otp: loginOtp })
        });
        const data = await response.json();
        if (response.ok) {
            onLoginSuccess(pendingUser);
        } else {
            setOtpError(data.error || 'Invalid or expired code.');
        }
    } catch (error) {
        setOtpError('Could not reach the verification service.');
    } finally {
        setOtpLoading(false);
    }
};

    const getPasswordStrength = (pw) => {
      if (!pw || pw.length < 7) return 'low';
      const hasUpper = /[A-Z]/.test(pw);
      const hasNumber = /[0-9]/.test(pw);
      const hasSpecial = /[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\\/;'`~]/.test(pw);
      if (hasUpper && hasNumber && hasSpecial) return 'strong';
      if (!hasUpper && !hasSpecial) return 'low';
      return 'medium';
    };

    // --- REGISTER ACCOUNT SUBMISSION ---
    const handleSignupSubmit = async (e) => {
    e.preventDefault();
    setSignupError('');
    setSignupSuccess('');

    if (signupPassword !== signupConfirmPassword) {
        setSignupError('Passwords do not match.');
        return;
    }
    if (getPasswordStrength(signupPassword) === 'low') {
        setSignupError('Password is too weak. Use at least 7 characters with uppercase, number, and special character.');
        return;
    }
    if (signupMobile && signupMobile.length < 10) {
        setSignupError('Please enter a valid mobile number (at least 10 digits).');
        return;
    }

    try {
        const response = await fetch(API_URL + '/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: signupName,
                username: signupUsername,
                email: signupEmail,
                mobile: signupMobile,
                password: signupPassword,
                role: signupRole,
                context: signupContext
            })
        });

        if (response.ok) {
            setSignupError('');
            setSignupSuccess('Account registered successfully! Redirecting to login...');

            // Keep form fields visible as-submitted during the redirect delay,
            // then clear everything once we navigate back to role selection.
            setTimeout(() => {
                setSignupName('');
                setSignupUsername('');
                setSignupEmail('');
                setSignupMobile('');
                setSignupPassword('');
                setSignupConfirmPassword('');
                setSignupRole('CHO');
                setSignupContext('');
                setSignupSuccess('');
                setSelectedContext('');
                setSelectedRole('CHO');
                setStep('role'); // ← back to the very beginning
            }, 2000);

        } else {
            const errData = await response.json();
            setSignupError(errData.message || 'Registration failed.');
        }
    } catch (error) {
        console.error("Registration Transmission Error:", error);
        setSignupError('Unable to reach server.');
    }
  };

    const handleRecoverySubmit = async (e) => {
      e.preventDefault();
      setRecoverySuccess('');
      setLoginError('');
      
      if (!recoveryIdentity.trim()) {
        setLoginError('Please enter your email or username.');
        return;
      }

      try {
        const response = await fetch(API_URL + '/api/forgot-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identity: recoveryIdentity })
        });

        if (response.ok) {
          setRecoverySuccess('A password reset link has been sent to your registered email.');
        } else {
          const data = await response.json();
          setLoginError(data.error || 'Account lookup failed.');
        }
      } catch (error) {
        setLoginError('Connection error. Check your backend server.');
      }
    };

    const handleBackNavigation = () => {
      setRecoveryIdentity('');
      setLoginError('');
      setSignupError('');
      setRecoverySuccess('');


      if (step === 'auth') {
        if (!rememberMe) {
          setEmail('');
          setPassword('');
        }
      }
      
      if (step === 'signup' || step === 'cho_contact') {
        if (selectedContext) {
          setStep('auth');
        } else {
          setStep('role');
        }
      } else if (step === 'cho_select' || step === 'bhw_select') {
        setStep('role');
        setSelectedContext('');
      } else if (step === 'auth') {
        setStep(selectedRole === 'CHO' ? 'cho_select' : 'bhw_select');
      } else if (step === 'forgot_password') {
        setStep('auth');
      }
    };

    return (
      <div className="login-screen">
        <button onClick={toggleTheme} className="theme-toggle-btn" style={{ position: 'absolute', top: '20px', right: '20px', zIndex: 100 }}>
          {theme === 'dark' ? '☀️ Light Mode' : '🌙 Dark Mode'}
        </button>

        <div className="login-left"></div>

        <div className="login-right">
          <div className="login-form-container">
            
            <div className="brand-logo" style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '30px' }}>
              <div className="circle-logo" style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#1E3A8A', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}><ChoLogoIcon size={32} /></div>
              <div className="brand-text" style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--text-main)' }}>
                Cabuyao Health
              </div>
            </div>

            {/* STEP 1: PORTAL ROUTING */}
            {step === 'role' && (
              <>
                <div className="login-header" style={{ marginBottom: '30px', textAlign: 'left' }}>
                  <h2 style={{ fontSize: '28px', color: 'var(--text-main)', marginBottom: '8px' }}>Welcome back</h2>
                  <p style={{ color: 'var(--text-muted)' }}>Select your system surveillance portal access group.</p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <button type="button" onClick={() => handleRoleSelection('CHO')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px', background: 'rgba(30, 58, 138, 0.15)', border: '1px solid #1E3A8A', borderRadius: '8px', cursor: 'pointer', textAlign: 'left', width: '100%' }}>
                    <div>
                      <div style={{ color: 'var(--text-main)', fontWeight: '600', fontSize: '16px' }}>City Health Office (CHO)</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '2px' }}>Central Systems & Analytics</div>
                    </div>
                    <span style={{ fontSize: '20px' }}>🏢</span>
                  </button>

                  <button type="button" onClick={() => handleRoleSelection('BHW')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid #10B981', borderRadius: '8px', cursor: 'pointer', textAlign: 'left', width: '100%' }}>
                    <div>
                      <div style={{ color: 'var(--text-main)', fontWeight: '600', fontSize: '16px' }}>Barangay Health Worker</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '2px' }}>Community Surveillance Data Entry</div>
                    </div>
                    <span style={{ fontSize: '20px' }}>📍</span>
                  </button>
                </div>
              </>
            )}

            {/* STEP 2A: CHO HUB LOCATIONS */}
            {step === 'cho_select' && (
              <>
                <div className="login-header" style={{ marginBottom: '25px', textAlign: 'left' }}>
                  <button type="button" onClick={handleBackNavigation} style={{ background: 'none', border: 'none', color: '#10B981', cursor: 'pointer', fontSize: '14px', fontWeight: '500', marginBottom: '10px', padding: 0 }}>← Back</button>
                  <h2 style={{ fontSize: '26px', color: 'var(--text-main)', marginBottom: '6px' }}>Select Health Unit</h2>
                  <p style={{ color: 'var(--text-muted)' }}>Identify your current administrative station hub.</p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <button type="button" onClick={() => handleChoSelection('CHO Unit I (Sala)')} style={{ padding: '16px', background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-main)', fontWeight: '600', cursor: 'pointer', textAlign: 'left', width: '100%' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '16px' }}>CHO Unit I (Main)</span>
                      <span style={{ fontSize: '11px', background: '#1e3a8a', color: '#93c5fd', padding: '2px 6px', borderRadius: '4px' }}>CHO 1 Hub</span>
                    </div>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '400', display: 'block', marginTop: '6px' }}>
                      City Hall Complex, F.B. Bailon St., Brgy. Sala
                    </span>
                  </button>
                  
                  <button type="button" onClick={() => handleChoSelection('CHO Unit II (Pulo)')} style={{ padding: '16px', background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-main)', fontWeight: '600', cursor: 'pointer', textAlign: 'left', width: '100%' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '16px' }}>CHO Unit II (Extension)</span>
                      <span style={{ fontSize: '11px', background: '#1e3a8a', color: '#93c5fd', padding: '2px 6px', borderRadius: '4px' }}>CHO 2 Hub</span>
                    </div>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '400', display: 'block', marginTop: '6px' }}>
                      National Highway, Brgy. Pulo (Beside Centro Mall)
                    </span>
                  </button>
                </div>
              </>
            )}

            {/* STEP 2B: BHW REGISTRY BLOCK */}
            {step === 'bhw_select' && (
              <>
                <div className="login-header" style={{ marginBottom: '20px', textAlign: 'left' }}>
                  <button type="button" onClick={handleBackNavigation} style={{ background: 'none', border: 'none', color: '#10B981', cursor: 'pointer', fontSize: '14px', fontWeight: '500', marginBottom: '10px', padding: 0 }}>← Back</button>
                  <h2 style={{ fontSize: '26px', color: 'var(--text-main)', marginBottom: '6px' }}>Assigned Locality</h2>
                  <p style={{ color: 'var(--text-muted)' }}>Select your designated community operations sector.</p>
                </div>

                {loginError && (
                  <div style={{ backgroundColor: '#fee2e2', color: '#ef4444', padding: '10px', borderRadius: '6px', marginBottom: '15px', fontSize: '14px', border: '1px solid #fca5a5' }}>
                    {loginError}
                  </div>
                )}

                <div style={{ background: 'var(--input-bg)', border: '1px solid var(--border-color)', borderRadius: '8px', maxHeight: '220px', overflowY: 'auto', marginBottom: '24px', padding: '4px', textAlign: 'left' }}>
                  {cabuyaoBarangays.map((b) => (
                    <div key={b.name} onClick={() => { setSelectedContext(`Brgy. ${b.name}`); setLoginError(''); }} style={{
                      padding: '12px', cursor: 'pointer', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '2px 0',
                      background: selectedContext === `Brgy. ${b.name}` ? '#10B981' : 'transparent', color: selectedContext === `Brgy. ${b.name}` ? '#ffffff' : 'var(--text-main)'
                    }}>
                      <span style={{ fontWeight: selectedContext === `Brgy. ${b.name}` ? '600' : '400' }}>Brgy. {b.name}</span>
                      <span style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '4px', background: 'rgba(0,0,0,0.2)', color: selectedContext === `Brgy. ${b.name}` ? '#fff' : 'var(--text-muted)' }}>{b.district}</span>
                    </div>
                  ))}
                </div>

                <button type="button" className="submit-btn" onClick={handleBhwProceed} style={{ backgroundColor: '#10B981', color: '#FFFFFF', width: '100%' }}>
                  Confirm Barangay Block
                </button>
              </>
            )}

            {/* STEP 3: API SECURED SIGN IN PANEL */}
            {step === 'auth' && (
              <>
                <div className="login-header" style={{ marginBottom: '20px', textAlign: 'left' }}>
                  <button type="button" onClick={handleBackNavigation} style={{ background: 'none', border: 'none', color: '#10B981', cursor: 'pointer', fontSize: '14px', fontWeight: '500', marginBottom: '10px', padding: 0 }}>
                    ← Scope: {selectedContext}
                  </button>
                  <h2 style={{ fontSize: '28px', color: 'var(--text-main)', marginBottom: '8px' }}>Sign-In</h2>
                  <p style={{ color: 'var(--text-muted)' }}>Please insert your account.</p>
                </div>

                <form onSubmit={handleFormSubmit}>
                  {loginError && (
                    <div style={{ backgroundColor: '#fee2e2', color: '#ef4444', padding: '10px', borderRadius: '6px', marginBottom: '15px', fontSize: '14px', border: '1px solid #fca5a5' }}>
                      {loginError}
                    </div>
                  )}

                  <div className="form-group" style={{ textAlign: 'left' }}>
                    <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-main)', fontSize: '14px', fontWeight: '500' }}>Username or Email address</label>
                    <input 
                      type="text"
                      className="form-input" 
                      placeholder="Enter your Username or Email" 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required 
                    />
                  </div>
                  
                  <div className="form-group" style={{ marginTop: '20px', textAlign: 'left' }}>
                    <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-main)', fontSize: '14px', fontWeight: '500' }}>Password</label>
                    
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <input 
                        type={showPassword ? "text" : "password"} 
                        className="form-input" 
                        placeholder="••••••••" 
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        style={{ paddingRight: '45px' }} 
                        required 
                      />
                      <button 
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        style={{
                          position: 'absolute', right: '14px', background: 'none', border: 'none',
                          cursor: 'pointer', color: 'var(--text-muted)', display: 'flex',
                          alignItems: 'center', justifyContent: 'center', padding: 0
                        }}
                      >
                        {showPassword ? (
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        ) : (
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                            <line x1="1" y1="1" x2="23" y2="23" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="form-options" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '20px 0' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-main)', cursor: 'pointer', fontSize: '14px' }}>
                      <input 
                        type="checkbox" 
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        style={{ accentColor: '#10B981', width: '16px', height: '16px' }} 
                      /> 
                      Remember me
                    </label>
                    <span onClick={() => setStep('forgot_password')} style={{ color: '#10B981', cursor: 'pointer', fontSize: '14px', fontWeight: '500' }}>
                      Forgot password?
                    </span>
                  </div>

                  <button type="submit" className="submit-btn" style={{ backgroundColor: '#10B981', color: '#FFFFFF', marginTop: '10px' }}>
                    Sign In as {selectedRole}
                  </button>
                </form>
              </>
            )}

            {/* STEP 3.5: LOGIN OTP VERIFICATION */}
            {step === 'otp_login' && (
  <>
    <div className="login-header" style={{ marginBottom: '20px', textAlign: 'left' }}>
      <h2 style={{ fontSize: '28px', color: 'var(--text-main)', marginBottom: '8px' }}>Verify It's You</h2>
      <p style={{ color: 'var(--text-muted)' }}>
        We sent a 6-digit code to your registered email. Enter it below to complete sign-in.
      </p>
    </div>
    <form onSubmit={handleLoginOtpSubmit}>
      {otpError && (
        <div style={{ backgroundColor: '#fee2e2', color: '#ef4444', padding: '10px', borderRadius: '6px', marginBottom: '15px', fontSize: '14px', border: '1px solid #fca5a5' }}>
          {otpError}
        </div>
      )}
      <div className="form-group" style={{ textAlign: 'left' }}>
        <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-main)', fontSize: '14px', fontWeight: '500' }}>
          Verification Code
        </label>
        <input
          type="text"
          className="form-input"
          placeholder="Enter 6-digit code"
          maxLength="6"
          value={loginOtp}
          onChange={(e) => setLoginOtp(e.target.value.replace(/\D/g, ''))}
          style={{ letterSpacing: '6px', textAlign: 'center', fontSize: '20px', fontWeight: 'bold' }}
          required
          autoFocus
        />
      </div>
      <button
        type="submit"
        disabled={otpLoading}
        className="submit-btn"
        style={{ backgroundColor: '#10B981', color: '#FFFFFF', marginTop: '20px' }}
      >
        {otpLoading ? 'Verifying...' : 'Verify & Continue'}
      </button>
    </form>
    <div style={{ marginTop: '16px', textAlign: 'center' }}>
      <span
        onClick={async () => {
          if (!pendingUser) return;
          try {
            await fetch(`${API_URL}/api/send-login-otp`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userId: pendingUser.id })
            });
            setOtpError('A new code has been sent to your email.');
          } catch {
            setOtpError('Failed to resend code. Please try again.');
          }
        }}
        style={{ color: '#10B981', cursor: 'pointer', fontSize: '14px', fontWeight: '500' }}
      >
        Resend Code
      </span>
    </div>
  </>
)}

            {/* STEP: CHO CONTACT INFO (no self-registration for CHO) */}
            {step === 'cho_contact' && (
              <>
                <div className="login-header" style={{ marginBottom: '20px', textAlign: 'left' }}>
                  <button type="button" onClick={handleBackNavigation} style={{ background: 'none', border: 'none', color: '#10B981', cursor: 'pointer', fontSize: '14px', fontWeight: '500', marginBottom: '10px', padding: 0 }}>← Back</button>
                  <h2 style={{ fontSize: '26px', color: 'var(--text-main)', marginBottom: '8px' }}>CHO Account Access</h2>
                  <p style={{ color: 'var(--text-muted)', lineHeight: '1.6' }}>
                    For security purposes, City Health Office accounts cannot be created through self-registration. Please contact your CHO unit directly to request an account.
                  </p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ padding: '18px', background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '8px', textAlign: 'left' }}>
                    <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-main)', marginBottom: '10px' }}>
                      CHO Unit I (Main - Sala)
                    </div>
                    <div style={{ fontSize: '14px', color: 'var(--text-main)', marginBottom: '6px' }}>
                      📞 Contact Number: <span style={{ color: '#10B981', fontWeight: '600' }}>09478891074</span>
                    </div>
                    <div style={{ fontSize: '14px', color: 'var(--text-main)' }}>
                      ✉️ Email: <span style={{ color: '#10B981', fontWeight: '600' }}>idkwutishappen@gmail.com</span>
                    </div>
                  </div>

                  <div style={{ padding: '18px', background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '8px', textAlign: 'left' }}>
                    <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-main)', marginBottom: '10px' }}>
                      CHO Unit II (Extension - Pulo)
                    </div>
                    <div style={{ fontSize: '14px', color: 'var(--text-main)', marginBottom: '6px' }}>
                      📞 Contact Number: <span style={{ color: '#10B981', fontWeight: '600' }}>09558411426</span>
                    </div>
                    <div style={{ fontSize: '14px', color: 'var(--text-main)' }}>
                      ✉️ Email: <span style={{ color: '#10B981', fontWeight: '600' }}>jhon@gmail.com</span>
                    </div>
                  </div>
                </div>

                <button type="button" onClick={() => setStep('role')} style={{ marginTop: '24px', width: '100%', padding: '12px', background: 'transparent', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'var(--text-main)', cursor: 'pointer', fontSize: '14px', fontWeight: '500' }}>
                  Back to Cabuyao Health Portal
                </button>
              </>
            )}


            {/* FORGOT PASSWORD SECTION — Email Only */}
            {step === 'forgot_password' && (
              <>
                <div className="login-header" style={{ marginBottom: '20px', textAlign: 'left' }}>
                  <button type="button" onClick={handleBackNavigation} style={{ background: 'none', border: 'none', color: '#10B981', cursor: 'pointer', fontSize: '14px', fontWeight: '500', marginBottom: '10px', padding: 0 }}>← Back to Login</button>
                  <h2 style={{ fontSize: '28px', color: 'var(--text-main)', marginBottom: '8px' }}>Recover Account</h2>
                  <p style={{ color: 'var(--text-muted)' }}>Enter your email or username to receive a password reset link.</p>
                </div>

                <form onSubmit={handleRecoverySubmit}>
                  {loginError && (
                    <div style={{ backgroundColor: '#fee2e2', color: '#ef4444', padding: '10px', borderRadius: '6px', marginBottom: '15px', fontSize: '14px', border: '1px solid #fca5a5', textAlign: 'left' }}>
                      {loginError}
                    </div>
                  )}
                  {recoverySuccess && (
                    <div style={{ backgroundColor: '#e0f2fe', color: '#0369a1', padding: '12px', borderRadius: '6px', marginBottom: '15px', fontSize: '14px', border: '1px solid #bae6fd', textAlign: 'left' }}>
                      {recoverySuccess}
                    </div>
                  )}

                  <div className="form-group" style={{ textAlign: 'left' }}>
                    <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-main)', fontSize: '14px', fontWeight: '500' }}>
                      Username or registered email address
                    </label>
                    <input 
                      type="text"
                      className="form-input" 
                      placeholder="e.g. cho_niugan or user@email.com" 
                      value={recoveryIdentity}
                      onChange={(e) => setRecoveryIdentity(e.target.value)}
                      required 
                    />
                  </div>

                  <button type="submit" className="submit-btn" style={{ backgroundColor: '#10B981', color: '#FFFFFF', marginTop: '25px', width: '100%' }}>
                    Send Recovery Link
                  </button>
                </form>
              </>
            )}

            {/* SIGN UP SECTION */}
            {step === 'signup' && (
                <>
                    <div className="login-header" style={{ marginBottom: '20px', textAlign: 'left' }}>
                        <button type="button" onClick={handleBackNavigation} style={{ background: 'none', border: 'none', color: '#10B981', cursor: 'pointer', fontSize: '14px', fontWeight: '500', marginBottom: '10px', padding: 0 }}>← Back</button>
                        <h2 style={{ fontSize: '26px', color: 'var(--text-main)', marginBottom: '6px' }}>Create Account</h2>
                        <p style={{ color: 'var(--text-muted)' }}>Register a new account for surveillance database entry.</p>
                    </div>

                    <form onSubmit={handleSignupSubmit}>
                        {signupError && (
                            <div style={{ backgroundColor: '#fee2e2', color: '#ef4444', padding: '10px', borderRadius: '6px', marginBottom: '15px', fontSize: '14px', border: '1px solid #fca5a5', textAlign: 'left' }}>
                                {signupError}
                            </div>
                        )}
                        {signupSuccess && (
                            <div style={{ backgroundColor: '#d1fae5', color: '#065f46', padding: '10px', borderRadius: '6px', marginBottom: '15px', fontSize: '14px', border: '1px solid #6ee7b7', textAlign: 'left' }}>
                                {signupSuccess}
                            </div>
                        )}

                        {/* Full Name */}
                        <div className="form-group" style={{ textAlign: 'left' }}>
                            <label style={{ display: 'block', marginBottom: '6px', color: 'var(--text-main)', fontSize: '13px', fontWeight: '500' }}>Full Name</label>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="Juan Dela Cruz"
                                value={signupName}
                                onChange={(e) => setSignupName(e.target.value)}
                                required
                            />
                        </div>

                        {/* Username */}
                        <div className="form-group" style={{ marginTop: '14px', textAlign: 'left' }}>
                            <label style={{ display: 'block', marginBottom: '6px', color: 'var(--text-main)', fontSize: '13px', fontWeight: '500' }}>Username</label>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="e.g. juandelacruz"
                                value={signupUsername}
                                onChange={(e) => setSignupUsername(e.target.value)}
                                required
                            />
                        </div>

                        {/* Email */}
                        <div className="form-group" style={{ marginTop: '14px', textAlign: 'left' }}>
                            <label style={{ display: 'block', marginBottom: '6px', color: 'var(--text-main)', fontSize: '13px', fontWeight: '500' }}>Email Address</label>
                            <input
                                type="email"
                                className="form-input"
                                placeholder="juan@example.com"
                                value={signupEmail}
                                onChange={(e) => setSignupEmail(e.target.value)}
                                required
                            />
                        </div>

                        {/* Mobile Number */}
                        <div className="form-group" style={{ marginTop: '14px', textAlign: 'left' }}>
                            <label style={{ display: 'block', marginBottom: '6px', color: 'var(--text-main)', fontSize: '13px', fontWeight: '500' }}>Mobile Number</label>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="09123456789"
                                value={signupMobile}
                                onChange={(e) => setSignupMobile(e.target.value.replace(/\D/g, '').slice(0, 11))}
                                maxLength={11}
                            />
                        </div>

                        {/* Assigned Station */}
                        <div className="form-group" style={{ marginTop: '14px', textAlign: 'left' }}>
                            <label style={{ display: 'block', marginBottom: '6px', color: 'var(--text-main)', fontSize: '13px', fontWeight: '500' }}>
                                Assigned Barangay
                            </label>
                            <div style={{ position: 'relative' }} ref={signupBarangayRef}>
                                <button
                                    type="button"
                                    onClick={() => setSignupBarangayOpen(!signupBarangayOpen)}
                                    style={{
                                        width: '100%', height: '42px', background: 'var(--input-bg)', color: 'var(--text-main)',
                                        border: '1px solid var(--border-color)', borderRadius: '6px', padding: '0 10px',
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        cursor: 'pointer', textAlign: 'left', fontSize: '14px'
                                    }}
                                >
                                    <span>{barangayList.find(b => String(b.id) === String(signupContext))?.name || '— Select your barangay —'}</span>
                                    <span style={{
                                        fontSize: '24px', opacity: 0.6, marginLeft: '8px',
                                        transition: 'transform 0.2s', display: 'inline-block',
                                        transform: signupBarangayOpen ? 'rotate(180deg)' : 'rotate(0deg)'
                                    }}>▾</span>
                                </button>
                                {signupBarangayOpen && (
                                    <div style={{
                                        position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200,
                                        maxHeight: '220px', overflowY: 'auto', marginTop: '4px',
                                        background: 'var(--input-bg)', border: '1px solid var(--border-color)',
                                        borderRadius: '8px', boxShadow: '0 12px 32px rgba(0,0,0,0.4)',
                                        padding: '4px'
                                    }}>
                                        {barangayList.map(b => (
                                            <div
                                                key={b.id}
                                                onClick={() => { setSignupContext(String(b.id)); setSignupBarangayOpen(false); }}
                                                style={{
                                                    padding: '9px 12px', cursor: 'pointer', fontSize: '14px', borderRadius: '6px',
                                                    background: String(signupContext) === String(b.id) ? 'rgba(16,185,129,0.15)' : 'transparent',
                                                    color: String(signupContext) === String(b.id) ? '#10B981' : 'var(--text-main)',
                                                    fontWeight: String(signupContext) === String(b.id) ? '600' : '400'
                                                }}
                                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                                                onMouseLeave={e => { e.currentTarget.style.background = String(signupContext) === String(b.id) ? 'rgba(16,185,129,0.15)' : 'transparent'; }}
                                            >
                                                {b.name}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Password */}
                        <div className="form-group" style={{ marginTop: '14px', textAlign: 'left' }}>
                            <label style={{ display: 'block', marginBottom: '6px', color: 'var(--text-main)', fontSize: '13px', fontWeight: '500' }}>Password</label>
                            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                <input
                                    type={showSignupPassword ? 'text' : 'password'}
                                    className="form-input"
                                    placeholder="••••••••"
                                    value={signupPassword}
                                    onChange={(e) => setSignupPassword(e.target.value)}
                                    style={{ paddingRight: '45px' }}
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowSignupPassword(!showSignupPassword)}
                                    style={{ position: 'absolute', right: '14px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', padding: 0 }}
                                >
                                    {showSignupPassword ? (
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                                            <line x1="1" y1="1" x2="23" y2="23"/>
                                        </svg>
                                    ) : (
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                                            <circle cx="12" cy="12" r="3"/>
                                        </svg>
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Confirm Password */}
                        <div className="form-group" style={{ marginTop: '14px', textAlign: 'left' }}>
                            <label style={{ display: 'block', marginBottom: '6px', color: 'var(--text-main)', fontSize: '13px', fontWeight: '500' }}>Confirm Password</label>
                            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                <input
                                    type={showSignupConfirm ? 'text' : 'password'}
                                    className="form-input"
                                    placeholder="••••••••"
                                    value={signupConfirmPassword}
                                    onChange={(e) => setSignupConfirmPassword(e.target.value)}
                                    style={{ paddingRight: '45px' }}
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowSignupConfirm(!showSignupConfirm)}
                                    style={{ position: 'absolute', right: '14px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', padding: 0 }}
                                >
                                    {showSignupConfirm ? (
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                                            <line x1="1" y1="1" x2="23" y2="23"/>
                                        </svg>
                                    ) : (
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                                            <circle cx="12" cy="12" r="3"/>
                                        </svg>
                                    )}
                                </button>
                            </div>
                            {signupConfirmPassword && (
                                <p style={{ fontSize: '12px', marginTop: '5px', color: signupPassword === signupConfirmPassword ? '#10b981' : '#ef4444' }}>
                                    {signupPassword === signupConfirmPassword ? '✓ Passwords match' : '✗ Passwords do not match'}
                                </p>
                            )}
                            {signupPassword && (() => {
                                const strength = getPasswordStrength(signupPassword);
                                const styles = {
                                    low: { color: '#ef4444', text: '✗ Weak — needs uppercase + number + special' },
                                    medium: { color: '#eab308', text: '~ Medium — add uppercase, number & special for strongest' },
                                    strong: { color: '#10b981', text: '✓ Strong password' },
                                };
                                const s = styles[strength];
                                return <p style={{ fontSize: '12px', marginTop: '5px', color: s.color }}>{s.text}</p>;
                            })()}
                        </div>

                        <button type="submit" className="submit-btn" style={{ backgroundColor: '#10B981', color: '#FFFFFF', marginTop: '20px', width: '100%' }}>
                            Register Account
                        </button>
                    </form>
                </>
            )}

            {/* SHARED FOOTER ROUTING */}
            {step !== 'signup' && step !== 'forgot_password' && step !== 'cho_contact' ? (
              <div style={{ marginTop: '30px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
                Don't have an account? <span onClick={() => {
                  if (selectedRole === 'CHO') {
                    setStep('cho_contact');
                    return;
                  }
                  if (selectedRole === 'BHW' && selectedContext) {
                    const barangayName = selectedContext.replace(/^Brgy\.\s*/i, '').trim();
                    const matched = barangayList.find(b => b.name === barangayName);
                    if (matched) {
                      setSignupContext(String(matched.id));
                    }
                  }
                  setStep('signup');
                }} style={{ color: '#10B981', cursor: 'pointer', fontWeight: '500' }}>Sign up</span>
              </div>
            ) : (
              step !== 'role' && step !== 'cho_contact' && (
                <div style={{ marginTop: '30px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
                  Already registered? <span onClick={() => setStep('role')} style={{ color: '#10B981', cursor: 'pointer', fontWeight: '500' }}>Sign In here</span>
                </div>
              )
            )}  

          </div>
        </div>
      </div>
    );
  }