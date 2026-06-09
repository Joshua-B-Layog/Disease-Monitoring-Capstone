import { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import ManageCases from './ManageCases';  
import Dashboard from './Dashboard'; 
import UserManagement from './UserManagement';
import BarangayReports from './BarangayReports';
import ChoSettings from './ChoSettings';
import Login from './components/Login'; 
import MapView from './MapView';
import './App.css';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginRole, setLoginRole] = useState('CHO');
  const [sessionContext, setSessionContext] = useState(''); 
  const [loggedUser, setLoggedUser] = useState('');         
  
  const [activeTab, setActiveTab] = useState('Dashboard');  
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedDisease, setSelectedDisease] = useState('Dengue');
  const [dateRange, setDateRange] = useState({ start: '2026-01-01', end: '2026-05-28' });

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

  // --- RENDERS THE CORRECT COMPONENT BASED ON TAB ---
  const renderContent = () => {
    switch (activeTab) {
      case 'Dashboard':
        return <Dashboard selectedDisease={selectedDisease} setSelectedDisease={setSelectedDisease} dateRange={dateRange} diseaseData={diseaseData} />;
      case 'Manage Cases':
        return <ManageCases />;
      case 'Map View':
        return <MapView />;
      case 'User Accounts': 
        return <UserManagement />; 
      case 'Barangay Reports':
        return <BarangayReports />;
      case 'Settings':
        return <ChoSettings activeUser={{ role: loginRole, context: sessionContext }} />;
      default:
        return <div style={{padding: '20px'}}>Content coming soon...</div>;
    }
  };

  const handleLoginSuccess = (sessionData) => {
    setIsLoggedIn(true);
    setLoginRole(sessionData.role);
    setSessionContext(sessionData.context);
    setLoggedUser(sessionData.username);
  };

  const handleLogout = () => { 
    setIsLoggedIn(false); 
    setSessionContext('');
    setLoggedUser('');
    window.location.reload();
  };

  // --- CONNECTED GATEKEEPER CONDITION ---
  if (!isLoggedIn) {
    return <Login onLoginSuccess={handleLoginSuccess} theme={theme} toggleTheme={toggleTheme} />;
  }

  // --- MAIN LAYOUT ENGINE ---
  return (
    <div className="dashboard-layout">
      {/* Sidebar matches tabs natively via your existing state triggers */}
      <Sidebar role={loginRole} activeTab={activeTab} setActiveTab={setActiveTab} />

      <div className="main-content">
        <div className="top-nav">
          <div className="nav-title" style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <h2 style={{ margin: 0 }}>{activeTab}</h2>
            <small style={{ color: '#10B981', fontSize: '12px', fontWeight: '500' }}>
              Scope: {sessionContext} ({loginRole})
            </small>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <button onClick={toggleTheme} className="theme-toggle-btn" style={{ position: 'static' }}>
              {theme === 'dark' ? '☀️ Light Mode' : '🌙 Dark Mode'}
            </button>

            <div className="user-profile" onClick={() => setIsDropdownOpen(!isDropdownOpen)}>
              <div className="user-info">
                <div className="user-name">{loggedUser || "System Officer"}</div>
                <div className="user-role">{loginRole} Specialist</div>
              </div>
              <div className="avatar">{loginRole}</div>
              <span style={{color: '#9ca3af', marginLeft: '5px'}}>{isDropdownOpen ? '▲' : '▼'}</span>

              {isDropdownOpen && (
                <div className="dropdown-menu">
                  {/* 3. Updated tab destination string to hit the matching routing switch statement */}
                  <div className="dropdown-item" onClick={() => setActiveTab('Profile Settings')}>Profile Settings</div>
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