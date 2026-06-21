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
  const [saveMsg, setSaveMsg] = useState('');
  const [saving, setSaving] = useState(false);

  // ── Session data from DB ──
  const [sessionData, setSessionData] = useState({
    last_login: null,
    last_login_location: null,
    last_login_device: null,
    previous_login: null,
    previous_login_location: null,
    previous_login_device: null,
  });
  const [otherSessionsCleared, setOtherSessionsCleared] = useState(false);

  // ── Barangay list ──
  const [barangayList, setBarangayList] = useState([]);

  // ── Security ──
  const [security, setSecurity] = useState({
    currentPassword: '', newPassword: '', confirmPassword: ''
  });
  const [passwordMsg, setPasswordMsg] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  // ── 2FA ──
  const [isTwoFactorEnabled, setIsTwoFactorEnabled] = useState(false);
  const [twoFaStep, setTwoFaStep] = useState('idle'); // 'idle' | 'email_sent' | 'verified'
  const [twoFaLoading, setTwoFaLoading] = useState(false);
  const [twoFaMsg, setTwoFaMsg] = useState('');

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

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // ── Load profile from DB on mount ──
  useEffect(() => {
    if (!userId) {
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
        setSessionData({
          last_login: d.last_login,
          last_login_location: d.last_login_location,
          last_login_device: d.last_login_device,
          previous_login: d.previous_login,
          previous_login_location: d.previous_login_location,
          previous_login_device: d.previous_login_device,
        });
        setProfileLoading(false);
      })
      .catch(() => setProfileLoading(false));
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
      reader.onloadend = () => { onProfilePhotoChange(reader.result); };
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
      if (setLoggedUser) setLoggedUser(res.data.fullName);
      setSaveMsg('✅ Profile saved successfully!');
      setTimeout(() => { setSaveMsg(''); setCurrentView('menu'); }, 1500);
    } catch (err) {
      setSaveMsg('❌ ' + (err.response?.data?.error || 'Failed to save profile.'));
    } finally {
      setSaving(false);
    }
  };

  // ── Change Password ──
  const handleChangePassword = async () => {
    setPasswordMsg('');
    if (!security.currentPassword || !security.newPassword || !security.confirmPassword) {
      setPasswordMsg('❌ All password fields are required.');
      return;
    }
    if (security.newPassword !== security.confirmPassword) {
      setPasswordMsg('❌ New passwords do not match.');
      return;
    }
    if (security.newPassword.length < 6) {
      setPasswordMsg('❌ New password must be at least 6 characters.');
      return;
    }

    setPasswordLoading(true);
    try {
      await axios.put(`http://localhost:5000/api/users/${userId}/change-password`, {
        currentPassword: security.currentPassword,
        newPassword: security.newPassword,
      });
      setPasswordMsg('✅ Password updated successfully!');
      setSecurity({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      setPasswordMsg('❌ ' + (err.response?.data?.error || 'Failed to update password.'));
    } finally {
      setPasswordLoading(false);
    }
  };

  // ── 2FA Toggle ──
  const handle2FAToggle = async () => {
    if (isTwoFactorEnabled) {
      // Turning OFF
      setIsTwoFactorEnabled(false);
      setTwoFaStep('idle');
      setTwoFaMsg('');
      return;
    }

    // Turning ON — send verification email
    setTwoFaLoading(true);
    setTwoFaMsg('');
    try {
      await axios.post('http://localhost:5000/api/send-2fa-email', { userId });
      setTwoFaStep('email_sent');
      setTwoFaMsg(`✅ Verification email sent to ${maskEmail(profile.email)}. Click the link in your email to activate 2FA.`);
    } catch (err) {
      setTwoFaMsg('❌ Failed to send verification email. Please try again.');
    } finally {
      setTwoFaLoading(false);
    }
  };

  // ── Format helpers ──
  const maskEmail = (email) => {
    if (!email) return '—';
    const [user, domain] = email.split('@');
    if (!domain) return email;
    return `${user.slice(0, 2)}***@${domain}`;
  };

  const formatLoginTime = (ts) => {
    if (!ts) return null;
    const date = new Date(ts);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just Now';
    if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    if (diffDays === 1) return 'Yesterday';
    return date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const getDeviceIcon = (device) => {
    if (!device) return '💻';
    const d = device.toLowerCase();
    if (d.includes('iphone') || d.includes('android')) return '📱';
    if (d.includes('ipad')) return '📱';
    if (d.includes('mac')) return '💻';
    return '🖥️';
  };

  // Derive display name
  const displayName = `${profile.firstName} ${profile.lastName}`.trim() || loggedUser || 'CHO Admin';
  const initials = (() => {
    const parts = displayName.trim().split(' ').filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return displayName.slice(0, 2).toUpperCase();
  })();

  // ── Navigation Card ──
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
              <NavigationCard title="Notifications" icon="🔔" view="notifications" />
              <NavigationCard title="System Preferences" icon="⚙️" view="system" />
              <NavigationCard title="Data Management" icon="💾" view="data" isFullWidth />
            </div>
          </div>
        )}

        {/* ── PROFILE SETTINGS VIEW ── */}
        {currentView === 'profile' && (
          <div className="detail-view-container">
            <button className="back-to-settings-btn" onClick={() => { setCurrentView('menu'); setSaveMsg(''); }}
              style={{ display: 'flex', alignItems: 'center', background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', fontWeight: '500', color: '#1f2937', marginBottom: '24px' }}>
              <span style={{ marginRight: '8px', fontSize: '20px' }}>←</span> Back to Settings
            </button>

            {profileLoading ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>Loading profile...</div>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '24px', marginBottom: '24px' }}>
                  <div style={{ position: 'relative', width: '110px', height: '110px', flexShrink: 0 }}>
                    <div style={{
                      width: '100%', height: '100%', borderRadius: '50%',
                      background: profilePhoto ? 'transparent' : '#10b981',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                    }}>
                      {profilePhoto ? (
                        <img src={profilePhoto} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <span style={{ color: '#ffffff', fontSize: '32px', fontWeight: '600' }}>{initials}</span>
                      )}
                    </div>
                    <div onClick={() => fileInputRef.current.click()} style={{
                      position: 'absolute', bottom: '0', right: '4px', width: '32px', height: '32px',
                      borderRadius: '50%', background: '#2563eb', display: 'flex', alignItems: 'center',
                      justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
                    }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                        <circle cx="12" cy="13" r="4" />
                      </svg>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <h2 style={{ fontSize: '24px', fontWeight: '600', color: '#111827', margin: 0 }}>{displayName}</h2>
                    <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>
                      {activeUser?.role || 'CHO'} Specialist — {profile.assignment || activeUser?.context || ''}
                    </p>
                    <button onClick={() => fileInputRef.current.click()}
                      style={{ background: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '8px', padding: '8px 18px', fontSize: '14px', fontWeight: '500', cursor: 'pointer', marginTop: '6px', width: 'fit-content' }}>
                      Change Photo
                    </button>
                    {profilePhoto && (
                      <button onClick={() => onProfilePhotoChange(null)}
                        style={{ background: 'transparent', color: '#ef4444', border: '1px solid #fca5a5', borderRadius: '8px', padding: '6px 14px', fontSize: '13px', cursor: 'pointer', width: 'fit-content' }}>
                        Remove Photo
                      </button>
                    )}
                  </div>
                  <input type="file" ref={fileInputRef} onChange={handleImageChange} style={{ display: 'none' }} accept="image/*" />
                </div>

                <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb', margin: '24px 0' }} />

                {saveMsg && (
                  <div style={{ background: saveMsg.startsWith('✅') ? '#d1fae5' : '#fee2e2', color: saveMsg.startsWith('✅') ? '#065f46' : '#991b1b', padding: '12px 16px', borderRadius: '8px', marginBottom: '20px', fontSize: '14px', fontWeight: '500' }}>
                    {saveMsg}
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '40px' }}>
                  {[
                    { label: 'First Name', key: 'firstName', type: 'text' },
                    { label: 'Last Name', key: 'lastName', type: 'text' },
                    { label: 'Username', key: 'username', type: 'text', readOnly: true },
                    { label: 'Email', key: 'email', type: 'email' },
                    { label: 'Contact Number', key: 'phone', type: 'text' },
                  ].map(field => (
                    <div key={field.key} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '12px', fontWeight: '500', color: '#4b5563' }}>{field.label}</label>
                      <input type={field.type} value={profile[field.key]} readOnly={field.readOnly}
                        onChange={e => !field.readOnly && setProfile({ ...profile, [field.key]: e.target.value })}
                        style={{ ...fieldStyle, background: field.readOnly ? '#f9fafb' : '#ffffff', color: field.readOnly ? '#9ca3af' : '#1f2937', cursor: field.readOnly ? 'not-allowed' : 'text' }} />
                    </div>
                  ))}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '12px', fontWeight: '500', color: '#4b5563' }}>Unit Office Assignment</label>
                    <select value={profile.assignedBarangayId || ''}
                      onChange={e => {
                        const selected = barangayList.find(b => b.id === parseInt(e.target.value));
                        setProfile({ ...profile, assignedBarangayId: e.target.value ? parseInt(e.target.value) : null, assignment: selected ? selected.name : '' });
                      }}
                      style={{ ...fieldStyle, cursor: 'pointer' }}>
                      <option value="">— Select Assignment —</option>
                      {barangayList.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '16px', marginTop: '24px' }}>
                  <button onClick={() => { setCurrentView('menu'); setSaveMsg(''); }}
                    style={{ background: '#ffffff', border: '1px solid #d1d5db', color: '#1f2937', borderRadius: '12px', padding: '12px 48px', fontSize: '15px', fontWeight: '500', cursor: 'pointer' }}>
                    Cancel
                  </button>
                  <button onClick={handleSaveProfile} disabled={saving}
                    style={{ background: saving ? '#6ee7b7' : '#10b981', border: 'none', color: '#ffffff', borderRadius: '12px', padding: '12px', fontSize: '15px', fontWeight: '500', cursor: saving ? 'not-allowed' : 'pointer', flexGrow: 1 }}>
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
            <button className="back-to-settings-btn" onClick={() => { setCurrentView('menu'); setPasswordMsg(''); setTwoFaMsg(''); }}>
              ← Back to Settings
            </button>

            {/* ── 1. CHANGE PASSWORD ── */}
            <div className="security-section-card">
              <div className="security-card-header">
                <div className="security-icon-box">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </div>
                <div className="security-header-text">
                  <h3>Change Password</h3>
                  <span className="security-timestamp">Update your account password</span>
                </div>
              </div>

              {passwordMsg && (
                <div style={{
                  margin: '0 0 16px 0', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: '500',
                  background: passwordMsg.startsWith('✅') ? '#d1fae5' : '#fee2e2',
                  color: passwordMsg.startsWith('✅') ? '#065f46' : '#991b1b',
                }}>
                  {passwordMsg}
                </div>
              )}

              <div className="security-card-body">
                {[
                  { field: 'currentPassword', label: 'Current Password', show: showCurrent, setShow: setShowCurrent },
                  { field: 'newPassword', label: 'New Password', show: showNew, setShow: setShowNew },
                  { field: 'confirmPassword', label: 'Confirm New Password', show: showConfirm, setShow: setShowConfirm },
                ].map(({ field, label, show, setShow }) => (
                  <div key={field} className="security-input-row">
                    <label>{label}</label>
                    <div className="security-password-wrapper">
                      <input type={show ? 'text' : 'password'} value={security[field]}
                        onChange={e => setSecurity({ ...security, [field]: e.target.value })}
                        placeholder={`Enter ${label}`} />
                      <button type="button" className="security-eye-btn" onClick={() => setShow(!show)}>
                        {show ? (
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1f2937" strokeWidth="2">
                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                            <line x1="1" y1="1" x2="23" y2="23"/>
                          </svg>
                        ) : (
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1f2937" strokeWidth="2">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        )}
                      </button>
                    </div>
                    {field === 'confirmPassword' && security.confirmPassword && (
                      <p style={{ fontSize: '12px', marginTop: '5px', color: security.newPassword === security.confirmPassword ? '#10b981' : '#ef4444' }}>
                        {security.newPassword === security.confirmPassword ? '✓ Passwords match' : '✗ Passwords do not match'}
                      </p>
                    )}
                  </div>
                ))}
                <button onClick={handleChangePassword} disabled={passwordLoading} className="security-action-blue-btn"
                  style={{ opacity: passwordLoading ? 0.7 : 1, cursor: passwordLoading ? 'not-allowed' : 'pointer' }}>
                  {passwordLoading ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </div>

            {/* ── 2. TWO-FACTOR AUTHENTICATION ── */}
            <div className="security-section-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div className="security-card-header" style={{ marginBottom: twoFaStep === 'idle' ? 0 : '16px', flex: 1 }}>
                  <div className="security-icon-box">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                  </div>
                  <div className="security-header-text">
                    <h3>Two-Factor Authentication</h3>
                    <span className="security-timestamp">
                      {isTwoFactorEnabled
                        ? `✅ Active — verified via ${maskEmail(profile.email)}`
                        : 'Currently disabled — adds an extra layer of security'}
                    </span>
                  </div>
                </div>
                <label className="figma-toggle-switch" style={{ flexShrink: 0, marginLeft: '16px', marginTop: '4px' }}>
                  <input type="checkbox" checked={isTwoFactorEnabled}
                    onChange={handle2FAToggle} disabled={twoFaLoading} />
                  <span className="figma-slider" />
                </label>
              </div>

              {twoFaMsg && (
                <div style={{
                  padding: '12px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: '500', marginTop: '12px',
                  background: twoFaMsg.startsWith('✅') ? '#d1fae5' : '#fee2e2',
                  color: twoFaMsg.startsWith('✅') ? '#065f46' : '#991b1b',
                }}>
                  {twoFaMsg}
                </div>
              )}

              {twoFaStep === 'email_sent' && !isTwoFactorEnabled && (
                <div style={{ marginTop: '14px', padding: '14px 16px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', fontSize: '13px', color: '#1e40af' }}>
                  📧 Check your email and click <strong>"Verify Email"</strong> to complete 2FA setup. Once verified, 2FA will be active on your next login.
                </div>
              )}
            </div>

            {/* ── 3. LOGIN SESSIONS ── */}
            <div className="security-section-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div className="security-card-header" style={{ marginBottom: 0 }}>
                  <div className="security-icon-box" style={{ background: '#e8f7f0' }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2">
                      <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
                      <line x1="12" y1="18" x2="12.01" y2="18" />
                    </svg>
                  </div>
                  <div className="security-header-text">
                    <h3>Login Sessions</h3>
                    <span className="security-timestamp">
                      {otherSessionsCleared ? '1 active session' : sessionData.previous_login ? '2 active sessions' : '1 active session'}
                    </span>
                  </div>
                </div>
                {!otherSessionsCleared && sessionData.previous_login && (
                  <button
                    onClick={() => setOtherSessionsCleared(true)}
                    style={{ padding: '8px 16px', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '8px', fontSize: '13px', fontWeight: '600', color: '#dc2626', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    Log Out of All Other Sessions
                  </button>
                )}
              </div>

              {/* Current Session */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: '16px',
                padding: '16px', background: '#f0fdf4', border: '1px solid #bbf7d0',
                borderRadius: '10px', marginBottom: '12px',
              }}>
                <div style={{ fontSize: '28px', flexShrink: 0 }}>
                  {getDeviceIcon(sessionData.last_login_device)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ fontSize: '15px', fontWeight: '600', color: '#0f172a' }}>
                      {sessionData.last_login_device || 'Current Device'}
                    </span>
                    <span style={{ fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '10px', background: '#10b981', color: 'white' }}>
                      TRUSTED
                    </span>
                    <span style={{ fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '10px', background: '#dcfce7', color: '#16a34a' }}>
                      THIS DEVICE
                    </span>
                  </div>
                  <div style={{ fontSize: '13px', color: '#475569' }}>
                    {sessionData.last_login_location || 'Cabuyao, Calabarzon, Philippines'}
                  </div>
                  <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
                    {formatLoginTime(sessionData.last_login)}
                  </div>
                </div>
              </div>

              {/* Previous Session */}
              {sessionData.previous_login && !otherSessionsCleared && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '16px',
                  padding: '16px', background: '#f8fafc', border: '1px solid #e2e8f0',
                  borderRadius: '10px', marginBottom: '12px',
                }}>
                  <div style={{ fontSize: '28px', flexShrink: 0 }}>
                    {getDeviceIcon(sessionData.previous_login_device)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span style={{ fontSize: '15px', fontWeight: '600', color: '#0f172a' }}>
                        {sessionData.previous_login_device || 'Unknown Device'}
                      </span>
                    </div>
                    <div style={{ fontSize: '13px', color: '#475569' }}>
                      {sessionData.previous_login_location || 'Unknown Location'}
                    </div>
                    <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
                      {formatLoginTime(sessionData.previous_login)}
                    </div>
                  </div>
                  <button
                    onClick={() => setOtherSessionsCleared(true)}
                    style={{ padding: '6px 14px', background: 'transparent', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '12px', fontWeight: '600', color: '#dc2626', cursor: 'pointer' }}>
                    Revoke
                  </button>
                </div>
              )}

              {otherSessionsCleared && (
                <div style={{ padding: '12px 16px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', fontSize: '13px', color: '#16a34a', fontWeight: '500' }}>
                  ✅ All other sessions have been logged out successfully.
                </div>
              )}

              {!sessionData.previous_login && !otherSessionsCleared && (
                <div style={{ padding: '12px 16px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', color: '#94a3b8', textAlign: 'center' }}>
                  No other active sessions found.
                </div>
              )}
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
                  { key: 'pushNotifications', label: 'Push Notifications', sub: 'Receive push notifications in browser' },
                  { key: 'smsNotifications', label: 'SMS Notifications', sub: 'Receive notifications via text message' },
                ],
              },
              {
                icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#101828" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
                title: 'Case Notifications', subtitle: 'Get notified about case activities',
                rows: [
                  { key: 'newCaseReported', label: 'New Case Reported', sub: 'When a new case is reported in your barangay' },
                  { key: 'caseStatusUpdated', label: 'Case Status Updated', sub: 'When a case status changes' },
                  { key: 'highRiskAlert', label: 'High Risk Alert', sub: 'When a high-risk area is identified' },
                ],
              },
              {
                icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#101828" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
                title: 'System Notifications', subtitle: 'Updates about the system',
                rows: [
                  { key: 'weeklySummary', label: 'Weekly Summary', sub: 'Receive a weekly summary of cases' },
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
              <button className="notifications-save-btn" onClick={() => setCurrentView('menu')}>Save Preferences</button>
            </div>
          </div>
        )}

        {/* ── SYSTEM PREFERENCES VIEW ── */}
        {currentView === 'system' && (
          <div className="detail-view-container security-view-view">
            <button className="back-to-settings-btn" onClick={() => setCurrentView('menu')}>← Back to Settings</button>

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
                    <input type="checkbox" checked={systemPrefs.darkMode} onChange={e => setSystemPrefs({ ...systemPrefs, darkMode: e.target.checked })} />
                    <span className="figma-slider" />
                  </label>
                </div>
                <div className="session-list-row">
                  <div className="session-info-meta"><h4>Font Size</h4><p>Adjust text size for better readability</p></div>
                  <div style={{ position: 'relative' }}>
                    <select value={systemPrefs.fontSize} onChange={e => setSystemPrefs({ ...systemPrefs, fontSize: e.target.value })}
                      style={{ background: '#fff', border: '1px solid #d0d5dd', borderRadius: '8px', padding: '8px 36px 8px 14px', fontSize: '14px', cursor: 'pointer', appearance: 'none', color: '#1f2937', minWidth: '120px' }}>
                      <option>Small</option><option>Medium</option><option>Large</option>
                    </select>
                    <span style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#1f2937', fontSize: '12px' }}>▼</span>
                  </div>
                </div>
                <div className="session-list-row">
                  <div className="session-info-meta"><h4>Compact View</h4><p>Show more content with less spacing</p></div>
                  <label className="figma-toggle-switch">
                    <input type="checkbox" checked={systemPrefs.compactView} onChange={e => setSystemPrefs({ ...systemPrefs, compactView: e.target.checked })} />
                    <span className="figma-slider" />
                  </label>
                </div>
              </div>
            </div>

            <div className="notifications-action-container">
              <button className="notifications-save-btn" onClick={() => setCurrentView('menu')}>Save Preferences</button>
            </div>
          </div>
        )}

        {/* ── DATA MANAGEMENT VIEW ── */}
        {currentView === 'data' && (
          <div className="detail-view-container security-view-view">
            <button className="back-to-settings-btn" onClick={() => setCurrentView('menu')}>← Back to Settings</button>

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
          </div>
        )}

      </div>
    </div>
  );
}

const fieldStyle = {
  background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '12px',
  padding: '12px 16px', fontSize: '15px', color: '#1f2937',
  boxShadow: '0 2px 4px rgba(0,0,0,0.02)', outline: 'none', width: '100%',
  boxSizing: 'border-box',
};