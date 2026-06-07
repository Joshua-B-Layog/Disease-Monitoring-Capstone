import { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import ManageCases from './ManageCases';  
import Dashboard from './Dashboard'; 
import UserManagement from './UserManagement';
import BarangayReports from './BarangayReports';
import './App.css';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginRole, setLoginRole] = useState('CHO');
  const [activeTab, setActiveTab] = useState('Dashboard');  
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedDisease, setSelectedDisease] = useState('Dengue');
  const [dateRange, setDateRange] = useState({ start: '2026-01-01', end: '2026-05-28' });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // --- THEME LOGIC ---
  const [theme, setTheme] = useState('dark');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  const diseaseData = {
    'Dengue': [
      { label: 'Cabuyao', value: 85 },
      { label: 'Niugan', value: 65 },
      { label: 'Pulo', value: 45 },
      { label: 'Banlic', value: 30 }
    ],
    'COVID-19': [
      { label: 'Cabuyao', value: 40 },
      { label: 'Niugan', value: 90 },
      { label: 'Pulo', value: 20 },
      { label: 'Banlic', value: 50 }
    ] 
  };

  // --- UPDATED: RENDERS THE CORRECT COMPONENT BASED ON TAB ---
  const renderContent = () => {
    switch (activeTab) {
      
      // --- SHARED OR CHO-ONLY VIEWS ---
      case 'Dashboard':
        return (
          <Dashboard 
            selectedDisease={selectedDisease} 
            setSelectedDisease={setSelectedDisease}
            dateRange={dateRange}
            diseaseData={diseaseData}
          />
        );
      case 'Manage Cases':
        return <ManageCases />;
      case 'Map View':
        return <div style={{color: 'white', padding: '20px'}}>Map View Loading...</div>;
      case 'User Accounts': 
        return <UserManagement />; // CHO sees this
        
      // 🔥 ADD THIS NEW CASE RIGHT HERE 🔥
      case 'Barangay Reports':
        return <BarangayReports />;

      // --- BHW-ONLY VIEWS ---
      case 'New Case Report':
        return (
          <div style={{ padding: '20px', color: '#f8fafc' }}>
            <h2>Create New Case Report</h2>
            <p>Form to submit new localized cases will go here...</p>
          </div>
        );
      case 'My Barangay':
        return <div style={{color: 'white', padding: '20px'}}>Barangay Map & Stats Loading...</div>;
      case 'My Reports':
        return <div style={{color: 'white', padding: '20px'}}>BHW Submission History Loading...</div>;
      case 'Profile':
        return (
          <div style={{ padding: '20px', color: '#f8fafc' }}>
            <h2>My Profile</h2>
            <p>BHW account settings and details will go here (Instead of the CHO User Accounts table).</p>
          </div>
        );

      // --- FALLBACK ---
      default:
        return <div style={{color: 'white', padding: '20px'}}>Content coming soon...</div>;
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError(''); // Clear any previous errors

    try {
      // Send the data to your Node.js backend
      const response = await fetch('http://localhost:5000/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password, role: loginRole }),
      });

      if (response.ok) {
        // Backend verified the user!
        const data = await response.json();
        setIsLoggedIn(true);
      } else {
        // Backend rejected the login (e.g., wrong password, wrong role)
        setLoginError('Invalid email, password, or role. Please try again.');
      }
    } catch (error) {
      console.error("Login Error:", error);
      setLoginError('Cannot connect to the server. Make sure your backend is running.');
    }
  };
  const handleLogout = () => { setIsLoggedIn(false); window.location.href = '/'; };

  // --- LOGIN SCREEN ---
  if (!isLoggedIn) {
    return (
      <div className="login-screen">
        
        {/* The Missing Login Theme Toggle */}
        <button onClick={toggleTheme} className="theme-toggle-btn" style={{ position: 'absolute', top: '20px', right: '20px', zIndex: 100 }}>
          {theme === 'dark' ? '☀️ Light Mode' : '🌙 Dark Mode'}
        </button>

        <div className="login-left"></div>
        <div className="login-right">
          <div className="login-form-container">
            
            {/* Header / Logo */}
            <div className="brand-logo" style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '30px' }}>
              <div className="circle-logo" style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#1E3A8A' }}></div>
              <div className="brand-text" style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--text-main)' }}>
                Cabuyao Health
              </div>
            </div>

            <div className="login-header" style={{ marginBottom: '30px' }}>
              <h2 style={{ fontSize: '28px', color: 'var(--text-main)', marginBottom: '8px' }}>Welcome back</h2>
              <p style={{ color: 'var(--text-muted)' }}>Please enter your details to sign in.</p>
            </div>

            {/* Role Toggle */}
            <div className="role-toggle">
              <button 
                className={`role-btn ${loginRole === 'CHO' ? 'active' : ''}`} 
                onClick={() => setLoginRole('CHO')}
                style={loginRole === 'CHO' ? { backgroundColor: '#1E3A8A', color: '#FFFFFF' } : {}}
              >
                CHO
              </button>
              <button 
                className={`role-btn ${loginRole === 'BHW' ? 'active' : ''}`} 
                onClick={() => setLoginRole('BHW')}
                style={loginRole === 'BHW' ? { backgroundColor: '#1E3A8A', color: '#FFFFFF' } : {}}
              >
                BHW
              </button>
            </div>

            {/* Login Form */}
            <form onSubmit={handleLogin}>
              
              {/* Show error message if backend rejects login */}
              {loginError && (
                <div style={{ backgroundColor: '#fee2e2', color: '#ef4444', padding: '10px', borderRadius: '6px', marginBottom: '15px', fontSize: '14px', border: '1px solid #fca5a5' }}>
                  {loginError}
                </div>
              )}

              <div className="form-group">
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
              
              <div className="form-group" style={{marginTop: '20px'}}>
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

              {/* Form Options (Remember Me & Forgot Password) */}
              <div className="form-options" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '20px 0' }}>
                <label style={{display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-main)', cursor: 'pointer', fontSize: '14px'}}>
                  <input type="checkbox" style={{ accentColor: '#10B981', width: '16px', height: '16px' }} /> 
                  Remember me
                </label>
                <span style={{ color: '#10B981', cursor: 'pointer', fontSize: '14px', fontWeight: '500' }}>
                  Forgot password?
                </span>
              </div>

              <button type="submit" className="submit-btn" style={{ backgroundColor: '#10B981', color: '#FFFFFF', marginTop: '10px' }}>
                Sign In as {loginRole}
              </button>
            </form>

            <div style={{marginTop: '30px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px'}}>
              Don't have an account? <span style={{ color: '#10B981', cursor: 'pointer', fontWeight: '500' }}>Sign up</span>
            </div>

          </div>
        </div>
      </div>
    );
  }

  // --- MAIN LAYOUT ---
  return (
    <div className="dashboard-layout">
      <Sidebar role={loginRole} activeTab={activeTab} setActiveTab={setActiveTab} />

      <div className="main-content">
        <div className="top-nav">
          <div className="nav-title"><h2>{activeTab}</h2></div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            {/* Dashboard Theme Toggle */}
            <button onClick={toggleTheme} className="theme-toggle-btn" style={{ position: 'static' }}>
              {theme === 'dark' ? '☀️ Light Mode' : '🌙 Dark Mode'}
            </button>

            <div className="user-profile" onClick={() => setIsDropdownOpen(!isDropdownOpen)}>
              <div className="user-info">
                <div className="user-name">Dr. Reyes</div>
                <div className="user-role">CHO Admin</div>
              </div>
              <div className="avatar">DR</div>
              <span style={{color: '#9ca3af', marginLeft: '5px'}}>{isDropdownOpen ? '▲' : '▼'}</span>

              {isDropdownOpen && (
                <div className="dropdown-menu">
                  <div className="dropdown-item">Profile Settings</div>
                  <div className="dropdown-item" style={{ color: '#ef4444' }} onClick={handleLogout}>Logout</div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="content-scroller">
            {renderContent()}
        </div>
      </div>
    </div>
  );
}

export default App;