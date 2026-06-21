  import React, { useState, useEffect } from 'react';

  export default function Login({ onLoginSuccess, onForgotPassword, theme, toggleTheme }) {
    const [step, setStep] = useState('role'); // 'role', 'cho_select', 'bhw_select', 'auth', 'forgot_password', 'signup'
    const [selectedRole, setSelectedRole] = useState('CHO'); 
    const [selectedContext, setSelectedContext] = useState(''); 
    
    // Login Form States
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loginError, setLoginError] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);

    // Forgot Password States
    const [recoveryMethod, setRecoveryMethod] = useState('email'); // 'email' or 'mobile'
    const [recoverySubStep, setRecoverySubStep] = useState('request'); // 'request', 'otp_verify', 'new_password'
    const [recoveryIdentity, setRecoveryIdentity] = useState(''); // Holds email OR mobile string
    const [recoveryOtp, setRecoveryOtp] = useState('');
    const [recoveryNewPassword, setRecoveryNewPassword] = useState('');
    const [recoveryConfirmPassword, setRecoveryConfirmPassword] = useState('');
    const [recoverySuccess, setRecoverySuccess] = useState('');

    // Sign-Up Form States
    const [signupName, setSignupName] = useState('');
    const [signupEmail, setSignupEmail] = useState('');
    const [signupPassword, setSignupPassword] = useState('');
    const [signupConfirmPassword, setSignupConfirmPassword] = useState('');
    const [signupRole, setSignupRole] = useState('CHO');
    const [signupContext, setSignupContext] = useState('CHO Unit I (Sala)');
    const [signupError, setSignupError] = useState('');
    const [signupSuccess, setSignupSuccess] = useState('');
    const [signupMobile, setSignupMobile] = useState('');
    const [showSignupPassword, setShowSignupPassword] = useState(false);
    const [showSignupConfirm, setShowSignupConfirm] = useState(false);
    const [barangayList, setBarangayList] = useState([]);

    const cabuyaoBarangays = [
      { name: 'Baclaran', district: 'CHO 1' }, { name: 'Banaybanay', district: 'CHO 2' },
      { name: 'Banlic', district: 'CHO 1' }, { name: 'Bigaa', district: 'CHO 1' },
      { name: 'Butong', district: 'CHO 1' }, { name: 'Casile', district: 'CHO 2' },
      { name: 'Diezmo', district: 'CHO 2' }, { name: 'Gulod', district: 'CHO 1' },
      { name: 'Mamatid', district: 'CHO 1' }, { name: 'Marinig', district: 'CHO 1' },
      { name: 'Niugan', district: 'CHO 2' }, { name: 'Pittland', district: 'CHO 2' },
      { name: 'Pulo', district: 'CHO 2' }, { name: 'Sala', district: 'CHO 1' },
      { name: 'San Isidro', district: 'CHO 2' }, { name: 'Poblacion I', district: 'CHO 1' },
      { name: 'Poblacion II', district: 'CHO 1' }, { name: 'Poblacion III', district: 'CHO 1' }
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
      fetch('http://localhost:5000/api/barangays')
        .then(res => res.json())
        .then(data => setBarangayList(data))
        .catch(err => console.error('Could not load barangays:', err));
    }, []
  );



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

      try {
        const response = await fetch('http://localhost:5000/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            email: email, 
            password: password, 
            role: selectedRole,
            context: selectedContext 
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

          onLoginSuccess({
            id: data.user.id,
            role: selectedRole,
            context: selectedContext,
            username: email,
            name: data.user.name,
            barangay: data.user.barangay
          });
        } else {
          setLoginError('Invalid credentials or unauthorized role coordinates.');
        }
      } catch (error) {
        console.error("Transmission Error:", error);
        setLoginError('Cannot connect to surveillance gateway. Confirm backend runtime.');
      }
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
    if (signupMobile && signupMobile.length < 10) {
        setSignupError('Please enter a valid mobile number (at least 10 digits).');
        return;
    }

    try {
        const response = await fetch('http://localhost:5000/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: signupName,
                email: signupEmail,
                mobile: signupMobile,
                password: signupPassword,
                role: signupRole,
                context: signupContext
            })
        });

        if (response.ok) {
            // Clear all signup fields
            setSignupName('');
            setSignupEmail('');
            setSignupMobile('');
            setSignupPassword('');
            setSignupConfirmPassword('');
            setSignupRole('CHO');
            setSignupContext('CHO Unit I (Sala)');
            setSignupError('');

            // Show brief success then go back to role selection
            setSignupSuccess('Account registered successfully! Redirecting to login...');
            setTimeout(() => {
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

    // --- PASSWORD RECOVERY SUBMISSION ---
   // --- INTEGRATED ACCOUNT RECOVERY ENGINE ---
    const handleRecoverySubmit = async (e) => {
      e.preventDefault();
      setRecoverySuccess('');
      setLoginError('');  // Reusing loginError container for UI cleanup
      
      // PHASE 1: Initial Link Dispatch or OTP Request
      if (recoverySubStep === 'request') {
        try {
          const response = await fetch('http://localhost:5000/api/forgot-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identity: recoveryIdentity, method: recoveryMethod })
          });

          if (response.ok) {
            if (recoveryMethod === 'email') {
              setRecoverySuccess('Surveillance authorization link dispatched to your email coordinates.');
            } else {
              setRecoverySubStep('otp_verify');
              setRecoverySuccess('Secure OTP token dispatched to your mobile device.');
            }
          } else {
            setLoginError('Account coordinate lookup failed. Verify your input parameters.');
          }
        } catch (error) {
          setLoginError('Registry gateway timing issue. Confirm your backend state.');
        }
      } 
      // PHASE 2: Verify OTP Code (Mobile Only Flow)
      else if (recoverySubStep === 'otp_verify') {
          try {
              const response = await fetch('http://localhost:5000/api/verify-otp', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ identity: recoveryIdentity, otp: recoveryOtp })
              });

              if (response.ok) {
                  // ← CHANGED: redirect to the same ResetPasswordLanding page
                  // Pass identity so the reset page knows which account to update
                  window.location.href = `/reset-password?identity=${encodeURIComponent(recoveryIdentity)}&method=mobile`;
              } else {
                  setLoginError('Invalid or expired verification code.');
              }
          } catch (error) {
              setLoginError('Validation service verification timeout.');
          }
      }
      // PHASE 3: Overwrite and Save Password (Mobile Only Flow)
      else if (recoverySubStep === 'new_password') {
        if (recoveryNewPassword !== recoveryConfirmPassword) {
          setLoginError('Security passphrases mismatch.');
          return;
        }

        try {
          const response = await fetch('http://localhost:5000/api/reset-password-mobile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identity: recoveryIdentity, newPassword: recoveryNewPassword })
          });

          if (response.ok) {
            setRecoverySuccess('Database updated! Credentials securely modified.');
            setTimeout(() => {
              // Reset state tracking variables and navigate back to sign-in panel
              setRecoverySubStep('request');
              setRecoveryIdentity('');
              setStep('auth');
            }, 2500);
          } else {
            setLoginError('System rejected password update rules.');
          }
        } catch (error) {
          setLoginError('Database write operational execution error.');
        }
      }
    };

    const handleBackNavigation = () => {
      setRecoverySubStep('request');
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
      
      if (step === 'cho_select' || step === 'bhw_select' || step === 'signup') {
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
              <div className="circle-logo" style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#1E3A8A' }}></div>
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

            {/* FORGOT PASSWORD SECTION */}
            {step === 'forgot_password' && (
              <>
                <div className="login-header" style={{ marginBottom: '20px', textAlign: 'left' }}>
                  <button type="button" onClick={handleBackNavigation} style={{ background: 'none', border: 'none', color: '#10B981', cursor: 'pointer', fontSize: '14px', fontWeight: '500', marginBottom: '10px', padding: 0 }}>← Back to Login</button>
                  <h2 style={{ fontSize: '28px', color: 'var(--text-main)', marginBottom: '8px' }}>Recover Account</h2>
                  <p style={{ color: 'var(--text-muted)' }}>
                    {recoverySubStep === 'request' && (recoveryMethod === 'email' ? "Enter your registered email to receive recovery instructions." : "Enter your mobile number to receive an OTP code.")}
                    {recoverySubStep === 'otp_verify' && "Enter the verification code sent to your mobile device."}
                    {recoverySubStep === 'new_password' && "Setup your new secure access credentials below."}
                  </p>
                </div>

                {/* METHOD TOGGLE TABS (Only visible during initial request step) */}
                {recoverySubStep === 'request' && (
                  <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                    <button type="button" onClick={() => { setRecoveryMethod('email'); setLoginError(''); setRecoverySuccess(''), setRecoveryIdentity('');; }} style={{ flex: 1, padding: '10px', background: recoveryMethod === 'email' ? '#10B981' : 'var(--input-bg)', color: recoveryMethod === 'email' ? '#FFFFFF' : 'var(--text-muted)', border: recoveryMethod === 'email' ? 'none' : '1px solid var(--border-color)', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}>
                      📧 Email
                    </button>
                    <button type="button" onClick={() => { setRecoveryMethod('mobile'); setLoginError(''); setRecoverySuccess(''), setRecoveryIdentity(''); }} style={{ flex: 1, padding: '10px', background: recoveryMethod === 'mobile' ? '#10B981' : 'var(--input-bg)', color: recoveryMethod === 'mobile' ? '#FFFFFF' : 'var(--text-muted)', border: recoveryMethod === 'mobile' ? 'none' : '1px solid var(--border-color)', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}>
                      📱 Mobile OTP
                    </button>
                  </div>
                )}

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

                  {/* SUBSTEP A: INITIAL IDENTITY FIELD REQUEST */}
                  {recoverySubStep === 'request' && (
                      <div className="form-group" style={{ textAlign: 'left' }}>
                          <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-main)', fontSize: '14px', fontWeight: '500' }}>
                              {recoveryMethod === 'email' 
                                  ? 'Username or registered email address' 
                                  : 'Registered Mobile Number'}
                          </label>
                          <input 
                              type="text"
                              className="form-input" 
                              placeholder={recoveryMethod === 'email' 
                                  ? 'e.g. cho_niugan or idkwutishappen@gmail.com' 
                                  : '09123456789'} 
                              value={recoveryIdentity}
                              onChange={(e) => setRecoveryIdentity(e.target.value)}
                              required 
                          />
                      </div>
                  )}

                  {/* SUBSTEP B: OTP TOKEN VERIFICATION */}
                  {recoverySubStep === 'otp_verify' && (
                    <div className="form-group" style={{ textAlign: 'left' }}>
                      <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-main)', fontSize: '14px', fontWeight: '500' }}>One-Time Password Token (OTP)</label>
                      <input 
                        type="text"
                        className="form-input" 
                        placeholder="######" 
                        maxLength="6"
                        value={recoveryOtp}
                        onChange={(e) => setRecoveryOtp(e.target.value)}
                        style={{ letterSpacing: '4px', textAlign: 'center', fontSize: '18px', fontWeight: 'bold' }}
                        required 
                      />
                    </div>
                  )}

                  {/* SUBSTEP C: INLINE CREDENTIAL CORRECTION */}
                  {recoverySubStep === 'new_password' && (
                    <>
                      <div className="form-group" style={{ textAlign: 'left' }}>
                        <label style={{ display: 'block', marginBottom: '6px', color: 'var(--text-main)', fontSize: '13px', fontWeight: '500' }}>New Security Password</label>
                        <input 
                          type="password" 
                          className="form-input" 
                          placeholder="••••••••"
                          value={recoveryNewPassword}
                          onChange={(e) => setRecoveryNewPassword(e.target.value)}
                          required 
                        />
                      </div>
                      <div className="form-group" style={{ marginTop: '14px', textAlign: 'left' }}>
                        <label style={{ display: 'block', marginBottom: '6px', color: 'var(--text-main)', fontSize: '13px', fontWeight: '500' }}>Confirm Security Password</label>
                        <input 
                          type="password" 
                          className="form-input" 
                          placeholder="••••••••"
                          value={recoveryConfirmPassword}
                          onChange={(e) => setRecoveryConfirmPassword(e.target.value)}
                          required 
                        />
                      </div>
                    </>
                  )}

                  <button type="submit" className="submit-btn" style={{ backgroundColor: '#10B981', color: '#FFFFFF', marginTop: '25px', width: '100%' }}>
                    {recoverySubStep === 'request' && (recoveryMethod === 'email' ? 'Send Recovery Link' : 'Send Verification OTP')}
                    {recoverySubStep === 'otp_verify' && 'Verify OTP Credentials'}
                    {recoverySubStep === 'new_password' && 'Synchronize New Password'}
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

                        {/* Role */}
                        <div className="form-group" style={{ marginTop: '14px', textAlign: 'left' }}>
                            <label style={{ display: 'block', marginBottom: '6px', color: 'var(--text-main)', fontSize: '13px', fontWeight: '500' }}>Surveillance Role</label>
                            <select
                                className="form-input"
                                value={signupRole}
                                onChange={(e) => {
                                    setSignupRole(e.target.value);
                                    setSignupContext(e.target.value === 'CHO' ? 'CHO Unit I (Sala)' : '');
                                }}
                                style={{ width: '100%', height: '42px', background: 'var(--input-bg)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '0 10px' }}
                            >
                                <option value="CHO">City Health Office (CHO Admin)</option>
                                <option value="BHW">Barangay Health Worker (BHW)</option>
                            </select>
                        </div>

                        {/* Assigned Station */}
                        <div className="form-group" style={{ marginTop: '14px', textAlign: 'left' }}>
                            <label style={{ display: 'block', marginBottom: '6px', color: 'var(--text-main)', fontSize: '13px', fontWeight: '500' }}>
                                {signupRole === 'CHO' ? 'Unit Assignment' : 'Assigned Barangay'}
                            </label>
                            {signupRole === 'CHO' ? (
                                <select
                                    className="form-input"
                                    value={signupContext}
                                    onChange={(e) => setSignupContext(e.target.value)}
                                    style={{ width: '100%', height: '42px', background: 'var(--input-bg)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '0 10px' }}
                                >
                                    <option value="CHO Unit I (Sala)">CHO Unit I (Main - Sala)</option>
                                    <option value="CHO Unit II (Pulo)">CHO Unit II (Extension - Pulo)</option>
                                </select>
                            ) : (
                                <select
                                    className="form-input"
                                    value={signupContext}
                                    onChange={(e) => setSignupContext(e.target.value)}
                                    style={{ width: '100%', height: '42px', background: 'var(--input-bg)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '0 10px' }}
                                    required
                                >
                                    <option value="">— Select your barangay —</option>
                                    {barangayList.map(b => (
                                        <option key={b.id} value={b.id}>{b.name}</option>
                                    ))}
                                </select>
                            )}
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
                        </div>

                        <button type="submit" className="submit-btn" style={{ backgroundColor: '#10B981', color: '#FFFFFF', marginTop: '20px', width: '100%' }}>
                            Register Account
                        </button>
                    </form>
                </>
            )}

            {/* SHARED FOOTER ROUTING */}
            {step !== 'signup' && step !== 'forgot_password' ? (
              <div style={{ marginTop: '30px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
                Don't have an account? <span onClick={() => setStep('signup')} style={{ color: '#10B981', cursor: 'pointer', fontWeight: '500' }}>Sign up</span>
              </div>
            ) : (
              step !== 'role' && (
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