import { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import ManageCases from './ManageCases';  
import Dashboard from './Dashboard'; 
import UserManagement from './UserManagement';
import BarangayReports from './BarangayReports';
import ChoSettings from './ChoSettings';
import Login from './components/Login'; 
import RecoverAccount from './components/RecoverAccount';
import MapView from './MapView';

import './App.css';

function App() {
  const [isLoggedIn, setIsLoggedIn]       = useState(false);
  const [loginRole, setLoginRole]         = useState('CHO');
  const [sessionContext, setSessionContext] = useState(''); 
  const [loggedUser, setLoggedUser]       = useState('');
  const [loggedUserId, setLoggedUserId]   = useState(null);

  const [profilePhoto, setProfilePhoto]   = useState(null);

  const [activeTab, setActiveTab]         = useState('Dashboard');  
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedDisease, setSelectedDisease] = useState('Dengue');
  const [dateRange, setDateRange]         = useState({ start: '2026-01-01', end: '2026-05-28' });
  const [caseFilter, setCaseFilter]       = useState({ disease: '', barangay: '' });

  const [authView, setAuthView]           = useState('login'); 

  // ── CHO Profile modal state ──
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileData, setProfileData]           = useState(null);
  const [profileLoading, setProfileLoading]     = useState(false);

  // ── THEME ──
  const [theme, setTheme] = useState('dark');
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);
  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark');

  // ── Load saved profile photo from localStorage on mount ──
  useEffect(() => {
    const saved = localStorage.getItem('cdms_profile_photo');
    if (saved) setProfilePhoto(saved);
  }, []);

  const handleProfilePhotoChange = (dataUrl) => {
    setProfilePhoto(dataUrl);
    if (dataUrl) {
      localStorage.setItem('cdms_profile_photo', dataUrl);
    } else {
      localStorage.removeItem('cdms_profile_photo');
    }
  };

  // ── Load profile data when modal opens ──
  const openProfileModal = async () => {
    setIsDropdownOpen(false);
    setShowProfileModal(true);
    if (!loggedUserId) return;
    setProfileLoading(true);
    try {
      const res = await fetch(`http://localhost:5000/api/users/${loggedUserId}/profile`);
      const data = await res.json();
      setProfileData(data);
    } catch (e) {
      setProfileData(null);
    } finally {
      setProfileLoading(false);
    }
  };

  // ── Derive initials ──
  const getInitials = () => {
    if (!loggedUser) return loginRole;
    const parts = loggedUser.trim().split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return (loggedUser.slice(0, 2)).toUpperCase();
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'Dashboard':
        return (
          <Dashboard
            selectedDisease={selectedDisease}
            setSelectedDisease={setSelectedDisease}
            dateRange={dateRange}
            setActiveTab={setActiveTab}
            loggedUser={loggedUser}
          />
        );
      case 'Manage Cases':
        return <ManageCases caseFilter={caseFilter} setCaseFilter={setCaseFilter} />;
      case 'Map View':
        return <MapView setActiveTab={setActiveTab} setCaseFilter={setCaseFilter} />;
      case 'User Accounts': 
        return <UserManagement />;
      case 'Audit Reports':
        return <BarangayReports activeUser={{ role: loginRole, context: sessionContext }} />;
      case 'Settings':
        return (
          <ChoSettings
            activeUser={{ role: loginRole, context: sessionContext }}
            userId={loggedUserId}
            loggedUser={loggedUser}
            setLoggedUser={setLoggedUser}
            profilePhoto={profilePhoto}
            onProfilePhotoChange={handleProfilePhotoChange}
          />
        );
      default:
        return <div style={{ padding: '20px' }}>Content coming soon...</div>;
    }
  };

  const handleLoginSuccess = (sessionData) => {
    setIsLoggedIn(true);
    setLoginRole(sessionData.role);
    setSessionContext(sessionData.context);
    setLoggedUser(sessionData.name || sessionData.username);
    setLoggedUserId(sessionData.id || null);
  };

  const handleLogout = () => { 
    setIsLoggedIn(false); 
    setSessionContext('');
    setLoggedUser('');
    setLoggedUserId(null);
    window.location.reload();
  };

  if (!isLoggedIn) {
    if (authView === 'recover') {
      return (
        <RecoverAccount 
          onBackToLogin={() => setAuthView('login')} 
          theme={theme} 
          toggleTheme={toggleTheme} 
        />
      );
    }
    return (
      <Login 
        onLoginSuccess={handleLoginSuccess} 
        onForgotPassword={() => setAuthView('recover')}
        theme={theme} 
        toggleTheme={toggleTheme} 
      />
    );
  }

  // ── Profile field row helper ──
  const ProfileRow = ({ label, value }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '16px' }}>
      <span style={{ fontSize: '11px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
      <span style={{ fontSize: '15px', color: '#0f172a', fontWeight: '500' }}>{value || '—'}</span>
    </div>
  );

  return (
    <div className="dashboard-layout">
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
                <div className="user-name">{loggedUser || 'System Officer'}</div>
                <div className="user-role">{loginRole} Specialist</div>
              </div>

              <div className="avatar" style={{
                background: profilePhoto ? 'transparent' : '#3B82F6',
                overflow: 'hidden', padding: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                {profilePhoto ? (
                  <img
                    src={profilePhoto}
                    alt="profile"
                    style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
                  />
                ) : (
                  <span style={{ color: 'white', fontWeight: 'bold', fontSize: '12px' }}>
                    {getInitials()}
                  </span>
                )}
              </div>

              <span style={{ color: '#9ca3af', marginLeft: '5px' }}>
                {isDropdownOpen ? '▲' : '▼'}
              </span>

              {isDropdownOpen && (
                <div className="dropdown-menu">
                  <div
                    className="dropdown-item"
                    onClick={openProfileModal}
                  >
                    CHO Profile
                  </div>
                  <div
                    className="dropdown-item"
                    style={{ color: '#ef4444' }}
                    onClick={handleLogout}
                  >
                    Logout
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="content-scroller">
          {renderContent()}
        </div>
      </div>

      {/* ── CHO PROFILE MODAL ── */}
      {showProfileModal && (
        <div
          onClick={() => setShowProfileModal(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 9999,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#ffffff', borderRadius: '16px', width: '520px', maxWidth: '95vw',
              boxShadow: '0 24px 60px rgba(0,0,0,0.25)', overflow: 'hidden',
            }}
          >
            {/* ── Teal banner header ── */}
            <div style={{
              background: 'linear-gradient(135deg, #0d9488 0%, #1e3a8a 100%)',
              padding: '32px 32px 24px 32px',
              display: 'flex', alignItems: 'center', gap: '20px',
            }}>
              <div style={{
                width: '80px', height: '80px', borderRadius: '50%',
                background: profilePhoto ? 'transparent' : '#10b981',
                border: '3px solid rgba(255,255,255,0.4)',
                overflow: 'hidden', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {profilePhoto ? (
                  <img src={profilePhoto} alt="profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span style={{ color: '#fff', fontSize: '28px', fontWeight: '700' }}>{getInitials()}</span>
                )}
              </div>
              <div>
                <h2 style={{ margin: '0 0 4px 0', color: '#ffffff', fontSize: '22px', fontWeight: '700' }}>
                  {loggedUser || 'System Officer'}
                </h2>
                <p style={{ margin: 0, color: 'rgba(255,255,255,0.75)', fontSize: '14px' }}>
                  {loginRole} Specialist — {sessionContext}
                </p>
              </div>
            </div>

            {/* ── Profile details body ── */}
            <div style={{ padding: '28px 32px' }}>
              {profileLoading ? (
                <div style={{ textAlign: 'center', padding: '24px', color: '#94a3b8', fontSize: '14px' }}>
                  Loading profile...
                </div>
              ) : profileData ? (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px' }}>
                    <ProfileRow label="Full Name" value={profileData.full_name} />
                    <ProfileRow label="Username" value={profileData.username} />
                    <ProfileRow label="Email Address" value={profileData.email} />
                    <ProfileRow label="Mobile Number" value={profileData.mobile_number} />
                    <ProfileRow label="Role" value={profileData.role} />
                    <ProfileRow label="Assigned Barangay" value={profileData.assigned_barangay_name || sessionContext} />
                  </div>
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: '16px', color: '#94a3b8', fontSize: '14px' }}>
                  Could not load profile details.
                </div>
              )}

              {/* ── Action buttons ── */}
              <div style={{ display: 'flex', gap: '12px', marginTop: '24px', paddingTop: '20px', borderTop: '1px solid #e2e8f0' }}>
                <button
                  onClick={() => { setShowProfileModal(false); setActiveTab('Settings'); }}
                  style={{
                    flex: 1, padding: '12px', background: '#10b981', color: '#fff',
                    border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '600',
                    cursor: 'pointer',
                  }}
                >
                  ✏️ Edit Profile
                </button>
                <button
                  onClick={() => setShowProfileModal(false)}
                  style={{
                    padding: '12px 24px', background: '#f1f5f9', color: '#475569',
                    border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px',
                    cursor: 'pointer',
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;