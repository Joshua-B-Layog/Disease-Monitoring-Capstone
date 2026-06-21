import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import './ChoSettings.css';

export default function CHOSettings({
  activeUser,
  userId,
  loggedUser,
  setLoggedUser,
  profilePhoto,
  onProfilePhotoChange,
}) {
  const [currentView, setCurrentView] = useState('menu');
  const fileInputRef = useRef(null);

  // ── Profile data from DB ──
  const [profile, setProfile] = useState({
    firstName: '',
    lastName: '',
    username: '',
    email: '',
    phone: '',
    assignment: activeUser?.context || '',
    assignedBarangayId: null,
  });
  const [profileLoading, setProfileLoading] = useState(true);
  const [saveMsg, setSaveMsg]     = useState('');
  const [saving, setSaving]       = useState(false);

  // ── Barangay list ──
  const [barangayList, setBarangayList] = useState([]);

  // ── Security ──
  const [security, setSecurity] = useState({
    currentPassword: '', newPassword: '', confirmPassword: ''
  });

  // ── Notifications ──
  const [notifications, setNotifications] = useState({
    emailNotifications: false, pushNotifications: false, smsNotifications: false,
    newCaseReported: false, caseStatusUpdated: false, highRiskAlert: false,
    weeklySummary: false, systemMaintenance: false,
  });

  // ── System Prefs ──
  const [systemPrefs, setSystemPrefs] = useState({
    darkMode: false, fontSize: 'Medium', compactView: false,
    displayLanguage: 'English', timeZone: 'Asia/Manila (GMT+8)',
    dateFormat: 'MM/DD/YY', autoSave: false, confirmDelete: false,
    keyboardShortcuts: false,
  });

  const [showCurrent, setShowCurrent]   = useState(false);
  const [showNew, setShowNew]           = useState(false);
  const [showConfirm, setShowConfirm]   = useState(false);
  const [isTwoFactorEnabled, setIsTwoFactorEnabled] = useState(false);

  // ── Load profile from DB on mount ──
  useEffect(() => {
    if (!userId) {
      // No userId yet — use whatever loggedUser name we have as a fallback
      const parts = (loggedUser || '').trim().split(' ');
      setProfile(prev => ({
        ...prev,
        firstName: parts[0] || '',
        lastName: parts.slice(1).join(' ') || '',
      }));
      setProfileLoading(false);
      return;
    }

    setProfileLoading(true);
    axios.get(`http://localhost:5000/api/users/${userId}/profile`)
      .then(res => {
        const d = res.data;
        const parts = (d.full_name || '').trim().split(' ');
        setProfile({
          firstName: parts[0] || '',
          lastName: parts.slice(1).join(' ') || '',
          username: d.username || '',
          email: d.email || '',
          phone: d.mobile_number || '',
          assignment: d.assigned_barangay_name || activeUser?.context || '',
          assignedBarangayId: d.assigned_barangay_id || null,
        });
        setProfileLoading(false);
      })
      .catch(err => {
        console.error('Failed to load profile:', err);
        setProfileLoading(false);
      });
  }, [userId]);

  // ── Load barangay list ──
  useEffect(() => {
    axios.get('http://localhost:5000/api/barangays')
      .then(res => setBarangayList(res.data))
      .catch(() => {});
  }, []);

  // ── Handle photo upload ──
  const handleImageChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onloadend = () => {
        onProfilePhotoChange(reader.result); // sends base64 up to App.jsx
      };
      reader.readAsDataURL(file);
    }
  };

  // ── Save profile changes to DB ──
  const handleSaveProfile = async () => {
    if (!profile.firstName.trim() || !profile.lastName.trim()) {
      setSaveMsg('First name and last name are required.');
      return;
    }

    setSaving(true);
    setSaveMsg('');

    try {
      const res = await axios.put(`http://localhost:5000/api/users/${userId}/profile`, {
        firstName: profile.firstName,
        lastName: profile.lastName,
        email: profile.email,
        mobile: profile.phone,
        assignedBarangayId: profile.assignedBarangayId,
      });

      // Update the top-nav name in real time
      if (setLoggedUser) {
        setLoggedUser(res.data.fullName);
      }

      setSaveMsg('✅ Profile saved successfully!');
      setTimeout(() => {
        setSaveMsg('');
        setCurrentView('menu');
      }, 1500);
    } catch (err) {
      setSaveMsg('❌ ' + (err.response?.data?.error || 'Failed to save profile.'));
    } finally {
      setSaving(false);
    }
  };

  // Derive display name for the profile header
  const displayName = `${profile.firstName} ${profile.lastName}`.trim() || loggedUser || 'CHO Admin';
  const initials = (() => {
    const parts = displayName.trim().split(' ').filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return displayName.slice(0, 2).toUpperCase();
  })();

  // ── Navigation Card component ──
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

        {/* ── MENU VIEW ── */}
        {currentView === 'menu' && (
          <div>
            <h1 className="settings-title">Settings</h1>
            <p className="settings-subtitle">
              Manage your account credentials, notifications, and core configuration behaviors.
            </p>
            <div className="menu-grid">
              <NavigationCard title="Profile Settings" icon="👤" view="profile" />
              <NavigationCard title="Account Security" icon="🔒" view="security" />
              <NavigationCard title="Notifications"    icon="🔔" view="notifications" />
              <NavigationCard title="System Preferences" icon="⚙️" view="system" />
              <NavigationCard title="Data Management"  icon="💾" view="data" isFullWidth />
            </div>
          </div>
        )}

        {/* ── PROFILE SETTINGS VIEW ── */}
        {currentView === 'profile' && (
          <div className="detail-view-container">
            <button
              className="back-to-settings-btn"
              onClick={() => { setCurrentView('menu'); setSaveMsg(''); }}
              style={{ display: 'flex', alignItems: 'center', background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', fontWeight: '500', color: '#1f2937', marginBottom: '24px' }}
            >
              <span style={{ marginRight: '8px', fontSize: '20px' }}>←</span> Back to Settings
            </button>

            {profileLoading ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>Loading profile...</div>
            ) : (
              <>
                {/* ── Avatar + name header ── */}
                <div className="profile-header-container" style={{ display: 'flex', alignItems: 'center', gap: '24px', marginBottom: '24px' }}>
                  <div className="avatar-wrapper" style={{ position: 'relative', width: '110px', height: '110px', flexShrink: 0 }}>
                    <div
                      className="profile-avatar-circle"
                      style={{
                        width: '100%', height: '100%', borderRadius: '50%',
                        background: profilePhoto ? 'transparent' : '#10b981',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                      }}
                    >
                      {profilePhoto ? (
                        <img
                          src={profilePhoto}
                          alt="Profile"
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : (
                        <span style={{ color: '#ffffff', fontSize: '32px', fontWeight: '600', letterSpacing: '1px' }}>
                          {initials}
                        </span>
                      )}
                    </div>

                    {/* Camera badge */}
                    <div
                      onClick={() => fileInputRef.current.click()}
                      style={{
                        position: 'absolute', bottom: '0', right: '4px',
                        width: '32px', height: '32px', borderRadius: '50%',
                        background: '#2563eb', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', cursor: 'pointer',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                        <circle cx="12" cy="13" r="4" />
                      </svg>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <h2 style={{ fontSize: '24px', fontWeight: '600', color: '#111827', margin: 0 }}>
                      {displayName}
                    </h2>
                    <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>
                      {activeUser?.role || 'CHO'} Specialist — {profile.assignment || activeUser?.context || ''}
                    </p>
                    <button
                      onClick={() => fileInputRef.current.click()}
                      style={{
                        background: '#2563eb', color: '#ffffff', border: 'none',
                        borderRadius: '8px', padding: '8px 18px', fontSize: '14px',
                        fontWeight: '500', cursor: 'pointer', marginTop: '6px',
                        width: 'fit-content', boxShadow: '0 2px 4px rgba(37,99,235,0.2)',
                      }}
                    >
                      Change Photo
                    </button>
                    {profilePhoto && (
                      <button
                        onClick={() => onProfilePhotoChange(null)}
                        style={{
                          background: 'transparent', color: '#ef4444', border: '1px solid #fca5a5',
                          borderRadius: '8px', padding: '6px 14px', fontSize: '13px',
                          cursor: 'pointer', width: 'fit-content',
                        }}
                      >
                        Remove Photo
                      </button>
                    )}
                  </div>

                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleImageChange}
                    style={{ display: 'none' }}
                    accept="image/*"
                  />
                </div>

                <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb', margin: '24px 0' }} />

                {/* ── Save message ── */}
                {saveMsg && (
                  <div style={{
                    background: saveMsg.startsWith('✅') ? '#d1fae5' : '#fee2e2',
                    color: saveMsg.startsWith('✅') ? '#065f46' : '#991b1b',
                    padding: '12px 16px', borderRadius: '8px', marginBottom: '20px',
                    fontSize: '14px', fontWeight: '500',
                  }}>
                    {saveMsg}
                  </div>
                )}

                {/* ── Form fields ── */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '40px' }}>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '12px', fontWeight: '500', color: '#4b5563', paddingLeft: '2px' }}>First Name</label>
                    <input
                      type="text"
                      value={profile.firstName}
                      onChange={e => setProfile({ ...profile, firstName: e.target.value })}
                      style={fieldStyle}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '12px', fontWeight: '500', color: '#4b5563', paddingLeft: '2px' }}>Last Name</label>
                    <input
                      type="text"
                      value={profile.lastName}
                      onChange={e => setProfile({ ...profile, lastName: e.target.value })}
                      style={fieldStyle}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '12px', fontWeight: '500', color: '#4b5563', paddingLeft: '2px' }}>Username</label>
                    <input
                      type="text"
                      value={profile.username}
                      readOnly
                      style={{ ...fieldStyle, background: '#f9fafb', color: '#9ca3af', cursor: 'not-allowed' }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '12px', fontWeight: '500', color: '#4b5563', paddingLeft: '2px' }}>Email</label>
                    <input
                      type="email"
                      value={profile.email}
                      onChange={e => setProfile({ ...profile, email: e.target.value })}
                      style={fieldStyle}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '12px', fontWeight: '500', color: '#4b5563', paddingLeft: '2px' }}>Contact Number</label>
                    <input
                      type="text"
                      value={profile.phone}
                      onChange={e => setProfile({ ...profile, phone: e.target.value })}
                      style={fieldStyle}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '12px', fontWeight: '500', color: '#4b5563', paddingLeft: '2px' }}>Unit Office Assignment</label>
                    <select
                      value={profile.assignedBarangayId || ''}
                      onChange={e => {
                        const selected = barangayList.find(b => b.id === parseInt(e.target.value));
                        setProfile({
                          ...profile,
                          assignedBarangayId: e.target.value ? parseInt(e.target.value) : null,
                          assignment: selected ? selected.name : '',
                        });
                      }}
                      style={{ ...fieldStyle, cursor: 'pointer' }}
                    >
                      <option value="">— Select Assignment —</option>
                      {barangayList.map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '16px', marginTop: '24px' }}>
                  <button
                    onClick={() => { setCurrentView('menu'); setSaveMsg(''); }}
                    style={{
                      background: '#ffffff', border: '1px solid #d1d5db', color: '#1f2937',
                      borderRadius: '12px', padding: '12px 48px', fontSize: '15px',
                      fontWeight: '500', cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveProfile}
                    disabled={saving}
                    style={{
                      background: saving ? '#6ee7b7' : '#10b981', border: 'none', color: '#ffffff',
                      borderRadius: '12px', padding: '12px', fontSize: '15px',
                      fontWeight: '500', cursor: saving ? 'not-allowed' : 'pointer', flexGrow: 1,
                    }}
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── ACCOUNT SECURITY VIEW ── */}
        {currentView === 'security' && (
          <div className="detail-view-container security-view-view">
            <button className="back-to-settings-btn" onClick={() => setCurrentView('menu')}>
              ← Back to Settings
            </button>

            <div className="security-section-card">
              <div className="security-card-header">
                <div className="security-icon-box">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </div>
                <div className="security-header-text">
                  <h3>Change Password</h3>
                  <span className="security-timestamp">Last Updated 3 Months Ago</span>
                </div>
              </div>

              <div className="security-card-body">
                {['currentPassword', 'newPassword', 'confirmPassword'].map((field, i) => {
                  const labels = ['Current Password', 'New Password', 'Confirm New Password'];
                  const shows  = [showCurrent, showNew, showConfirm];
                  const setters = [setShowCurrent, setShowNew, setShowConfirm];
                  return (
                    <div key={field} className="security-input-row">
                      <label>{labels[i]}</label>
                      <div className="security-password-wrapper">
                        <input
                          type={shows[i] ? 'text' : 'password'}
                          value={security[field]}
                          onChange={e => setSecurity({ ...security, [field]: e.target.value })}
                          placeholder={`Enter ${labels[i]}`}
                        />
                        <button type="button" className="security-eye-btn" onClick={() => setters[i](!shows[i])}>
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1f2937" strokeWidth="2">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  );
                })}
                <button className="security-action-blue-btn">Update Password</button>
              </div>
            </div>

            <div className="security-section-card row-layout-card">
              <div className="security-card-header no-margin">
                <div className="security-icon-box">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                </div>
                <div className="security-header-text">
                  <h3>Two-Factor Authentication</h3>
                  <span className="security-timestamp">Currently disabled</span>
                </div>
              </div>
              <div className="security-card-action">
                <label className="figma-toggle-switch">
                  <input type="checkbox" checked={isTwoFactorEnabled} onChange={e => setIsTwoFactorEnabled(e.target.checked)} />
                  <span className="figma-slider" />
                </label>
              </div>
            </div>

            <div className="security-section-card">
              <div className="security-card-header space-between-layout">
                <div className="header-flex-left">
                  <div className="security-icon-box green-icon-box">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2">
                      <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
                      <line x1="12" y1="18" x2="12.01" y2="18" />
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

        {/* ── NOTIFICATIONS VIEW ── */}
        {currentView === 'notifications' && (
          <div className="detail-view-container security-view-view">
            <button className="back-to-settings-btn" onClick={() => setCurrentView('menu')}>
              ← Back to Settings
            </button>

            {[
              {
                icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#101828" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>,
                title: 'Notification Channels', subtitle: 'Choose how you want to receive notifications',
                rows: [
                  { key: 'emailNotifications', label: 'Email Notifications', sub: 'Receive notifications via email' },
                  { key: 'pushNotifications',  label: 'Push Notifications',  sub: 'Receive push notifications in browser' },
                  { key: 'smsNotifications',   label: 'SMS Notifications',   sub: 'Receive notifications via text message' },
                ],
              },
              {
                icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#101828" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
                title: 'Case Notifications', subtitle: 'Get notified about case activities',
                rows: [
                  { key: 'newCaseReported',   label: 'New Case Reported',   sub: 'When a new case is reported in your barangay' },
                  { key: 'caseStatusUpdated', label: 'Case Status Updated', sub: 'When a case status changes' },
                  { key: 'highRiskAlert',     label: 'High Risk Alert',     sub: 'When a high-risk area is identified' },
                ],
              },
              {
                icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#101828" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
                title: 'System Notifications', subtitle: 'Updates about the system',
                rows: [
                  { key: 'weeklySummary',    label: 'Weekly Summary',    sub: 'Receive a weekly summary of cases' },
                  { key: 'systemMaintenance', label: 'System Maintenance', sub: 'Get notified about scheduled maintenance' },
                ],
              },
            ].map(section => (
              <div key={section.title} className="security-section-card">
                <div className="security-card-header">
                  <div className="security-icon-box">{section.icon}</div>
                  <div className="security-header-text">
                    <h3>{section.title}</h3>
                    <span className="security-timestamp">{section.subtitle}</span>
                  </div>
                </div>
                <div className="security-sessions-container">
                  {section.rows.map(row => (
                    <div key={row.key} className="session-list-row">
                      <div className="session-info-meta"><h4>{row.label}</h4><p>{row.sub}</p></div>
                      <label className="figma-toggle-switch">
                        <input type="checkbox" checked={notifications[row.key]}
                          onChange={e => setNotifications({ ...notifications, [row.key]: e.target.checked })} />
                        <span className="figma-slider" />
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <div className="notifications-action-container">
              <button className="notifications-save-btn" onClick={() => setCurrentView('menu')}>
                Save Preferences
              </button>
            </div>
          </div>
        )}

        {/* ── SYSTEM PREFERENCES VIEW ── */}
        {currentView === 'system' && (
          <div className="detail-view-container security-view-view">
            <button className="back-to-settings-btn" onClick={() => setCurrentView('menu')}>
              ← Back to Settings
            </button>

            <div className="security-section-card">
              <div className="security-card-header">
                <div className="security-icon-box">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#101828" strokeWidth="2">
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                    <line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
                  </svg>
                </div>
                <div className="security-header-text">
                  <h3>Appearance</h3>
                  <span className="security-timestamp">Customize how the system looks</span>
                </div>
              </div>
              <div className="security-sessions-container">
                <div className="session-list-row">
                  <div className="session-info-meta"><h4>Dark Mode</h4><p>Switch between light and dark theme</p></div>
                  <label className="figma-toggle-switch">
                    <input type="checkbox" checked={systemPrefs.darkMode}
                      onChange={e => setSystemPrefs({ ...systemPrefs, darkMode: e.target.checked })} />
                    <span className="figma-slider" />
                  </label>
                </div>
                <div className="session-list-row">
                  <div className="session-info-meta"><h4>Font Size</h4><p>Adjust text size for better readability</p></div>
                  <div style={{ position: 'relative' }}>
                    <select value={systemPrefs.fontSize}
                      onChange={e => setSystemPrefs({ ...systemPrefs, fontSize: e.target.value })}
                      style={{ background: '#fff', border: '1px solid #d0d5dd', borderRadius: '8px', padding: '8px 36px 8px 14px', fontSize: '14px', cursor: 'pointer', appearance: 'none', color: '#1f2937', minWidth: '120px' }}>
                      <option>Small</option><option>Medium</option><option>Large</option>
                    </select>
                    <span style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#1f2937', fontSize: '12px' }}>▼</span>
                  </div>
                </div>
                <div className="session-list-row">
                  <div className="session-info-meta"><h4>Compact View</h4><p>Show more content with less spacing</p></div>
                  <label className="figma-toggle-switch">
                    <input type="checkbox" checked={systemPrefs.compactView}
                      onChange={e => setSystemPrefs({ ...systemPrefs, compactView: e.target.checked })} />
                    <span className="figma-slider" />
                  </label>
                </div>
              </div>
            </div>

            <div className="security-section-card">
              <div className="security-card-header">
                <div className="security-icon-box">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#101828" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="2" y1="12" x2="22" y2="12"/>
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                  </svg>
                </div>
                <div className="security-header-text">
                  <h3>Language & Region</h3>
                  <span className="security-timestamp">Set your preferred language</span>
                </div>
              </div>
              <div className="security-sessions-container">
                {[
                  { label: 'Display Language', key: 'displayLanguage', opts: ['English', 'Filipino'] },
                  { label: 'Time Zone',         key: 'timeZone',        opts: ['Asia/Manila (GMT+8)', 'UTC'] },
                  { label: 'Date Format',       key: 'dateFormat',      opts: ['MM/DD/YY', 'DD/MM/YY', 'YYYY-MM-DD'] },
                ].map(item => (
                  <div key={item.key} className="session-list-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div className="session-info-meta"><h4>{item.label}</h4></div>
                    <div style={{ position: 'relative' }}>
                      <select value={systemPrefs[item.key]}
                        onChange={e => setSystemPrefs({ ...systemPrefs, [item.key]: e.target.value })}
                        style={{ background: '#fff', border: '1px solid #d0d5dd', borderRadius: '8px', padding: '10px 40px 10px 16px', width: '260px', fontSize: '14px', appearance: 'none', color: '#1f2937', cursor: 'pointer' }}>
                        {item.opts.map(o => <option key={o}>{o}</option>)}
                      </select>
                      <span style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#1f2937', fontSize: '14px' }}>▼</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="notifications-action-container">
              <button className="notifications-save-btn" onClick={() => setCurrentView('menu')}>
                Save Preferences
              </button>
            </div>
          </div>
        )}

        {/* ── DATA MANAGEMENT VIEW ── */}
        {currentView === 'data' && (
          <div className="detail-view-container security-view-view">
            <button className="back-to-settings-btn" onClick={() => setCurrentView('menu')}>
              ← Back to Settings
            </button>

            <div className="security-section-card">
              <div className="security-card-header">
                <div className="security-icon-box">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2">
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                    <polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>
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
                <div style={{ width: '100%', height: '12px', background: '#e5e7eb', borderRadius: '6px', overflow: 'hidden', marginBottom: '24px' }}>
                  <div style={{ width: '24%', height: '100%', background: '#111827', borderRadius: '6px' }} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                  {[['1.2 GB', 'Case Data'], ['0.8 GB', 'Reports'], ['0.4 GB', 'Other']].map(([val, lbl]) => (
                    <div key={lbl} style={{ background: '#f9fafb', border: '1px solid #f3f4f6', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
                      <div style={{ fontSize: '20px', fontWeight: '600', color: '#111827', marginBottom: '4px' }}>{val}</div>
                      <div style={{ fontSize: '13px', color: '#6b7280' }}>{lbl}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="security-section-card">
              <div className="security-card-header">
                <div className="security-icon-box">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                </div>
                <div className="security-header-text">
                  <h3>Export Data</h3>
                  <span className="security-timestamp">Download your data in various formats</span>
                </div>
              </div>
              <div className="security-sessions-container">
                {[
                  { icon: '#ef4444', label: 'Export as PDF', sub: 'Download all data as PDF documents' },
                  { icon: '#22c55e', label: 'Export as Excel', sub: 'Download data as Excel spreadsheet' },
                  { icon: '#3b82f6', label: 'Export as CSV', sub: 'Download data as CSV file' },
                ].map(row => (
                  <div key={row.label} className="session-list-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <div style={{ width: '40px', height: '40px', background: row.icon + '20', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={row.icon} strokeWidth="2">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                          <polyline points="14 2 14 8 20 8"/>
                        </svg>
                      </div>
                      <div className="session-info-meta">
                        <h4 style={{ margin: '0 0 2px 0', fontSize: '15px', fontWeight: '500' }}>{row.label}</h4>
                        <p style={{ margin: 0, fontSize: '13px', color: '#6b7280' }}>{row.sub}</p>
                      </div>
                    </div>
                    <button style={{ background: '#ffffff', border: '1px solid #d1d5db', borderRadius: '8px', padding: '6px 16px', fontSize: '14px', fontWeight: '500', color: '#374151', cursor: 'pointer' }}>
                      Export
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="security-section-card">
              <div className="security-card-header">
                <div className="security-icon-box" style={{ background: '#fef2f2' }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
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
                    <p style={{ margin: 0, fontSize: '13px', color: '#b91c1c', opacity: 0.85 }}>
                      This will permanently delete all your data. This action cannot be undone.
                    </p>
                  </div>
                  <button style={{ background: '#ffffff', border: '1px solid #fca5a5', borderRadius: '8px', padding: '8px 16px', fontSize: '14px', fontWeight: '500', color: '#dc2626', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    🗑️ Clear Data
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

// Shared field style
const fieldStyle = {
  background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '12px',
  padding: '12px 16px', fontSize: '15px', color: '#1f2937',
  boxShadow: '0 2px 4px rgba(0,0,0,0.02)', outline: 'none', width: '100%',
  boxSizing: 'border-box',
};


