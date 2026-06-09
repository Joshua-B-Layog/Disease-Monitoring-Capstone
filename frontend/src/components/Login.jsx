import React, { useState } from 'react';

export default function Login({ onLoginSuccess, theme, toggleTheme }) {
  const [step, setStep] = useState('role');
  const [selectedRole, setSelectedRole] = useState('CHO'); 
  const [selectedContext, setSelectedContext] = useState(''); 
  
  // Credentials matching your Node controller backend expectations
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

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

      if (response.ok) {
        onLoginSuccess({
          role: selectedRole,
          context: selectedContext,
          username: email
        });
      } else {
        setLoginError('Invalid email, password, or unauthorized role assignment.');
      }
    } catch (error) {
      console.error("Transmission Error:", error);
      setLoginError('Cannot connect to the server. Make sure your backend is running.');
    }
  };

  const handleBackNavigation = () => {
    setLoginError('');
    if (step === 'cho_select' || step === 'bhw_select') {
      setStep('role');
      setSelectedContext('');
    } else if (step === 'auth') {
      setStep(selectedRole === 'CHO' ? 'cho_select' : 'bhw_select');
    }
  };

  return (
    <div className="login-screen">
      
      {/* Absolute Theme Toggle (Preserved from old layout) */}
      <button onClick={toggleTheme} className="theme-toggle-btn" style={{ position: 'absolute', top: '20px', right: '20px', zIndex: 100 }}>
        {theme === 'dark' ? '☀️ Light Mode' : '🌙 Dark Mode'}
      </button>

      {/* Left Branding Panel (Preserved from your Figma layout CSS) */}
      <div className="login-left"></div>

      {/* Right Side Login Panel Wrapper */}
      <div className="login-right">
        <div className="login-form-container">
          
          {/* Constant Brand Header */}
          <div className="brand-logo" style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '30px' }}>
            <div className="circle-logo" style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#1E3A8A' }}></div>
            <div className="brand-text" style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--text-main)' }}>
              Cabuyao Health
            </div>
          </div>

          {/* STEP 1: ROLE ENTRY GATEWAY */}
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
                <button type="button" onClick={() => handleChoSelection('CHO Unit I (Sala)')} style={{ padding: '16px', background: 'var(--bg-surfaces, #2d3748)', border: '1px solid var(--border-color, #4a5568)', borderRadius: '8px', color: 'var(--text-main)', fontWeight: '600', cursor: 'pointer', textAlign: 'left', width: '100%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '16px' }}>CHO Unit I (Main)</span>
                    <span style={{ fontSize: '11px', background: '#1e3a8a', color: '#93c5fd', padding: '2px 6px', borderRadius: '4px' }}>CHO 1 Hub</span>
                  </div>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '400', display: 'block', marginTop: '6px' }}>
                    City Hall Complex, F.B. Bailon St., Brgy. Sala
                  </span>
                </button>
                
                <button type="button" onClick={() => handleChoSelection('CHO Unit II (Pulo)')} style={{ padding: '16px', background: 'var(--bg-surfaces, #2d3748)', border: '1px solid var(--border-color, #4a5568)', borderRadius: '8px', color: 'var(--text-main)', fontWeight: '600', cursor: 'pointer', textAlign: 'left', width: '100%' }}>
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

          {/* STEP 2B: BHW SCROLLABLE BARANGAY REGISTRY */}
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

              <div style={{ background: 'var(--bg-darker, #111827)', border: '1px solid var(--border-color, #374151)', borderRadius: '8px', maxHeight: '220px', overflowY: 'auto', marginBottom: '24px', padding: '4px', textAlign: 'left' }}>
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
                <h2 style={{ fontSize: '28px', color: 'var(--text-main)', marginBottom: '8px' }}>Security Sign-In</h2>
                <p style={{ color: 'var(--text-muted)' }}>Please verify your account identity coordinates.</p>
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
                  <input 
                    type="password" 
                    className="form-input" 
                    placeholder="••••••••" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required 
                  />
                </div>

                <div className="form-options" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '20px 0' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-main)', cursor: 'pointer', fontSize: '14px' }}>
                    <input type="checkbox" style={{ accentColor: '#10B981', width: '16px', height: '16px' }} /> 
                    Remember me
                  </label>
                  <span style={{ color: '#10B981', cursor: 'pointer', fontSize: '14px', fontWeight: '500' }}>
                    Forgot password?
                  </span>
                </div>

                <button type="submit" className="submit-btn" style={{ backgroundColor: '#10B981', color: '#FFFFFF', marginTop: '10px' }}>
                  Sign In as {selectedRole}
                </button>
              </form>
            </>
          )}

          {/* Constant Footer Options */}
          <div style={{ marginTop: '30px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
            Don't have an account? <span style={{ color: '#10B981', cursor: 'pointer', fontWeight: '500' }}>Sign up</span>
          </div>

        </div>
      </div>
    </div>
  );
}