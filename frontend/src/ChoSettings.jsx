import React, { useState, useRef } from 'react';
import './ChoSettings.css';

export default function CHOSettings() {
  const [currentView, setCurrentView] = useState('menu');
  const fileInputRef = useRef(null);

  // Interactive Form State Buckets
  const [profile, setProfile] = useState({
    firstName: 'Joshua B.',
    lastName: 'Layog',
    username: 'josh_layog',
    email: 'joshua.layog@cabuyao.gov.ph',
    phone: '+63 912 345 6789',
    assignment: 'CHO Unit I (Sala)'
  });

  const [security, setSecurity] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const [notifications, setNotifications] = useState({
    emailNotifications: false,
    pushNotifications: false,
    smsNotifications: false,
    newCaseReported: false,
    caseStatusUpdated: false,
    highRiskAlert: false,
    weeklySummary: false,
    systemMaintenance: false
  });

  const [systemPrefs, setSystemPrefs] = useState({
    darkMode: false,
    fontSize: 'Medium',
    compactView: false,
    displayLanguage: 'English',
    timeZone: 'Asia/Manila (GMT+8)',
    dateFormat: 'MM/DD/YY',
    autoSave: false,
    confirmDelete: false,
    keyboardShortcuts: false
  });

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  
  const [isTwoFactorEnabled, setIsTwoFactorEnabled] = useState(false);
  const [profilePic, setProfilePic] = useState(null);

  const handleImageChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setProfilePic(URL.createObjectURL(e.target.files[0]));
    }
  };

  // Reusable Component Wrapper for Menu Cards
  const NavigationCard = ({ title, icon, view, isFullWidth = false }) => (
    <div className={`nav-box ${isFullWidth ? 'full-width' : ''}`} onClick={() => setCurrentView(view)}>
      <div className="box-content-left">
        <div className="box-icon-wrapper">{icon}</div>
        <h3 className="box-title-text">{title}</h3>
      </div>
      <span className="box-arrow-right">➔</span>
    </div>
  );

  return (
    <div className="settings-wrapper">
      <div className="settings-container">
        
        {/* ================= VIEW 1: MASTER RECTANGLE BOX GRID ================= */}
        {currentView === 'menu' && (
          <div>
            <h1 className="settings-title">Settings</h1>
            <p className="settings-subtitle">Manage your account credentials, notifications, and core configuration behaviors.</p>

            <div className="menu-grid">
              <NavigationCard title="Profile Settings" icon="👤" view="profile" />
              <NavigationCard title="Account Security" icon="🔒" view="security" />
              <NavigationCard title="Notifications" icon="🔔" view="notifications" />
              <NavigationCard title="System Preferences" icon="⚙️" view="system" />
              <NavigationCard title="Data Management" icon="💾" view="data" isFullWidth />
            </div>
          </div>
        )}

        {/* ================= VIEW 2: PROFILE SETTINGS VIEW ================= */}
        {currentView === 'profile' && (
          <div className="detail-view-container">
            <button className="back-to-settings-btn" onClick={() => setCurrentView('menu')} style={{ display: 'flex', alignItems: 'center', background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', fontWeight: '500', color: '#1f2937', marginBottom: '24px' }}>
              <span style={{ marginRight: '8px', fontSize: '20px' }}>←</span> Back to Settings
            </button>

            <div className="profile-header-container" style={{ display: 'flex', alignItems: 'center', gap: '24px', marginBottom: '24px' }}>
              <div className="avatar-wrapper" style={{ position: 'relative', width: '110px', height: '110px' }}>
                <div className="profile-avatar-circle" style={{ width: '100%', height: '100%', borderRadius: '50%', background: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                  {profilePic ? (
                    <img src={profilePic} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span className="avatar-initials" style={{ color: '#ffffff', fontSize: '32px', fontWeight: '600', letterSpacing: '1px' }}>
                      {profile.firstName.charAt(0)}{profile.lastName.charAt(0)}
                    </span>
                  )}
                </div>
                
                <div className="camera-badge-badge" onClick={() => fileInputRef.current.click()} style={{ position: 'absolute', bottom: '0', right: '4px', width: '32px', height: '32px', borderRadius: '50%', background: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.15)' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                    <circle cx="12" cy="13" r="4"></circle>
                  </svg>
                </div>
              </div>

              <div className="profile-meta-info" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <h2 className="profile-display-name" style={{ fontSize: '24px', fontWeight: '500', color: '#111827', margin: '0' }}>{profile.firstName} {profile.lastName}</h2>
                <p className="profile-display-role" style={{ fontSize: '14px', color: '#6b7280', margin: '0' }}>CHO Specialist — {profile.assignment}</p>
                
                <button className="change-photo-btn" onClick={() => fileInputRef.current.click()} style={{ background: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '8px', padding: '8px 18px', fontSize: '14px', fontWeight: '500', cursor: 'pointer', marginTop: '6px', width: 'fit-content', boxShadow: '0 2px 4px rgba(37,99,235,0.2)' }}>
                  Change Photo
                </button>
              </div>

              <input type="file" ref={fileInputRef} onChange={handleImageChange} style={{ display: 'none' }} accept="image/*" />
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb', margin: '24px 0' }} />
            
            <div className="form-split-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '40px' }}>
              <div className="input-field-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: '500', color: '#4b5563', paddingLeft: '2px' }}>First Name</label>
                <input type="text" value={profile.firstName} onChange={(e) => setProfile({...profile, firstName: e.target.value})} style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '12px 16px', fontSize: '15px', color: '#1f2937', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }} />
              </div>
              <div className="input-field-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: '500', color: '#4b5563', paddingLeft: '2px' }}>Last Name</label>
                <input type="text" value={profile.lastName} onChange={(e) => setProfile({...profile, lastName: e.target.value})} style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '12px 16px', fontSize: '15px', color: '#1f2937', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }} />
              </div>
              <div className="input-field-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: '500', color: '#4b5563', paddingLeft: '2px' }}>Username</label>
                <input type="text" value={profile.username} readOnly style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '12px 16px', fontSize: '15px', color: '#9ca3af', cursor: 'not-allowed' }} />
              </div>
              <div className="input-field-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: '500', color: '#4b5563', paddingLeft: '2px' }}>Email</label>
                <input type="email" value={profile.email} onChange={(e) => setProfile({...profile, email: e.target.value})} style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '12px 16px', fontSize: '15px', color: '#1f2937', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }} />
              </div>
              <div className="input-field-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: '500', color: '#4b5563', paddingLeft: '2px' }}>Contact Number</label>
                <input type="text" value={profile.phone} onChange={(e) => setProfile({...profile, phone: e.target.value})} style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '12px 16px', fontSize: '15px', color: '#1f2937', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }} />
              </div>
              <div className="input-field-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px', position: 'relative' }}>
                <label style={{ fontSize: '12px', fontWeight: '500', color: '#4b5563', paddingLeft: '2px' }}>Unit Office Assignment</label>
                <div style={{ position: 'relative', width: '100%' }}>
                  <select 
                    value={profile.assignment} 
                    onChange={(e) => setProfile({...profile, assignment: e.target.value})}
                    style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '12px 16px', fontSize: '15px', color: '#1f2937', width: '100%', appearance: 'none', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}
                  >
                    <option value="CHO Unit I (Sala)">CHO Unit I (Sala)</option>
                    <option value="CHO Unit II (Pulo)">CHO Unit II (Pulo)</option>
                  </select>
                  <span style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#1f2937', fontSize: '16px', fontWeight: 'bold' }}>∨</span>
                </div>
              </div>
            </div>

            <div className="form-action-footer" style={{ display: 'flex', gap: '16px', marginTop: '24px' }}>
              <button className="btn-secondary-cancel" onClick={() => setCurrentView('menu')} style={{ background: '#ffffff', border: '1px solid #d1d5db', color: '#1f2937', borderRadius: '12px', padding: '12px 48px', fontSize: '15px', fontWeight: '500', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.04)' }}>
                Cancel
              </button>
              <button className="btn-primary-action" onClick={() => setCurrentView('menu')} style={{ background: '#10b981', border: 'none', color: '#ffffff', borderRadius: '12px', padding: '12px', fontSize: '15px', fontWeight: '500', cursor: 'pointer', flexGrow: '1' }}>
                Save Changes
              </button>
            </div>
          </div>
        )}

        {/* ================= VIEW 3: ACCOUNT SECURITY VIEW ================= */}
        {currentView === 'security' && (
          <div className="detail-view-container security-view-view">
            <button className="back-to-settings-btn" onClick={() => setCurrentView('menu')}>
              ← Back to Settings
            </button>

            <div className="security-section-card">
              <div className="security-card-header">
                <div className="security-icon-box">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                  </svg>
                </div>
                <div className="security-header-text">
                  <h3>Change Password</h3>
                  <span className="security-timestamp">Last Updated 3 Months Ago</span>
                </div>
              </div>

              <div className="security-card-body">
                <div className="security-input-row">
                  <label>Current Password</label>
                  <div className="security-password-wrapper">
                    <input type={showCurrent ? "text" : "password"} value={security.currentPassword} onChange={(e) => setSecurity({...security, currentPassword: e.target.value})} placeholder="Enter Current Password" />
                    <button type="button" className="security-eye-btn" onClick={() => setShowCurrent(!showCurrent)}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1f2937" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                    </button>
                  </div>
                </div>

                <div className="security-input-row">
                  <label>New Password</label>
                  <div className="security-password-wrapper">
                    <input type={showNew ? "text" : "password"} value={security.newPassword} onChange={(e) => setSecurity({...security, newPassword: e.target.value})} placeholder="Enter New Password" />
                    <button type="button" className="security-eye-btn" onClick={() => setShowNew(!showNew)}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1f2937" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                    </button>
                  </div>
                </div>

                <div className="security-input-row">
                  <label>Confirm New Password</label>
                  <div className="security-password-wrapper">
                    <input type={showConfirm ? "text" : "password"} value={security.confirmPassword} onChange={(e) => setSecurity({...security, confirmPassword: e.target.value})} placeholder="Confirm New Password" />
                    <button type="button" className="security-eye-btn" onClick={() => setShowConfirm(!showConfirm)}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1f2937" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                    </button>
                  </div>
                </div>

                <button className="security-action-blue-btn">Update Password</button>
              </div>
            </div>

            <div className="security-section-card row-layout-card">
              <div className="security-card-header no-margin">
                <div className="security-icon-box">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                  </svg>
                </div>
                <div className="security-header-text">
                  <h3>Two-Factor Authentication</h3>
                  <span className="security-timestamp">Currently disabled</span>
                </div>
              </div>
              <div className="security-card-action">
                <label className="figma-toggle-switch">
                  <input type="checkbox" checked={isTwoFactorEnabled} onChange={(e) => setIsTwoFactorEnabled(e.target.checked)} />
                  <span className="figma-slider"></span>
                </label>
              </div>
            </div>

            <div className="security-section-card">
              <div className="security-card-header space-between-layout">
                <div className="header-flex-left">
                  <div className="security-icon-box green-icon-box">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2">
                      <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
                      <line x1="12" y1="18" x2="12.01" y2="18"></line>
                    </svg>
                  </div>
                  <div className="security-header-text">
                    <h3>Login Sessions</h3>
                    <span className="security-timestamp">2 active sessions</span>
                  </div>
                </div>
                <button className="security-manage-btn">Manage</button>
              </div>

              <div className="security-sessions-container">
                <div className="session-list-row">
                  <div className="session-info-meta">
                    <h4>Current Device</h4>
                    <p>Chrome on Windows • Cabuyao, Philippines</p>
                  </div>
                  <span className="session-badge-active">Active</span>
                </div>

                <div className="session-list-row">
                  <div className="session-info-meta">
                    <h4>Mobile App</h4>
                    <p>iPhone 14 • Last active 2 hours ago</p>
                  </div>
                  <button className="session-revoke-btn">Revoke</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= VIEW 4: NOTIFICATIONS VIEW ================= */}
        {currentView === 'notifications' && (
          <div className="detail-view-container security-view-view">
            <button className="back-to-settings-btn" onClick={() => setCurrentView('menu')}>
              ← Back to Settings
            </button>

            <div className="security-section-card">
              <div className="security-card-header">
                <div className="security-icon-box">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#101828" strokeWidth="2">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                    <polyline points="22,6 12,13 2,6"></polyline>
                  </svg>
                </div>
                <div className="security-header-text">
                  <h3>Notification Channels</h3>
                  <span className="security-timestamp">Choose how you want to receive notifications</span>
                </div>
              </div>

              <div className="security-sessions-container">
                <div className="session-list-row">
                  <div className="session-info-meta">
                    <h4>Email Notifications</h4>
                    <p>Receive notifications via email</p>
                  </div>
                  <label className="figma-toggle-switch">
                    <input type="checkbox" checked={notifications.emailNotifications} onChange={(e) => setNotifications({...notifications, emailNotifications: e.target.checked})} />
                    <span className="figma-slider"></span>
                  </label>
                </div>

                <div className="session-list-row">
                  <div className="session-info-meta">
                    <h4>Push Notifications</h4>
                    <p>Receive push notifications in browser</p>
                  </div>
                  <label className="figma-toggle-switch">
                    <input type="checkbox" checked={notifications.pushNotifications} onChange={(e) => setNotifications({...notifications, pushNotifications: e.target.checked})} />
                    <span className="figma-slider"></span>
                  </label>
                </div>

                <div className="session-list-row">
                  <div className="session-info-meta">
                    <h4>SMS Notifications</h4>
                    <p>Receive notifications via text message</p>
                  </div>
                  <label className="figma-toggle-switch">
                    <input type="checkbox" checked={notifications.smsNotifications} onChange={(e) => setNotifications({...notifications, smsNotifications: e.target.checked})} />
                    <span className="figma-slider"></span>
                  </label>
                </div>
              </div>
            </div>

            <div className="security-section-card">
              <div className="security-card-header">
                <div className="security-icon-box">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#101828" strokeWidth="2">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                    <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                  </svg>
                </div>
                <div className="security-header-text">
                  <h3>Case Notifications</h3>
                  <span className="security-timestamp">Get notified about case activities</span>
                </div>
              </div>

              <div className="security-sessions-container">
                <div className="session-list-row">
                  <div className="session-info-meta">
                    <h4>New Case Reported</h4>
                    <p>When a new dengue case is reported in your barangay</p>
                  </div>
                  <label className="figma-toggle-switch">
                    <input type="checkbox" checked={notifications.newCaseReported} onChange={(e) => setNotifications({...notifications, newCaseReported: e.target.checked})} />
                    <span className="figma-slider"></span>
                  </label>
                </div>

                <div className="session-list-row">
                  <div className="session-info-meta">
                    <h4>Case Status Updated</h4>
                    <p>When a case status changes (Active, Recovered, etc.)</p>
                  </div>
                  <label className="figma-toggle-switch">
                    <input type="checkbox" checked={notifications.caseStatusUpdated} onChange={(e) => setNotifications({...notifications, caseStatusUpdated: e.target.checked})} />
                    <span className="figma-slider"></span>
                  </label>
                </div>

                <div className="session-list-row">
                  <div className="session-info-meta">
                    <h4>High Risk Alert</h4>
                    <p>When a high-risk area is identified</p>
                  </div>
                  <label className="figma-toggle-switch">
                    <input type="checkbox" checked={notifications.highRiskAlert} onChange={(e) => setNotifications({...notifications, highRiskAlert: e.target.checked})} />
                    <span className="figma-slider"></span>
                  </label>
                </div>
              </div>
            </div>

            <div className="security-section-card">
              <div className="security-card-header">
                <div className="security-icon-box">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#101828" strokeWidth="2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                  </svg>
                </div>
                <div className="security-header-text">
                  <h3>System Notifications</h3>
                  <span className="security-timestamp">Updates about the system</span>
                </div>
              </div>

              <div className="security-sessions-container">
                <div className="session-list-row">
                  <div className="session-info-meta">
                    <h4>Weekly Summary</h4>
                    <p>Receive a weekly summary of cases and activities</p>
                  </div>
                  <label className="figma-toggle-switch">
                    <input type="checkbox" checked={notifications.weeklySummary} onChange={(e) => setNotifications({...notifications, weeklySummary: e.target.checked})} />
                    <span className="figma-slider"></span>
                  </label>
                </div>

                <div className="session-list-row">
                  <div className="session-info-meta">
                    <h4>System Maintenance</h4>
                    <p>Get notified about scheduled maintenance</p>
                  </div>
                  <label className="figma-toggle-switch">
                    <input type="checkbox" checked={notifications.systemMaintenance} onChange={(e) => setNotifications({...notifications, systemMaintenance: e.target.checked})} />
                    <span className="figma-slider"></span>
                  </label>
                </div>
              </div>
            </div>

            <div className="notifications-action-container">
              <button className="notifications-save-btn" onClick={() => setCurrentView('menu')}>
                Save Preferences
              </button>
            </div>
          </div>
        )}

        {/* ================= VIEW 5: SYSTEM PREFERENCES ================= */}
        {currentView === 'system' && (
          <div className="detail-view-container security-view-view">
            <button className="back-to-settings-btn" onClick={() => setCurrentView('menu')}>
              ← Back to Settings
            </button>

            <div className="security-section-card">
              <div className="security-card-header">
                <div className="security-icon-box">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#101828" strokeWidth="2">
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                    <line x1="8" y1="21" x2="16" y2="21"></line>
                    <line x1="12" y1="17" x2="12" y2="21"></line>
                  </svg>
                </div>
                <div className="security-header-text">
                  <h3>Appearance</h3>
                  <span className="security-timestamp">Customize how the system looks</span>
                </div>
              </div>

              <div className="security-sessions-container">
                <div className="session-list-row">
                  <div className="session-info-meta">
                    <h4>Dark Mode</h4>
                    <p>Switch between light and dark theme</p>
                  </div>
                  <label className="figma-toggle-switch">
                    <input type="checkbox" checked={systemPrefs.darkMode} onChange={(e) => setSystemPrefs({...systemPrefs, darkMode: e.target.checked})} />
                    <span className="figma-slider"></span>
                  </label>
                </div>

                <div className="session-list-row">
                  <div className="session-info-meta">
                    <h4>Font Size</h4>
                    <p>Adjust text size for better readability</p>
                  </div>
                  <div style={{ position: 'relative' }}>
                    <select 
                      value={systemPrefs.fontSize} 
                      onChange={(e) => setSystemPrefs({...systemPrefs, fontSize: e.target.value})}
                      style={{ background: '#ffffff', border: '1px solid #d0d5dd', borderRadius: '8px', padding: '8px 36px 8px 14px', fontSize: '14px', cursor: 'pointer', appearance: 'none', color: '#1f2937', fontWeight: '500', minWidth: '120px' }}
                    >
                      <option value="Small">Small</option>
                      <option value="Medium">Medium</option>
                      <option value="Large">Large</option>
                    </select>
                    <span style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#1f2937', fontSize: '12px' }}>▼</span>
                  </div>
                </div>

                <div className="session-list-row">
                  <div className="session-info-meta">
                    <h4>Compact View</h4>
                    <p>Show more content with less spacing</p>
                  </div>
                  <label className="figma-toggle-switch">
                    <input type="checkbox" checked={systemPrefs.compactView} onChange={(e) => setSystemPrefs({...systemPrefs, compactView: e.target.checked})} />
                    <span className="figma-slider"></span>
                  </label>
                </div>
              </div>
            </div>

            <div className="security-section-card">
              <div className="security-card-header">
                <div className="security-icon-box">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#101828" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="2" y1="12" x2="22" y2="12"></line>
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                  </svg>
                </div>
                <div className="security-header-text">
                  <h3>Language & Region</h3>
                  <span className="security-timestamp">Set your preferred language</span>
                </div>
              </div>

              <div className="security-sessions-container">
                <div className="session-list-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div className="session-info-meta">
                    <h4>Display Language</h4>
                  </div>
                  <div style={{ position: 'relative' }}>
                    <select 
                      value={systemPrefs.displayLanguage} 
                      onChange={(e) => setSystemPrefs({...systemPrefs, displayLanguage: e.target.value})}
                      style={{ background: '#ffffff', border: '1px solid #d0d5dd', borderRadius: '8px', padding: '10px 40px 10px 16px', width: '260px', fontSize: '14px', appearance: 'none', color: '#1f2937', cursor: 'pointer' }}
                    >
                      <option value="English">English</option>
                      <option value="Filipino">Filipino</option>
                    </select>
                    <span style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#1f2937', fontSize: '14px' }}>▼</span>
                  </div>
                </div>

                <div className="session-list-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div className="session-info-meta">
                    <h4>Time Zone</h4>
                  </div>
                  <div style={{ position: 'relative' }}>
                    <select 
                      value={systemPrefs.timeZone} 
                      onChange={(e) => setSystemPrefs({...systemPrefs, timeZone: e.target.value})}
                      style={{ background: '#ffffff', border: '1px solid #d0d5dd', borderRadius: '8px', padding: '10px 40px 10px 16px', width: '260px', fontSize: '14px', appearance: 'none', color: '#1f2937', cursor: 'pointer' }}
                    >
                      <option value="Asia/Manila (GMT+8)">Asia/Manila (GMT+8)</option>
                      <option value="UTC">UTC</option>
                    </select>
                    <span style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#1f2937', fontSize: '14px' }}>▼</span>
                  </div>
                </div>

                <div className="session-list-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div className="session-info-meta">
                    <h4>Date Format</h4>
                  </div>
                  <div style={{ position: 'relative' }}>
                    <select 
                      value={systemPrefs.dateFormat} 
                      onChange={(e) => setSystemPrefs({...systemPrefs, dateFormat: e.target.value})}
                      style={{ background: '#ffffff', border: '1px solid #d0d5dd', borderRadius: '8px', padding: '10px 40px 10px 16px', width: '260px', fontSize: '14px', appearance: 'none', color: '#1f2937', cursor: 'pointer' }}
                    >
                      <option value="MM/DD/YY">MM/DD/YY</option>
                      <option value="DD/MM/YY">DD/MM/YY</option>
                      <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                    </select>
                    <span style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#1f2937', fontSize: '14px' }}>▼</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="security-section-card">
              <div className="security-card-header">
                <div className="security-icon-box">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#101828" strokeWidth="2">
                    <circle cx="12" cy="12" r="3"></circle>
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                  </svg>
                </div>
                <div className="security-header-text">
                  <h3>System Behavior</h3>
                  <span className="security-timestamp">Configure how the system behaves</span>
                </div>
              </div>

              <div className="security-sessions-container">
                <div className="session-list-row">
                  <div className="session-info-meta">
                    <h4>Auto-Save</h4>
                    <p>Automatically save changes while editing</p>
                  </div>
                  <label className="figma-toggle-switch">
                    <input type="checkbox" checked={systemPrefs.autoSave} onChange={(e) => setSystemPrefs({...systemPrefs, autoSave: e.target.checked})} />
                    <span className="figma-slider"></span>
                  </label>
                </div>

                <div className="session-list-row">
                  <div className="session-info-meta">
                    <h4>Confirm Before Delete</h4>
                    <p>Show confirmation dialog before deleting items</p>
                  </div>
                  <label className="figma-toggle-switch">
                    <input type="checkbox" checked={systemPrefs.confirmDelete} onChange={(e) => setSystemPrefs({...systemPrefs, confirmDelete: e.target.checked})} />
                    <span className="figma-slider"></span>
                  </label>
                </div>

                <div className="session-list-row">
                  <div className="session-info-meta">
                    <h4>Keyboard Shortcuts</h4>
                    <p>Enable keyboard shortcuts for quick actions</p>
                  </div>
                  <label className="figma-toggle-switch">
                    <input type="checkbox" checked={systemPrefs.keyboardShortcuts} onChange={(e) => setSystemPrefs({...systemPrefs, keyboardShortcuts: e.target.checked})} />
                    <span className="figma-slider"></span>
                  </label>
                </div>
              </div>
            </div>

            <div className="notifications-action-container">
              <button className="notifications-save-btn" onClick={() => setCurrentView('menu')}>
                Save Preferences
              </button>
            </div>
          </div>
        )}

        {/* ================= VIEW 6: DATA MANAGEMENT ================= */}
        {currentView === 'data' && (
          <div className="detail-view-container security-view-view">
            <button className="back-to-settings-btn" onClick={() => setCurrentView('menu')}>
              ← Back to Settings
            </button>

            {/* CARD 1: STORAGE OVERVIEW */}
            <div className="security-section-card">
              <div className="security-card-header">
                <div className="security-icon-box">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2">
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                    <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                    <line x1="12" y1="22.08" x2="12" y2="12"></line>
                  </svg>
                </div>
                <div className="security-header-text">
                  <h3>Storage Overview</h3>
                  <span className="security-timestamp">Manage your data storage</span>
                </div>
              </div>

              <div style={{ padding: '0 16px 20px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '8px', color: '#4b5563', fontWeight: '500' }}>
                  <span>Storage Used</span>
                  <span style={{ color: '#111827', fontWeight: '600' }}>2.4 GB of 10 GB</span>
                </div>
                
                {/* Custom Progress Bar */}
                <div style={{ width: '100%', height: '12px', background: '#e5e7eb', borderRadius: '6px', overflow: 'hidden', marginBottom: '24px' }}>
                  <div style={{ width: '24%', height: '100%', background: '#111827', borderRadius: '6px' }}></div>
                </div>

                {/* 3-Column Breakdown Metric Box Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                  <div style={{ background: '#f9fafb', border: '1px solid #f3f4f6', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
                    <div style={{ fontSize: '20px', fontWeight: '600', color: '#111827', marginBottom: '4px' }}>1.2 GB</div>
                    <div style={{ fontSize: '13px', color: '#6b7280' }}>Case Data</div>
                  </div>
                  <div style={{ background: '#f9fafb', border: '1px solid #f3f4f6', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
                    <div style={{ fontSize: '20px', fontWeight: '600', color: '#111827', marginBottom: '4px' }}>0.8 GB</div>
                    <div style={{ fontSize: '13px', color: '#6b7280' }}>Reports</div>
                  </div>
                  <div style={{ background: '#f9fafb', border: '1px solid #f3f4f6', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
                    <div style={{ fontSize: '20px', fontWeight: '600', color: '#111827', marginBottom: '4px' }}>0.4 GB</div>
                    <div style={{ fontSize: '13px', color: '#6b7280' }}>Other</div>
                  </div>
                </div>
              </div>
            </div>

            {/* CARD 2: EXPORT DATA */}
            <div className="security-section-card">
              <div className="security-card-header">
                <div className="security-icon-box">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="7 10 12 15 17 10"></polyline>
                    <line x1="12" y1="15" x2="12" y2="3"></line>
                  </svg>
                </div>
                <div className="security-header-text">
                  <h3>Export Data</h3>
                  <span className="security-timestamp">Download your data in various formats</span>
                </div>
              </div>

              <div className="security-sessions-container">
                {/* PDF Row */}
                <div className="session-list-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ width: '40px', height: '40px', background: '#fef2f2', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                      </svg>
                    </div>
                    <div className="session-info-meta">
                      <h4 style={{ margin: '0 0 2px 0', fontSize: '15px', fontWeight: '500' }}>Export as PDF</h4>
                      <p style={{ margin: '0', fontSize: '13px', color: '#6b7280' }}>Download all data as PDF documents</p>
                    </div>
                  </div>
                  <button style={{ background: '#ffffff', border: '1px solid #d1d5db', borderRadius: '8px', padding: '6px 16px', fontSize: '14px', fontWeight: '500', color: '#374151', cursor: 'pointer' }}>Export</button>
                </div>

                {/* Excel Row */}
                <div className="session-list-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ width: '40px', height: '40px', background: '#f0fdf4', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                      </svg>
                    </div>
                    <div className="session-info-meta">
                      <h4 style={{ margin: '0 0 2px 0', fontSize: '15px', fontWeight: '500' }}>Export as Excel</h4>
                      <p style={{ margin: '0', fontSize: '13px', color: '#6b7280' }}>Download data as Excel spreadsheet</p>
                    </div>
                  </div>
                  <button style={{ background: '#ffffff', border: '1px solid #d1d5db', borderRadius: '8px', padding: '6px 16px', fontSize: '14px', fontWeight: '500', color: '#374151', cursor: 'pointer' }}>Export</button>
                </div>

                {/* CSV Row */}
                <div className="session-list-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ width: '40px', height: '40px', background: '#eff6ff', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                      </svg>
                    </div>
                    <div className="session-info-meta">
                      <h4 style={{ margin: '0 0 2px 0', fontSize: '15px', fontWeight: '500' }}>Export as CSV</h4>
                      <p style={{ margin: '0', fontSize: '13px', color: '#6b7280' }}>Download data as CSV file</p>
                    </div>
                  </div>
                  <button style={{ background: '#ffffff', border: '1px solid #d1d5db', borderRadius: '8px', padding: '6px 16px', fontSize: '14px', fontWeight: '500', color: '#374151', cursor: 'pointer' }}>Export</button>
                </div>
              </div>
            </div>

            {/* CARD 3: BACKUP & RESTORE */}
            <div className="security-section-card">
              <div className="security-card-header">
                <div className="security-icon-box">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2">
                    <path d="M23 12a11 11 0 1 1-22 0V4a2 2 0 0 1 2-2h18a2 2 0 0 1 2 2z"></path>
                    <polyline points="4 6 12 12 20 6"></polyline>
                  </svg>
                </div>
                <div className="security-header-text">
                  <h3>Backup & Restore</h3>
                  <span className="security-timestamp">Manage data backups</span>
                </div>
              </div>

              <div className="security-sessions-container">
                {/* Last Backup Log Row */}
                <div className="session-list-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div className="session-info-meta">
                    <h4 style={{ margin: '0 0 2px 0', fontSize: '15px', fontWeight: '500' }}>Last Backup</h4>
                    <p style={{ margin: '0', fontSize: '13px', color: '#6b7280' }}>March 15, 2026 at 2:30 AM</p>
                  </div>
                  <span style={{ background: '#d1fae5', color: '#065f46', fontSize: '12px', fontWeight: '600', padding: '4px 12px', borderRadius: '9999px' }}>Successful</span>
                </div>

                {/* Primary/Secondary Action Row */}
                <div style={{ display: 'flex', gap: '16px', padding: '16px 0 8px 0' }}>
                  <button style={{ flex: 1, background: '#1e3a8a', color: '#ffffff', border: 'none', borderRadius: '8px', padding: '12px', fontSize: '14px', fontWeight: '500', cursor: 'pointer' }}>
                    Create Backup
                  </button>
                  <button style={{ flex: 1, background: '#f3f4f6', color: '#374151', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '12px', fontSize: '14px', fontWeight: '500', cursor: 'pointer' }}>
                    Restore
                  </button>
                </div>

                {/* Auto Backup Switch Row */}
                <div className="session-list-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #e5e7eb', marginTop: '16px', paddingTop: '20px' }}>
                  <div className="session-info-meta">
                    <h4 style={{ margin: '0 0 2px 0', fontSize: '15px', fontWeight: '500' }}>Auto-Backup</h4>
                    <p style={{ margin: '0', fontSize: '13px', color: '#6b7280' }}>Automatically backup data weekly</p>
                  </div>
                  <span style={{ fontSize: '14px', fontWeight: '500', color: '#4b5563' }}>Enabled</span>
                </div>
              </div>
            </div>

            {/* CARD 4: DANGER ZONE */}
            <div className="security-section-card">
              <div className="security-card-header">
                <div className="security-icon-box" style={{ background: '#fef2f2' }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                    <line x1="12" y1="9" x2="12" y2="13"></line>
                    <line x1="12" y1="17" x2="12.01" y2="17"></line>
                  </svg>
                </div>
                <div className="security-header-text">
                  <h3 style={{ color: '#b91c1c' }}>Danger Zone</h3>
                  <span className="security-timestamp">Irreversible actions</span>
                </div>
              </div>

              <div style={{ padding: '0 16px 20px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: '12px', padding: '20px 24px' }}>
                  <div>
                    <h4 style={{ margin: '0 0 4px 0', fontSize: '15px', fontWeight: '600', color: '#991b1b' }}>Clear All Data</h4>
                    <p style={{ margin: '0', fontSize: '13px', color: '#b91c1c', opacity: 0.85 }}>This will permanently delete all your data. This action cannot be undone.</p>
                  </div>
                  <button style={{ background: '#ffffff', border: '1px solid #fca5a5', borderRadius: '8px', padding: '8px 16px', fontSize: '14px', fontWeight: '500', color: '#dc2626', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                    <span>🗑️</span> Clear Data
                  </button>
                </div>
              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}