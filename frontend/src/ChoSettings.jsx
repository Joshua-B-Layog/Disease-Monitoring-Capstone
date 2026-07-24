import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from './config';
import './ChoSettings.css';

const translations = {
  en: { 'Profile Settings':'Profile Settings','Account Security':'Account Security','Notifications':'Notifications','System Preferences':'System Preferences','Data Management':'Data Management','Save Preferences':'Save Preferences','Save Changes':'Save Changes','Cancel':'Cancel' },
  fil: { 'Profile Settings':'Mga Setting ng Profile','Account Security':'Seguridad ng Account','Notifications':'Mga Abiso','System Preferences':'Mga Kagustuhan ng System','Data Management':'Pamamahala ng Data','Save Preferences':'I-save ang Mga Kagustuhan','Save Changes':'I-save ang Mga Pagbabago','Cancel':'Kanselahin' },
  id: { 'Profile Settings':'Pengaturan Profil','Account Security':'Keamanan Akun','Notifications':'Notifikasi','System Preferences':'Preferensi Sistem','Data Management':'Manajemen Data','Save Preferences':'Simpan Preferensi','Save Changes':'Simpan Perubahan','Cancel':'Batal' },
  vi: { 'Profile Settings':'Cài đặt hồ sơ','Account Security':'Bảo mật tài khoản','Notifications':'Thông báo','System Preferences':'Tùy chọn hệ thống','Data Management':'Quản lý dữ liệu','Save Preferences':'Lưu tùy chọn','Save Changes':'Lưu thay đổi','Cancel':'Hủy' },
  th: { 'Profile Settings':'การตั้งค่าโปรไฟล์','Account Security':'ความปลอดภัยของบัญชี','Notifications':'การแจ้งเตือน','System Preferences':'การตั้งค่าระบบ','Data Management':'การจัดการข้อมูล','Save Preferences':'บันทึกการตั้งค่า','Save Changes':'บันทึกการเปลี่ยนแปลง','Cancel':'ยกเลิก' },
};
const langCodeMap = { 'English':'en','Filipino':'fil','Bahasa Indonesia':'id','Tiếng Việt':'vi','ไทย':'th' };

export default function CHOSettings({
  activeUser,
  userId,
  loggedUser,
  setLoggedUser,
  profilePhoto,
  onProfilePhotoChange,
  theme,
  toggleTheme,
  onLanguageChange,
  onTimeZoneChange,
  onDateFormatChange,
  onAutoSaveChange,
  onConfirmDeleteChange,
  onKeyboardShortcutsChange,
  onFontSizeChange,
  onCompactChange,
  savedFontScale,
  savedCompactMode,
  savedDateFormat,
  savedConfirmDelete,
  openProfileView,
  onProfileViewOpened,
}) {
  const navigate = useNavigate();
  const [currentView, setCurrentView] = useState('menu');
  useEffect(() => {
    if (openProfileView) {
      setCurrentView('profile');
      if (onProfileViewOpened) onProfileViewOpened();
    }
  }, [openProfileView, onProfileViewOpened]);
  const fileInputRef = useRef(null);
  const restoreInputRef = useRef(null);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [restoreMsg, setRestoreMsg] = useState('');
  const [restoreError, setRestoreError] = useState('');
  const [storageStats, setStorageStats] = useState(null);
  const [storageLoading, setStorageLoading] = useState(false);
  const [lastBackupDate, setLastBackupDate] = useState(() => localStorage.getItem('cdms_last_backup') || null);
  const [backupLoading, setBackupLoading] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);
  const [clearCountdown, setClearCountdown] = useState(3);
  const [clearLoading, setClearLoading] = useState(false);
  const [clearSuccess, setClearSuccess] = useState('');
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(() => localStorage.getItem('cdms_auto_backup') !== 'false');
  const [toastMsg, setToastMsg] = useState('');
  const [toastType, setToastType] = useState('success');

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
  const [showSessionsModal, setShowSessionsModal] = useState(false);
  const [revokedSessionIds, setRevokedSessionIds] = useState([]);

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
  const [disableOtp, setDisableOtp] = useState('');
  const [disableOtpError, setDisableOtpError] = useState('');
  const [disableOtpLoading, setDisableOtpLoading] = useState(false);

  // ── Notifications ──
  const [notifications, setNotifications] = useState({
    emailNotifications: false, pushNotifications: false, smsNotifications: false,
    newCaseReported: false, caseStatusUpdated: false, highRiskAlert: false,
    updatedCaseReported: false,
    weeklySummary: false, systemMaintenance: false,
  });
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifSaveMsg, setNotifSaveMsg] = useState('');
  const [systemPrefsSaveMsg, setSystemPrefsSaveMsg] = useState('');

  useEffect(() => {
    if (currentView !== 'notifications' || !userId) return;
    setNotifSaveMsg('');
    setSystemPrefsSaveMsg('');
    setNotifLoading(true);
    fetch(`${API_URL}/api/notification-preferences/${userId}`)
      .then(r => r.json())
      .then(data => {
        setNotifications({
          emailNotifications: !!data.email_notifications,
          pushNotifications: !!data.push_notifications,
          smsNotifications: !!data.sms_notifications,
          newCaseReported: !!data.new_case_reported,
          caseStatusUpdated: !!data.case_status_updated,
          highRiskAlert: !!data.high_risk_alert,
          updatedCaseReported: !!data.updated_case_reported,
          weeklySummary: !!data.weekly_summary,
          systemMaintenance: !!data.system_maintenance,
        });
      })
      .catch(() => {})
      .finally(() => setNotifLoading(false));
  }, [currentView, userId]);

  useEffect(() => {
    setSystemPrefsSaveMsg('');
  }, [currentView]);

  // ── System Prefs ──
  const scaleToLabel = (scale) => {
    if (scale === '0.9') return 'Small';
    if (scale === '1.15') return 'Large';
    return 'Medium';
  };
  const [systemPrefs, setSystemPrefs] = useState({
    darkMode: false,
    fontSize: scaleToLabel(savedFontScale || '1'),
    compactView: savedCompactMode === true || savedCompactMode === 'true' ? true : false,
    displayLanguage: localStorage.getItem('cdms_language') === 'fil' ? 'Filipino'
      : localStorage.getItem('cdms_language') === 'id' ? 'Bahasa Indonesia'
      : localStorage.getItem('cdms_language') === 'vi' ? 'Tiếng Việt'
      : localStorage.getItem('cdms_language') === 'th' ? 'ไทย'
      : 'English',
    timeZone: localStorage.getItem('cdms_timeZone')?.split(' (')[0] || 'Asia/Manila',
    dateFormat: savedDateFormat || 'MM/DD/YY',
    autoSave: localStorage.getItem('cdms_autoSave') === 'true',
    confirmDelete: localStorage.getItem('cdms_confirm_delete') !== 'false',
    keyboardShortcuts: localStorage.getItem('cdms_keyboardShortcuts') === 'true',
  });
  const [systemPrefsSnapshot, setSystemPrefsSnapshot] = useState(null);

  const t = (key) => {
    const code = langCodeMap[systemPrefs.displayLanguage] || 'en';
    return translations[code]?.[key] || key;
  };

  // ── Notify App.jsx of language/timezone/dateFormat changes ──
  useEffect(() => {
    if (onLanguageChange) onLanguageChange(langCodeMap[systemPrefs.displayLanguage] || 'en');
  }, [systemPrefs.displayLanguage, onLanguageChange]);
  useEffect(() => {
    if (onTimeZoneChange) onTimeZoneChange(systemPrefs.timeZone);
  }, [systemPrefs.timeZone, onTimeZoneChange]);
  useEffect(() => {
    if (onDateFormatChange) onDateFormatChange(systemPrefs.dateFormat);
  }, [systemPrefs.dateFormat, onDateFormatChange]);
  useEffect(() => {
    setSystemPrefs(prev => ({ ...prev, dateFormat: savedDateFormat || 'MM/DD/YY' }));
  }, [savedDateFormat]);
  useEffect(() => {
    setSystemPrefs(prev => ({
      ...prev,
      confirmDelete: savedConfirmDelete !== undefined ? savedConfirmDelete : true,
    }));
  }, [savedConfirmDelete]);
  useEffect(() => {
    if (onAutoSaveChange) onAutoSaveChange(systemPrefs.autoSave);
  }, [systemPrefs.autoSave, onAutoSaveChange]);
  useEffect(() => {
    if (onConfirmDeleteChange) onConfirmDeleteChange(systemPrefs.confirmDelete);
  }, [systemPrefs.confirmDelete, onConfirmDeleteChange]);
  useEffect(() => {
    if (onKeyboardShortcutsChange) onKeyboardShortcutsChange(systemPrefs.keyboardShortcuts);
  }, [systemPrefs.keyboardShortcuts, onKeyboardShortcutsChange]);
  const takeSystemSnapshot = () => ({
    theme,
    fontSize: systemPrefs.fontSize,
    compactView: systemPrefs.compactView,
    displayLanguage: systemPrefs.displayLanguage,
    timeZone: systemPrefs.timeZone,
    dateFormat: systemPrefs.dateFormat,
    autoSave: systemPrefs.autoSave,
    confirmDelete: systemPrefs.confirmDelete,
    keyboardShortcuts: systemPrefs.keyboardShortcuts,
  });
  useEffect(() => {
    if (currentView === 'system') setSystemPrefsSnapshot(takeSystemSnapshot());
  }, [currentView]);
  useEffect(() => {
    if (currentView === 'data') {
      setStorageLoading(true);
      axios.get(API_URL + '/api/storage-stats')
        .then(res => { setStorageStats(res.data); setStorageLoading(false); })
        .catch(() => setStorageLoading(false));
    }
  }, [currentView]);

  // ── Auto-backup check on mount ──
  useEffect(() => {
    if (!autoBackupEnabled) return;
    const last = localStorage.getItem('cdms_last_backup');
    if (!last) return;
    const daysSince = (Date.now() - new Date(last).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince >= 7) handleCreateBackup(true);
  }, []);

  // ── Countdown timer for clear modal ──
  useEffect(() => {
    if (!showClearModal) { setClearCountdown(3); return; }
    if (clearCountdown <= 0) return;
    const timer = setTimeout(() => setClearCountdown(prev => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [showClearModal, clearCountdown]);

  const handleCreateBackup = (silent = false) => {
    setBackupLoading(true);
    fetch(API_URL + '/api/backup')
      .then(res => res.blob())
      .then(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `CDMS_Backup_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        const now = new Date().toISOString();
        localStorage.setItem('cdms_last_backup', now);
        setLastBackupDate(now);
        setBackupLoading(false);
        if (!silent) { setToastMsg('Backup downloaded successfully! Save this file to Google Drive, USB, or any secure location.'); setToastType('success'); setTimeout(() => setToastMsg(''), 3000); }
      })
      .catch(() => {
        setBackupLoading(false);
        if (!silent) { setToastMsg('Backup failed. Please try again.'); setToastType('error'); setTimeout(() => setToastMsg(''), 3000); }
      });
  };

  const handleClearMyData = async () => {
    if (!userId) return;
    setClearLoading(true);
    try {
      const res = await axios.delete(`${API_URL}/api/users/${userId}/my-data`);
      setClearSuccess('Your personal data has been cleared successfully. System data and other users are not affected.');
      setTimeout(() => {
        setShowClearModal(false);
        setClearSuccess('');
        setClearLoading(false);
        if (res.data?.logged_out) {
          localStorage.clear();
          window.location.href = '/';
        }
      }, 2500);
    } catch (err) {
      setToastMsg('Clear failed: ' + (err.response?.data?.error || err.message));
      setToastType('error');
      setTimeout(() => setToastMsg(''), 3000);
      setClearLoading(false);
    }
  };

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
    axios.get(`${API_URL}/api/users/${userId}/profile`)
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
        setIsTwoFactorEnabled(!!d.two_fa_enabled);
        setProfileLoading(false);
      })
      .catch(() => setProfileLoading(false));
  }, [userId]);

  // ── Load barangay list ──
  useEffect(() => {
    axios.get(API_URL + '/api/barangays')
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
      const res = await axios.put(`${API_URL}/api/users/${userId}/profile`, {
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
      await axios.put(`${API_URL}/api/users/${userId}/change-password`, {
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
      // Turning OFF - require a 6-digit code first, don't disable instantly
      setTwoFaLoading(true);
      setTwoFaMsg('');
      setDisableOtpError('');
      setDisableOtp('');
      try {
        await axios.post(API_URL + '/api/send-login-otp', { userId });
        setTwoFaStep('disable_otp_sent');
        setTwoFaMsg(`📧 A 6-digit code was sent to ${maskEmail(profile.email)}. Enter it below to disable 2FA.`);
      } catch (err) {
        setTwoFaMsg('❌ Failed to send verification code. Please try again.');
      } finally {
        setTwoFaLoading(false);
      }
      return;
    }

    // Turning ON - send verification email
    setTwoFaLoading(true);
    setTwoFaMsg('');
    try {
      await axios.post(API_URL + '/api/send-2fa-email', { userId });
      setTwoFaStep('email_sent');
      setTwoFaMsg(`✅ Verification email sent to ${maskEmail(profile.email)}. Click the link in your email to activate 2FA.`);
    } catch (err) {
      setTwoFaMsg('❌ Failed to send verification email. Please try again.');
    } finally {
      setTwoFaLoading(false);
    }
  };

  // ── Confirm disable 2FA with OTP ──
  const handleConfirmDisable2FA = async () => {
    setDisableOtpError('');
    if (disableOtp.length !== 6) {
      setDisableOtpError('Please enter the 6-digit code sent to your email.');
      return;
    }
    setDisableOtpLoading(true);
    try {
      const verifyRes = await axios.post(API_URL + '/api/verify-login-otp', {
        userId, otp: disableOtp,
      });
      if (verifyRes.status === 200) {
        await axios.post(API_URL + '/api/disable-2fa', { userId });
        setIsTwoFactorEnabled(false);
        setTwoFaStep('idle');
        setTwoFaMsg('✅ Two-Factor Authentication has been disabled.');
        setDisableOtp('');
      }
    } catch (err) {
      setDisableOtpError(err.response?.data?.error || 'Invalid or expired code.');
    } finally {
      setDisableOtpLoading(false);
    }
  };

  // ── Cancel the disable flow ──
  const handleCancelDisable2FA = () => {
    setTwoFaStep('idle');
    setTwoFaMsg('');
    setDisableOtp('');
    setDisableOtpError('');
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

  const handleNotificationToggle = (key, value) => {
  if (key === 'pushNotifications' && !value) {
    // When push is turned OFF, turn everything else off too
    setNotifications(prev => ({
      ...prev,
      pushNotifications: false,
      emailNotifications: false,
      smsNotifications: false,
      newCaseReported: false,
      caseStatusUpdated: false,
      highRiskAlert: false,
      updatedCaseReported: false,
      weeklySummary: false,
      systemMaintenance: false,
    }));
  } else if (key !== 'pushNotifications' && value && !notifications.pushNotifications) {
    // Can't turn on sub-toggles if push is off
    return;
  } else {
    setNotifications(prev => ({ ...prev, [key]: value }));
  }
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
      {toastMsg && (
        <div style={{
          position: 'fixed', top: '20px', right: '20px', zIndex: 10000,
          padding: '12px 20px', borderRadius: '8px', fontSize: '14px', fontWeight: '500',
          background: toastType === 'success' ? '#10B981' : '#ef4444',
          color: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
        }}>
          {toastMsg}
        </div>
      )}
      <div className="settings-container">

        {/* ── MENU VIEW ── */}
        {currentView === 'menu' && (
          <div>
            <h1 className="settings-title">Settings</h1>
            <p className="settings-subtitle">
              Manage your account credentials, notifications, and core configuration behaviors.
            </p>
            <div className="menu-grid">
              <NavigationCard title={t('Profile Settings')} icon="👤" view="profile" />
              <NavigationCard title={t('Account Security')} icon="🔒" view="security" />
              <NavigationCard title={t('Notifications')} icon="🔔" view="notifications" />
              <NavigationCard title={t('System Preferences')} icon="⚙️" view="system" />
              <NavigationCard title={t('Data Management')} icon="💾" view="data" isFullWidth />
            </div>
          </div>
        )}

        {/* ── PROFILE SETTINGS VIEW ── */}
        {currentView === 'profile' && (
          <div className="detail-view-container">
            <button className="back-to-settings-btn" onClick={() => { setCurrentView('menu'); setSaveMsg(''); }}
              style={{ display: 'flex', alignItems: 'center', background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', fontWeight: '500', color: 'var(--text-main)', marginBottom: '24px' }}>
              <span style={{ marginRight: '8px', fontSize: '20px' }}>←</span> Back to Settings
            </button>

            {profileLoading ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Loading profile...</div>
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
                    <h2 style={{ fontSize: '24px', fontWeight: '600', color: 'var(--text-main)', margin: 0 }}>{displayName}</h2>
                    <p style={{ fontSize: '14px', color: 'var(--text-muted)', margin: 0 }}>
                      {activeUser?.role === 'BHW'
                        ? `BHW - ${profile.assignment || activeUser?.context || ''}`
                        : `${activeUser?.role || 'CHO'} Specialist - ${profile.assignment || activeUser?.context || ''}`
                      }
                    </p>
                    <button onClick={() => fileInputRef.current.click()}
                      style={{ background: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '8px', padding: '8px 18px', fontSize: '14px', fontWeight: '500', cursor: 'pointer', marginTop: '6px', width: 'fit-content' }}>
                      Change Photo
                    </button>
                    {profilePhoto && (
                      <button onClick={() => onProfilePhotoChange(null)}
                        style={{ background: 'transparent', color: '#ef4444', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '6px 14px', fontSize: '13px', cursor: 'pointer', width: 'fit-content' }}>
                        Remove Photo
                      </button>
                    )}
                  </div>
                  <input type="file" ref={fileInputRef} onChange={handleImageChange} style={{ display: 'none' }} accept="image/*" />
                </div>

                <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '24px 0' }} />

                {saveMsg && (
                  <div style={{ background: 'var(--input-bg)', color: saveMsg.startsWith('✅') ? '#065f46' : '#991b1b', padding: '12px 16px', borderRadius: '8px', marginBottom: '20px', fontSize: '14px', fontWeight: '500' }}>
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
                      <label style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-muted)' }}>{field.label}</label>
                      <input type={field.type} value={profile[field.key]} readOnly={field.readOnly}
                        onChange={e => !field.readOnly && setProfile({ ...profile, [field.key]: e.target.value })}
                        style={{ ...fieldStyle, background: 'var(--input-bg)', color: field.readOnly ? 'var(--text-muted)' : 'var(--text-main)', cursor: field.readOnly ? 'not-allowed' : 'text' }} />
                    </div>
                  ))}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-muted)' }}>Unit Office Assignment</label>
                    <div style={{ position: 'relative' }}>
                      <select value={profile.assignedBarangayId || ''}
                        onChange={e => {
                          const selected = barangayList.find(b => b.id === parseInt(e.target.value));
                          setProfile({ ...profile, assignedBarangayId: e.target.value ? parseInt(e.target.value) : null, assignment: selected ? selected.name : '' });
                        }}
                        style={{ ...fieldStyle, cursor: 'pointer', appearance: 'none', paddingRight: '36px' }}>
                        <option value="">- Select Assignment -</option>
                        {barangayList.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                      </select>
                      <span style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', fontSize: '10px', pointerEvents: 'none', opacity: 0.6 }}>▼</span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '16px', marginTop: '24px' }}>
                  <button onClick={() => { setCurrentView('menu'); setSaveMsg(''); }}
                    style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', color: 'var(--text-main)', borderRadius: '12px', padding: '12px 48px', fontSize: '15px', fontWeight: '500', cursor: 'pointer' }}>
                    {t('Cancel')}
                  </button>
                  <button onClick={handleSaveProfile} disabled={saving}
                    style={{ background: saving ? '#6ee7b7' : '#10b981', border: 'none', color: '#ffffff', borderRadius: '12px', padding: '12px', fontSize: '15px', fontWeight: '500', cursor: saving ? 'not-allowed' : 'pointer', flexGrow: 1 }}>
                    {saving ? 'Saving...' : t('Save Changes')}
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
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2">
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
                  background: 'var(--input-bg)',
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
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2">
                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                            <line x1="1" y1="1" x2="23" y2="23"/>
                          </svg>
                        ) : (
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2">
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
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                  </div>
                  <div className="security-header-text">
                    <h3>Two-Factor Authentication</h3>
                    <span className="security-timestamp">
                      {isTwoFactorEnabled
                        ? `✅ Active - verified via ${maskEmail(profile.email)}`
                        : 'Currently disabled - adds an extra layer of security'}
                    </span>
                  </div>
                </div>
                <label className="figma-toggle-switch" style={{ flexShrink: 0, marginLeft: '16px', marginTop: '4px' }}>
                  <input type="checkbox" checked={isTwoFactorEnabled}
                    onChange={handle2FAToggle} disabled={twoFaLoading || twoFaStep === 'disable_otp_sent'} />
                  <span className="figma-slider" />
                </label>
              </div>

              {twoFaMsg && (
                <div style={{
                  padding: '12px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: '500', marginTop: '12px',
                  background: 'var(--input-bg)',
                  color: twoFaMsg.startsWith('✅') ? '#065f46' : twoFaMsg.startsWith('📧') ? '#1e40af' : '#991b1b',
                }}>
                  {twoFaMsg}
                </div>
              )}

              {twoFaStep === 'email_sent' && !isTwoFactorEnabled && (
                <div style={{ marginTop: '14px', padding: '14px 16px', background: 'var(--input-bg)', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '13px', color: '#1e40af' }}>
                  📧 Check your email and click <strong>"Verify Email"</strong> to complete 2FA setup. Once verified, 2FA will be active on your next login.
                </div>
              )}

              {twoFaStep === 'disable_otp_sent' && (
                <div style={{ marginTop: '14px', padding: '16px', background: 'var(--input-bg)', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#991b1b', marginBottom: '8px' }}>
                    Enter the 6-digit code to confirm disabling 2FA
                  </label>
                  {disableOtpError && (
                    <div style={{ fontSize: '12px', color: '#dc2626', marginBottom: '8px' }}>{disableOtpError}</div>
                  )}
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <input
                      type="text"
                      maxLength="6"
                      placeholder="######"
                      value={disableOtp}
                      onChange={e => setDisableOtp(e.target.value.replace(/\D/g, ''))}
                      style={{
                        flex: 1, padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--border-color)',
                        fontSize: '18px', letterSpacing: '6px', textAlign: 'center', fontWeight: 'bold',
                        background: 'var(--bg-surface)', color: 'var(--text-main)', outline: 'none',
                      }}
                    />
                    <button
                      onClick={handleConfirmDisable2FA}
                      disabled={disableOtpLoading}
                      style={{
                        padding: '10px 20px', background: disableOtpLoading ? '#fca5a5' : '#dc2626',
                        color: '#fff', border: 'none', borderRadius: '6px', fontSize: '13px',
                        fontWeight: '600', cursor: disableOtpLoading ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap',
                      }}
                    >
                      {disableOtpLoading ? 'Verifying...' : 'Confirm Disable'}
                    </button>
                  </div>
                  <button
                    onClick={handleCancelDisable2FA}
                    style={{
                      marginTop: '10px', background: 'none', border: 'none', color: 'var(--text-muted)',
                      fontSize: '12px', cursor: 'pointer', padding: 0, textDecoration: 'underline',
                    }}
                  >
                    Cancel and keep 2FA enabled
                  </button>
                </div>
              )}
            </div>

           {/* ── 3. LOGIN SESSIONS ── */}
            <div className="security-section-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div className="security-card-header" style={{ marginBottom: 0 }}>
                  <div className="security-icon-box" style={{ background: 'var(--input-bg)' }}>
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
                <button
                  onClick={() => setShowSessionsModal(true)}
                  className="security-manage-btn">
                  Manage
                </button>
              </div>

              {/* Current Session preview (always visible) */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: '16px',
                padding: '16px', background: 'var(--input-bg)', border: '1px solid var(--border-color)',
                borderRadius: '10px',
              }}>
                <div style={{ fontSize: '28px', flexShrink: 0 }}>
                  {getDeviceIcon(sessionData.last_login_device)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-h)' }}>
                      {sessionData.last_login_device || 'Current Device'}
                    </span>
                    <span style={{ fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '10px', background: '#10b981', color: 'white' }}>
                      THIS DEVICE
                    </span>
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                    {sessionData.last_login_location || 'Cabuyao, Calabarzon, Philippines'}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {formatLoginTime(sessionData.last_login)}
                  </div>
                </div>
              </div>

              {!sessionData.previous_login && (
                <p style={{ margin: '10px 0 0 0', fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center' }}>
                  No other active sessions found.
                </p>
              )}
            </div>

            {/* ── SESSIONS MANAGE MODAL ── */}
            {showSessionsModal && (
              <div
                onClick={() => setShowSessionsModal(false)}
                style={{
                  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  zIndex: 9999,
                }}
              >
                <div
                  onClick={e => e.stopPropagation()}
                  style={{
                    background: 'var(--bg-surface)', borderRadius: '16px', width: '520px', maxWidth: '95vw',
                    maxHeight: '85vh', overflowY: 'auto',
                    boxShadow: '0 24px 60px rgba(0,0,0,0.25)',
                    padding: '28px 28px 24px 28px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: 'var(--text-h)' }}>Manage Sessions</h3>
                    <button onClick={() => setShowSessionsModal(false)}
                      style={{ background: 'none', border: 'none', fontSize: '22px', color: 'var(--text-muted)', cursor: 'pointer', lineHeight: 1, padding: 0 }}>
                      ×
                    </button>
                  </div>
                  <p style={{ margin: '0 0 20px 0', fontSize: '13px', color: 'var(--text-muted)' }}>
                    Devices currently signed in to your account.
                  </p>

                  {/* Current Session - cannot be revoked */}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '14px',
                    padding: '14px 16px', background: 'var(--input-bg)', border: '1px solid var(--border-color)',
                    borderRadius: '10px', marginBottom: '12px',
                  }}>
                    <div style={{ fontSize: '26px', flexShrink: 0 }}>
                      {getDeviceIcon(sessionData.last_login_device)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-h)' }}>
                          {sessionData.last_login_device || 'Current Device'}
                        </span>
                        <span style={{ fontSize: '10px', fontWeight: '700', padding: '2px 7px', borderRadius: '10px', background: '#10b981', color: 'white' }}>
                          TRUSTED
                        </span>
                        <span style={{ fontSize: '10px', fontWeight: '700', padding: '2px 7px', borderRadius: '10px', background: '#dcfce7', color: '#16a34a' }}>
                          THIS DEVICE
                        </span>
                      </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        {sessionData.last_login_location || 'Cabuyao, Calabarzon, Philippines'}
                      </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {formatLoginTime(sessionData.last_login)}
                      </div>
                    </div>
                  </div>

                  {/* Previous / Other Sessions - individually revokable */}
                  {sessionData.previous_login && !otherSessionsCleared && !revokedSessionIds.includes('previous') && (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '14px',
                      padding: '14px 16px', background: 'var(--input-bg)', border: '1px solid var(--border-color)',
                      borderRadius: '10px', marginBottom: '12px',
                    }}>
                      <div style={{ fontSize: '26px', flexShrink: 0 }}>
                        {getDeviceIcon(sessionData.previous_login_device)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-h)', marginBottom: '3px' }}>
                          {sessionData.previous_login_device || 'Unknown Device'}
                        </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                          {sessionData.previous_login_location || 'Unknown Location'}
                        </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                          {formatLoginTime(sessionData.previous_login)}
                        </div>
                      </div>
                      <button
                        onClick={() => setRevokedSessionIds(prev => [...prev, 'previous'])}
                        style={{ padding: '7px 14px', background: 'transparent', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '12px', fontWeight: '600', color: '#dc2626', cursor: 'pointer', flexShrink: 0 }}>
                        Revoke
                      </button>
                    </div>
                  )}

                  {(otherSessionsCleared || revokedSessionIds.includes('previous')) && sessionData.previous_login && (
                    <div style={{ padding: '12px 16px', background: 'var(--input-bg)', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '13px', color: '#16a34a', fontWeight: '500', marginBottom: '12px' }}>
                      ✅ This session has been logged out.
                    </div>
                  )}

                  {!sessionData.previous_login && (
                    <div style={{ padding: '14px 16px', background: 'var(--input-bg)', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', marginBottom: '12px' }}>
                      No other active sessions found.
                    </div>
                  )}

                  {/* Log Out of All Other Sessions */}
                  {sessionData.previous_login && !otherSessionsCleared && !revokedSessionIds.includes('previous') && (
                    <button
                      onClick={() => setOtherSessionsCleared(true)}
                      style={{
                        width: '100%', marginTop: '8px', padding: '12px',
                        background: 'var(--input-bg)', border: '1px solid var(--border-color)', borderRadius: '8px',
                        fontSize: '13px', fontWeight: '600', color: '#dc2626', cursor: 'pointer',
                      }}>
                      Log Out of All Other Sessions
                    </button>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
                    <button
                      onClick={() => setShowSessionsModal(false)}
                      style={{ padding: '10px 24px', background: '#1e3a8a', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '600', color: '#fff', cursor: 'pointer' }}>
                      Done
                    </button>
                  </div>
                </div>
              </div>
            )}
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
                icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>,
                title: 'Notification Channels', subtitle: 'Choose how you want to receive notifications',
                rows: [
                  { key: 'pushNotifications', label: 'Push Notifications', sub: 'Receive push notifications in browser' },
                  { key: 'emailNotifications', label: 'Email Notifications', sub: 'Receive notifications via email' },
                  { key: 'smsNotifications', label: 'SMS Notifications', sub: 'Receive notifications via text message' },
                ],
              },
              {
                icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
                title: 'Case Notifications', subtitle: 'Get notified about case activities',
                rows: [
                  { key: 'newCaseReported', label: 'New Case Reported', sub: 'When a new case is reported in your barangay' },
                  { key: 'updatedCaseReported', label: 'Updated Case Reported', sub: 'When a BHW requests an edit or a CHO updates a case' },
                  { key: 'caseStatusUpdated', label: 'Case Status Updated', sub: 'When a case status changes' },
                  { key: 'highRiskAlert', label: 'High Risk Alert', sub: 'When a high-risk area is identified' },
                ],
              },
              {
                icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
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
                    <div key={row.key} className="session-list-row"
                        style={{ 
                          opacity: row.key !== 'pushNotifications' && !notifications.pushNotifications ? 0.4 : 1,
                          pointerEvents: row.key !== 'pushNotifications' && !notifications.pushNotifications ? 'none' : 'auto'
                        }}>
                      <div className="session-info-meta"><h4>{row.label}</h4><p>{row.sub}</p></div>
                      <label className="figma-toggle-switch" style={{
                      opacity: row.key !== 'pushNotifications' && !notifications.pushNotifications ? 0.4 : 1,
                      cursor: row.key !== 'pushNotifications' && !notifications.pushNotifications ? 'not-allowed' : 'pointer'
                      }}>
                      <input type="checkbox"
                        checked={notifications[row.key]}
                        disabled={row.key !== 'pushNotifications' && !notifications.pushNotifications}
                        onChange={e => handleNotificationToggle(row.key, e.target.checked)} />
                      <span className="figma-slider" />
                    </label>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <div className="notifications-action-container">
              {notifLoading && <span style={{ fontSize: '13px', color: 'var(--text-muted)', marginRight: '12px' }}>Loading...</span>}
              {notifSaveMsg && <span style={{ fontSize: '13px', color: 'var(--text-muted)', marginRight: '12px' }}>{notifSaveMsg}</span>}
              <button className="notifications-save-btn" onClick={async () => {
                setNotifSaveMsg('');
                try {
                  const res = await fetch(`${API_URL}/api/notification-preferences/${userId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      push_notifications: notifications.pushNotifications,
                      email_notifications: notifications.emailNotifications,
                      sms_notifications: notifications.smsNotifications,
                      new_case_reported: notifications.newCaseReported,
                      case_status_updated: notifications.caseStatusUpdated,
                      high_risk_alert: notifications.highRiskAlert,
                      updated_case_reported: notifications.updatedCaseReported,
                      weekly_summary: notifications.weeklySummary,
                      system_maintenance: notifications.systemMaintenance,
                    }),
                  });
                  if (res.ok) {
                    setNotifSaveMsg('Preferences saved!');
                    setTimeout(() => setCurrentView('menu'), 800);
                  } else {
                    setNotifSaveMsg('Failed to save.');
                  }
                } catch {
                  setNotifSaveMsg('Save error. Try again.');
                }
              }}>{t('Save Preferences')}</button>
            </div>

            {/* Send Maintenance Notice — only for CHO */}
            {activeUser?.role === 'CHO' && notifications.systemMaintenance && (
              <div className="security-section-card" style={{ marginTop: '24px', borderColor: '#fde68a' }}>
                <div className="security-card-header">
                  <div className="security-icon-box" style={{ background: 'var(--input-bg)' }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2">
                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                      <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                    </svg>
                  </div>
                  <div className="security-header-text">
                    <h3>Send Maintenance Notice</h3>
                    <span className="security-timestamp">Broadcast a system maintenance alert to all users</span>
                  </div>
                </div>
                <div style={{ padding: '0 0 12px 0', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <input type="text" placeholder="Subject (e.g. Scheduled Maintenance)" id="maint-title"
                    style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '14px', background: 'var(--input-bg)', color: 'var(--text-main)', outline: 'none' }} />
                  <textarea placeholder="Message describing the maintenance..." id="maint-message" rows={3}
                    style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '14px', background: 'var(--input-bg)', color: 'var(--text-main)', outline: 'none', resize: 'vertical' }} />
                  <button onClick={async () => {
                    const title = document.getElementById('maint-title').value.trim();
                    const message = document.getElementById('maint-message').value.trim();
                    if (!title || !message) { setToastMsg('Please enter both a subject and message.'); setToastType('error'); setTimeout(() => setToastMsg(''), 3000); return; }
                    try {
                      const res = await fetch(`${API_URL}/api/notifications/system-maintenance`, {
                        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, message }),
                      });
                      const data = await res.json();
                      if (res.ok) {
                        setToastMsg(data.message);
                        setToastType('success');
                        setTimeout(() => setToastMsg(''), 3000);
                        document.getElementById('maint-title').value = '';
                        document.getElementById('maint-message').value = '';
                      } else {
                        setToastMsg(data.error || 'Failed to send.');
                        setToastType('error');
                        setTimeout(() => setToastMsg(''), 3000);
                      }
                    } catch {
                      setToastMsg('Network error. Is the server running?');
                      setToastType('error');
                      setTimeout(() => setToastMsg(''), 3000);
                    }
                  }} style={{ padding: '10px 20px', background: '#d97706', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', alignSelf: 'flex-start' }}>
                    Send Notice
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── SYSTEM PREFERENCES VIEW ── */}
        {currentView === 'system' && (
          <div className="detail-view-container security-view-view">
            <button className="back-to-settings-btn" onClick={() => {
              if (systemPrefsSnapshot) {
                if (theme !== systemPrefsSnapshot.theme) toggleTheme();
                if (systemPrefs.fontSize !== systemPrefsSnapshot.fontSize) {
                  const scale = systemPrefsSnapshot.fontSize === 'Small' ? '0.9' : systemPrefsSnapshot.fontSize === 'Large' ? '1.15' : '1';
                  if (onFontSizeChange) onFontSizeChange(scale);
                }
                if (systemPrefs.compactView !== systemPrefsSnapshot.compactView) {
                  if (onCompactChange) onCompactChange(systemPrefsSnapshot.compactView);
                }
                setSystemPrefs({
                  ...systemPrefs,
                  fontSize: systemPrefsSnapshot.fontSize,
                  compactView: systemPrefsSnapshot.compactView,
                  displayLanguage: systemPrefsSnapshot.displayLanguage,
                  timeZone: systemPrefsSnapshot.timeZone,
                  dateFormat: systemPrefsSnapshot.dateFormat,
                  autoSave: systemPrefsSnapshot.autoSave,
                  confirmDelete: systemPrefsSnapshot.confirmDelete,
                  keyboardShortcuts: systemPrefsSnapshot.keyboardShortcuts,
                });
              }
              setCurrentView('menu');
            }}>← Back to Settings</button>

            <div className="security-section-card">
              <div className="security-card-header">
                <div className="security-icon-box">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2">
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
                      <input type="checkbox" checked={theme === 'dark'} onChange={() => toggleTheme()} />
                      <span className="figma-slider" />
                    </label>
                </div>
                <div className="session-list-row">
                  <div className="session-info-meta"><h4>Font Size</h4><p>Adjust text size for better readability</p></div>
                  <div style={{ position: 'relative' }}>
                    <select value={systemPrefs.fontSize} onChange={e => {
                      const label = e.target.value;
                      const scale = label === 'Small' ? '0.9' : label === 'Large' ? '1.15' : '1';
                      setSystemPrefs({ ...systemPrefs, fontSize: label });
                      if (onFontSizeChange) onFontSizeChange(scale);
                    }}
                      style={{ background: 'var(--input-bg)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '8px 36px 8px 14px', fontSize: '14px', cursor: 'pointer', appearance: 'none', color: 'var(--text-main)', minWidth: '120px' }}>
                      <option>Small</option><option>Medium</option><option>Large</option>
                    </select>
                    <span style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-muted)', fontSize: '12px' }}>▼</span>
                  </div>
                </div>
                <div className="session-list-row">
                  <div className="session-info-meta"><h4>Compact View</h4><p>Show more content with less spacing</p></div>
                  <label className="figma-toggle-switch">
                    <input type="checkbox" checked={systemPrefs.compactView} onChange={e => {
                      const val = e.target.checked;
                      setSystemPrefs({ ...systemPrefs, compactView: val });
                      if (onCompactChange) onCompactChange(val);
                    }} />
                    <span className="figma-slider" />
                  </label>
                </div>
              </div>
            </div>

            {/* ── Language & Region ── */}
            <div className="security-section-card">
              <div className="security-card-header">
                <div className="security-icon-box">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2">
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
                <div className="session-list-row">
                  <div className="session-info-meta"><h4>Display Language</h4></div>
                  <div style={{ position: 'relative' }}>
                      <select value={systemPrefs.displayLanguage} onChange={e => setSystemPrefs({ ...systemPrefs, displayLanguage: e.target.value })}
                        style={{ background: 'var(--input-bg)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '8px 36px 8px 14px', fontSize: '14px', cursor: 'pointer', appearance: 'none', color: 'var(--text-main)', minWidth: '120px' }}>
                        <option>English</option>
                        <option>Filipino</option>
                        <option>Bahasa Indonesia</option>
                        <option>Tiếng Việt</option>
                        <option>ไทย</option>
                      </select>
                    <span style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-muted)', fontSize: '12px' }}>▼</span>
                  </div>
                </div>
                <div className="session-list-row">
                  <div className="session-info-meta"><h4>Time Zone</h4></div>
                  <div style={{ position: 'relative' }}>
                      <select value={systemPrefs.timeZone} onChange={e => setSystemPrefs({ ...systemPrefs, timeZone: e.target.value })}
                        style={{ background: 'var(--input-bg)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '8px 36px 8px 14px', fontSize: '14px', cursor: 'pointer', appearance: 'none', color: 'var(--text-main)', minWidth: '120px' }}>
                        <option value="Asia/Manila">Asia/Manila (GMT+8)</option>
                        <option value="Asia/Jakarta">Asia/Jakarta (GMT+7)</option>
                        <option value="Asia/Ho_Chi_Minh">Asia/Ho_Chi_Minh (GMT+7)</option>
                        <option value="Asia/Bangkok">Asia/Bangkok (GMT+7)</option>
                        <option value="Asia/Kolkata">Asia/Kolkata (GMT+5:30)</option>
                      </select>
                    <span style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-muted)', fontSize: '12px' }}>▼</span>
                  </div>
                </div>
                <div className="session-list-row">
                  <div className="session-info-meta"><h4>Date Format</h4></div>
                  <div style={{ position: 'relative' }}>
                      <select value={systemPrefs.dateFormat} onChange={e => setSystemPrefs({ ...systemPrefs, dateFormat: e.target.value })}
                        style={{ background: 'var(--input-bg)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '8px 36px 8px 14px', fontSize: '14px', cursor: 'pointer', appearance: 'none', color: 'var(--text-main)', minWidth: '120px' }}>
                        <option>MM/DD/YY</option>
                        <option>DD/MM/YY</option>
                        <option>YYYY-MM-DD</option>
                      </select>
                    <span style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-muted)', fontSize: '12px' }}>▼</span>
                  </div>
                </div>
              </div>
            </div>

            {/* ── System Behavior ── */}
            <div className="security-section-card">
              <div className="security-card-header">
                <div className="security-icon-box">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2">
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                    <line x1="8" y1="21" x2="16" y2="21"/>
                    <line x1="12" y1="17" x2="12" y2="21"/>
                  </svg>
                </div>
                <div className="security-header-text">
                  <h3>System Behavior</h3>
                  <span className="security-timestamp">Configure how the system behaves</span>
                </div>
              </div>
              <div className="security-sessions-container">
                <div className="session-list-row">
                  <div className="session-info-meta"><h4>Auto-Save</h4><p>Automatically save changes while editing</p></div>
                  <label className="figma-toggle-switch">
                    <input type="checkbox" checked={systemPrefs.autoSave} onChange={e => setSystemPrefs({ ...systemPrefs, autoSave: e.target.checked })} />
                    <span className="figma-slider" />
                  </label>
                </div>
                <div className="session-list-row">
                  <div className="session-info-meta"><h4>Confirm Before Delete</h4><p>Show confirmation dialog before deleting items</p></div>
                  <label className="figma-toggle-switch">
                    <input type="checkbox" checked={systemPrefs.confirmDelete} onChange={e => { const val = e.target.checked; setSystemPrefs(prev => ({ ...prev, confirmDelete: val })); if (onConfirmDeleteChange) onConfirmDeleteChange(val); }} />
                    <span className="figma-slider" />
                  </label>
                </div>
                <div className="session-list-row">
                  <div className="session-info-meta"><h4>Keyboard Shortcuts</h4><p>Enable keyboard shortcuts for quick actions</p></div>
                  <label className="figma-toggle-switch">
                    <input type="checkbox" checked={systemPrefs.keyboardShortcuts} onChange={e => setSystemPrefs({ ...systemPrefs, keyboardShortcuts: e.target.checked })} />
                    <span className="figma-slider" />
                  </label>
                </div>
              </div>
            </div>

            <div className="notifications-action-container">
              {systemPrefsSaveMsg && <span style={{ fontSize: '13px', color: 'var(--text-muted)', marginRight: '12px' }}>{systemPrefsSaveMsg}</span>}
              <button className="notifications-save-btn" onClick={() => {
                setSystemPrefsSnapshot(takeSystemSnapshot());
                setSystemPrefsSaveMsg('Preferences saved!');
                setTimeout(() => setCurrentView('menu'), 1200);
              }}>{t('Save Preferences')}</button>
            </div>
          </div>
        )}

        {/* ── DATA MANAGEMENT VIEW ── */}
        {currentView === 'data' && (
          <div className="detail-view-container security-view-view">
            <button className="back-to-settings-btn" onClick={() => setCurrentView('menu')}>← Back to Settings</button>

            {/* Storage Overview */}
            <div className="security-section-card">
              <div className="security-card-header">
                <div className="security-icon-box">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2">
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
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '15px', marginBottom: '8px', color: 'var(--text-muted)', fontWeight: '500' }}>
                  <span>Storage Used</span>
                  <span style={{ color: 'var(--text-main)', fontWeight: '600' }}>{storageLoading ? 'Loading...' : storageStats ? `${storageStats.totalMB} MB of 10 GB` : '— of 10 GB'}</span>
                </div>
                <div style={{ width: '100%', height: '12px', background: 'var(--border-color)', borderRadius: '6px', overflow: 'hidden', marginBottom: '24px' }}>
                  <div style={{ width: `${storageStats ? storageStats.usedPercent : 0}%`, height: '100%', background: 'var(--text-main)', borderRadius: '6px' }} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                  {[
                    { val: storageStats ? `${storageStats.caseDataMB} MB` : '—', lbl: 'Case Data', sub: `${storageStats ? storageStats.cases : '—'} records` },
                    { val: storageStats ? `${storageStats.userDataMB} MB` : '—', lbl: 'Reports', sub: `${storageStats ? storageStats.users : '—'} accounts` },
                    { val: storageStats ? `${storageStats.otherMB} MB` : '—', lbl: 'Other', sub: `${storageStats ? storageStats.notifications : '—'} notifications` },
                  ].map(item => (
                    <div key={item.lbl} style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
                      <div style={{ fontSize: '20px', fontWeight: '600', color: 'var(--text-main)', marginBottom: '4px' }}>{item.val}</div>
                      <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>{item.lbl}</div>
                      <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>{item.sub}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Export Data */}
            <div className="security-section-card">
              <div className="security-card-header">
                <div className="security-icon-box">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2">
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
                  { label: 'Export as PDF', sub: 'Download all data as PDF documents', color: '#dc2626', icon: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6' },
                  { label: 'Export as Excel', sub: 'Download data as Excel spreadsheet', color: '#16a34a', icon: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6' },
                  { label: 'Export as CSV', sub: 'Download data as CSV file', color: '#2563eb', icon: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6' },
                ].map(row => (
                  <div key={row.label} className="session-list-row">
                    <div className="session-info-meta" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={row.color} strokeWidth="2">
                        <path d={row.icon} />
                      </svg>
                      <div>
                        <h4>{row.label}</h4>
                        <p>{row.sub}</p>
                      </div>
                    </div>
                    <button onClick={async () => {
                      try {
                        const [caseRes, userRes, auditRes] = await Promise.all([
                          axios.get(API_URL + '/api/export-all'),
                          axios.get(API_URL + '/api/users'),
                          axios.get(API_URL + '/api/audit-logs'),
                        ]);
                        const cases = caseRes.data;
                        const users = userRes.data;
                        const logs = (auditRes.data || []).map((l, idx) => ({
                          id: l.id ?? idx + 1,
                          timestamp: new Date(l.created_at).toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
                          userName: l.user_name || '',
                          userRole: l.user_role || '',
                          action: l.action || '',
                          entity: l.entity || '',
                          details: l.details || '',
                        }));

                        if (row.label === 'Export as PDF') {
                          const caseRows = cases.map(c =>
                            `<tr><td>${c.case_id}</td><td>${c.patient_name||''}</td><td>${c.age||''}</td><td>${c.gender||''}</td><td>${c.barangay_name||''}</td><td>${c.disease_name||''}</td><td>${c.severity||''}</td><td>${c.status||''}</td><td>${c.date_reported||''}</td></tr>`
                          ).join('');
                          const userRows = users.map(u =>
                            `<tr><td>U-${String(u.user_id).padStart(3,'0')}</td><td>${u.full_name||''}</td><td>${u.username||''}</td><td>${u.role||''}</td><td>${u.barangay_name||''}</td><td>${u.is_active?'Active':'Inactive'}</td><td>${u.email||''}</td></tr>`
                          ).join('');
                          const html = `<html><head><title>CDMS Export</title><style>
                            body{font-family:Arial,sans-serif;padding:28px;font-size:13px;color:#111;background:#fff;}
                            h2{color:#1e3a8a;margin-bottom:2px;}
                            .meta{color:#555;margin:0 0 20px 0;font-size:12px;}
                            h3{color:#1e3a8a;margin:24px 0 8px 0;font-size:14px;}
                            table{width:100%;border-collapse:collapse;margin-bottom:16px;}
                            table th{background:#1e3a8a;color:white;padding:8px 10px;text-align:center;font-size:12px;border:1px solid #1e3a8a;}
                            table td{padding:6px 10px;border:1px solid #d1d5db;text-align:center;font-size:12px;}
                            table tr:nth-child(even) td{background:#f9fafb;}
                            .print-btn{display:block;margin:0 auto 24px auto;padding:12px 32px;background:#1e3a8a;color:white;border:none;border-radius:8px;cursor:pointer;font-size:15px;font-weight:600;}
                            .print-btn:hover{background:#1e40af;}
                            .note{background:#fef3c7;border:1px solid #fbbf24;border-radius:6px;padding:12px 16px;color:#92400e;font-size:13px;margin:16px 0;}
                            @media print{.print-btn{display:none;}}
                          </style></head><body>
                          <button class="print-btn" onclick="window.print();">🖨️ Print / Save as PDF</button>
                          <h2>Cabuyao CDMS - Full Data Export</h2>
                          <p class="meta">Generated: ${new Date().toLocaleString()} &nbsp;|&nbsp; ${cases.length} Cases, ${users.length} Users</p>
                          <h3>Case Records (${cases.length})</h3>
                          <table><thead><tr><th>ID</th><th>Patient Name</th><th>Age</th><th>Gender</th><th>Barangay</th><th>Disease</th><th>Severity</th><th>Status</th><th>Date Reported</th></tr></thead><tbody>${caseRows}</tbody></table>
                          <h3>User Accounts (${users.length})</h3>
                          <table><thead><tr><th>User ID</th><th>Full Name</th><th>Username</th><th>Role</th><th>Barangay</th><th>Status</th><th>Email</th></tr></thead><tbody>${userRows}</tbody></table>
                          <h3>System Activity Log</h3>
                          <div class="note">For detailed audit logs, please export from the Audit Reports section.</div>
                          </body></html>`;
                          const printWindow = window.open('', '_blank');
                          printWindow.document.write(html);
                          printWindow.document.close();
                        } else if (row.label === 'Export as Excel') {
                          const sep = '\t';
                          const nl = '\n';
                          let content = '';
                          content += '=== CASE RECORDS ===' + nl;
                          content += 'Case ID' + sep + 'Patient Name' + sep + 'Age' + sep + 'Barangay' + sep + 'Disease' + sep + 'Severity' + sep + 'Status' + sep + 'Date Reported' + nl;
                          cases.forEach(c => { content += `${c.case_id}${sep}${c.patient_name||''}${sep}${c.age||''}${sep}${c.barangay_name||''}${sep}${c.disease_name||''}${sep}${c.severity||''}${sep}${c.status||''}${sep}${c.date_reported||''}${nl}`; });
                          content += nl + '=== USER ACCOUNTS ===' + nl;
                          content += 'ID' + sep + 'Name' + sep + 'Username' + sep + 'Barangay' + sep + 'Role' + sep + 'Status' + nl;
                          users.forEach(u => { content += `U-${String(u.user_id).padStart(3,'0')}${sep}${u.full_name||''}${sep}${u.username||''}${sep}${u.barangay_name||''}${sep}${u.role||''}${sep}${u.is_active?'Active':'Inactive'}${nl}`; });
                          content += nl + '=== SYSTEM LOGS ===' + nl;
                          content += '#' + sep + 'Timestamp' + sep + 'User' + sep + 'Role' + sep + 'Action' + sep + 'Entity' + sep + 'Details' + nl;
                          logs.forEach(l => { content += `${l.id}${sep}${l.timestamp}${sep}${l.userName}${sep}${l.userRole}${sep}${l.action}${sep}${l.entity}${sep}${l.details}${nl}`; });
                          const blob = new Blob([content], { type: 'application/vnd.ms-excel' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `CDMS_Export_${new Date().toISOString().split('T')[0]}.xls`;
                          a.click();
                        } else if (row.label === 'Export as CSV') {
                          const sep = ',';
                          const nl = '\n';
                          let content = '';
                          content += '=== CASE RECORDS ===' + nl;
                          content += 'Case ID' + sep + 'Patient Name' + sep + 'Age' + sep + 'Barangay' + sep + 'Disease' + sep + 'Severity' + sep + 'Status' + sep + 'Date Reported' + nl;
                          cases.forEach(c => { content += `${c.case_id}${sep}${c.patient_name||''}${sep}${c.age||''}${sep}${c.barangay_name||''}${sep}${c.disease_name||''}${sep}${c.severity||''}${sep}${c.status||''}${sep}${c.date_reported||''}${nl}`; });
                          content += nl + '=== USER ACCOUNTS ===' + nl;
                          content += 'ID' + sep + 'Name' + sep + 'Username' + sep + 'Barangay' + sep + 'Role' + sep + 'Status' + nl;
                          users.forEach(u => { content += `U-${String(u.user_id).padStart(3,'0')}${sep}${u.full_name||''}${sep}${u.username||''}${sep}${u.barangay_name||''}${sep}${u.role||''}${sep}${u.is_active?'Active':'Inactive'}${nl}`; });
                          content += nl + '=== SYSTEM LOGS ===' + nl;
                          content += '#' + sep + 'Timestamp' + sep + 'User' + sep + 'Role' + sep + 'Action' + sep + 'Entity' + sep + 'Details' + nl;
                          logs.forEach(l => { content += `${l.id}${sep}${l.timestamp}${sep}${l.userName}${sep}${l.userRole}${sep}${l.action}${sep}${l.entity}${sep}${l.details}${nl}`; });
                          const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `CDMS_Export_${new Date().toISOString().split('T')[0]}.csv`;
                          a.click();
                        }
                      } catch (err) {
                        setToastMsg('Export failed. Please try again.');
                        setToastType('error');
                        setTimeout(() => setToastMsg(''), 3000);
                      }
                    }} style={{ padding: '8px 18px', background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '13px', fontWeight: '600', color: 'var(--text-main)', cursor: 'pointer' }}>
                      Export
                    </button>
                  </div>
                ))}
              </div>
            </div>

              {/* Backup & Restore */}
              <div className="security-section-card">
                <div className="security-card-header">
                  <div className="security-icon-box">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2">
                      <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                    </svg>
                  </div>
                  <div className="security-header-text">
                    <h3>Backup & Restore</h3>
                    <span className="security-timestamp">Manage data backups</span>
                  </div>
                </div>

                <div style={{ padding: '0 0 16px 0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderTop: '1px solid var(--border-color)' }}>
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-main)' }}>Last Backup</div>
                      <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>{lastBackupDate ? new Date(lastBackupDate).toLocaleString('en-PH', { month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'No backup yet'}</div>
                    </div>
                    {lastBackupDate
                      ? <span style={{ fontSize: '13px', fontWeight: '600', padding: '4px 12px', borderRadius: '16px', background: 'var(--input-bg)', color: '#027a48' }}>Successful</span>
                      : <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Never</span>
                    }
                  </div>

                  <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                    <button onClick={() => handleCreateBackup(false)} disabled={backupLoading} style={{ flex: 1, padding: '12px', background: '#003cb4', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: backupLoading ? 'not-allowed' : 'pointer', opacity: backupLoading ? 0.7 : 1 }}>
                      {backupLoading ? 'Creating Backup...' : 'Create Backup'}
                    </button>
                    <input type="file" ref={restoreInputRef} accept=".json" style={{ display: 'none' }}
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setRestoreMsg('');
                        setRestoreError('');
                        setRestoreLoading(true);
                        try {
                          const text = await file.text();
                          const data = JSON.parse(text);
                          const previewRes = await fetch(`${API_URL}/api/restore/preview`, {
                            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
                          });
                          if (!previewRes.ok) throw new Error('Invalid backup file');
                          const preview = await previewRes.json();
                          const confirmed = window.confirm(
                            `Restore backup from ${new Date(preview.backup_date).toLocaleDateString('en-PH')}?\n\n` +
                            `Will restore:\n` +
                            `• ${preview.counts.disease_cases} disease cases\n` +
                            `• ${preview.counts.users} users\n` +
                            `• ${preview.counts.barangays} barangays\n` +
                            `• ${preview.counts.diseases} diseases\n\n` +
                            `Existing records with the same ID will be skipped. Continue?`
                          );
                          if (!confirmed) { setRestoreLoading(false); return; }
                          const res = await fetch(`${API_URL}/api/restore`, {
                            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
                          });
                          if (!res.ok) throw new Error((await res.json()).error || 'Restore failed');
                          setRestoreMsg('✅ Restore completed successfully!');
                          setTimeout(() => setRestoreMsg(''), 3000);
                        } catch (err) {
                          setRestoreError('❌ ' + (err.message || 'Restore failed. Check the file format.'));
                          setTimeout(() => setRestoreError(''), 4000);
                        } finally {
                          setRestoreLoading(false);
                          e.target.value = '';
                        }
                      }} />
                    <button onClick={() => restoreInputRef.current?.click()} disabled={restoreLoading} style={{ flex: 1, padding: '12px', background: restoreLoading ? '#94a3b8' : 'var(--bg-surface)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: restoreLoading ? 'not-allowed' : 'pointer' }}>
                      {restoreLoading ? 'Restoring...' : 'Restore'}
                    </button>
                  </div>

                  {restoreMsg && (
                    <div style={{ marginTop: '8px', padding: '8px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: '500', background: 'var(--input-bg)', color: '#065f46' }}>
                      {restoreMsg}
                    </div>
                  )}
                  {restoreError && (
                    <div style={{ marginTop: '8px', padding: '8px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: '500', background: 'var(--input-bg)', color: '#991b1b' }}>
                      {restoreError}
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 0 0 0', marginTop: '12px', borderTop: '1px solid var(--border-color)' }}>
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-main)' }}>Auto-Backup</div>
                      <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Automatically backup data weekly</div>
                    </div>
                    <label className="figma-toggle-switch">
                      <input type="checkbox" checked={autoBackupEnabled} onChange={e => { setAutoBackupEnabled(e.target.checked); localStorage.setItem('cdms_auto_backup', String(e.target.checked)); }} />
                      <span className="figma-slider" />
                    </label>
                  </div>
                </div>
              </div>

              {/* Danger Zone */}
              <div className="security-section-card" style={{ borderColor: 'var(--border-color)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                  </svg>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#dc2626' }}>Danger Zone</h3>
                    <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Irreversible actions</span>
                  </div>
                </div>

                <div style={{ background: 'var(--input-bg)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '16px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: '14px', fontWeight: '700', color: '#b91c1c', marginBottom: '4px' }}>Clear All Data</div>
                    <div style={{ fontSize: '13px', color: '#991b1b' }}>This will permanently delete all your data. This action cannot be undone.</div>
                  </div>
                  <button onClick={() => setShowClearModal(true)} style={{ padding: '10px 20px', background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '13px', fontWeight: '600', color: '#dc2626', cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                    🗑️ Clear Data
                  </button>
                </div>
              </div>
              </div>
            )}

            {showClearModal && (
              <div style={{
                position:'fixed', inset:0,
                background:'rgba(0,0,0,0.6)',
                display:'flex', alignItems:'center',
                justifyContent:'center', zIndex:9999
              }}>
                <div style={{
                  background:'var(--bg-surface)', borderRadius:'16px',
                  padding:'40px 32px', width:'440px',
                  maxWidth:'95vw', textAlign:'center',
                  boxShadow:'0 24px 60px rgba(0,0,0,0.3)'
                }}>
                  <div style={{
                    width:'64px', height:'64px', borderRadius:'50%',
                    background:'var(--input-bg)', display:'flex',
                    alignItems:'center', justifyContent:'center',
                    margin:'0 auto 20px auto', fontSize:'28px'
                  }}>⚠️</div>

                  <h3 style={{margin:'0 0 8px 0', fontSize:'22px',
                    fontWeight:'700', color:'var(--text-main)'}}>
                    Clear Your Personal Data?
                  </h3>

                  <p style={{margin:'0 0 16px 0', color:'var(--text-muted)',
                    fontSize:'14px', lineHeight:'1.6'}}>
                    This will permanently clear YOUR personal data
                    (notifications and activity history) from this account.
                  </p>

                  <div style={{
                    background:'var(--input-bg)', border:'1px solid #fbbf24',
                    borderRadius:'8px', padding:'12px 16px',
                    marginBottom:'20px', textAlign:'left'
                  }}>
                    <p style={{margin:0, fontSize:'13px', color:'#92400e',
                      fontWeight:'500'}}>
                      ✅ Other CHO admins and BHW data will NOT be affected<br/>
                      ✅ Case records remain in the system<br/>
                      ❌ Your notification history will be permanently deleted
                    </p>
                  </div>

                  {clearSuccess && (
                    <div style={{
                      background:'var(--input-bg)', color:'#065f46',
                      padding:'10px', borderRadius:'8px',
                      marginBottom:'16px', fontSize:'13px',
                      fontWeight:'500'
                    }}>
                      ✅ {clearSuccess}
                    </div>
                  )}

                  <div style={{
                    display:'flex', gap:'12px',
                    borderTop:'1px solid var(--border-color)',
                    paddingTop:'20px', marginTop:'8px'
                  }}>
                    <button
                      onClick={() => setShowClearModal(false)}
                      disabled={clearLoading}
                      style={{
                        flex:1, padding:'14px', background:'transparent',
                        border:'1px solid var(--border-color)', borderRadius:'8px',
                        cursor:'pointer', fontSize:'15px',
                        fontWeight:'500', color:'var(--text-main)'
                      }}>
                      Cancel
                    </button>
                    <button
                      onClick={handleClearMyData}
                      disabled={clearCountdown > 0 || clearLoading}
                      style={{
                        flex:1, padding:'14px',
                        background: clearCountdown > 0 ? '#9ca3af' : '#ef4444',
                        border:'none', borderRadius:'8px',
                        cursor: clearCountdown > 0 ? 'not-allowed' : 'pointer',
                        fontSize:'15px', fontWeight:'600', color:'#fff',
                        transition:'background 0.3s'
                      }}>
                      {clearLoading
                        ? 'Clearing...'
                        : clearCountdown > 0
                          ? `Wait ${clearCountdown}s...`
                          : 'Yes, Clear My Data'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
    </div>
  );
}

const fieldStyle = {
  background: 'var(--input-bg)', border: '1px solid var(--border-color)', borderRadius: '12px',
  padding: '12px 16px', fontSize: '15px', color: 'var(--text-main)',
  boxShadow: '0 2px 4px rgba(0,0,0,0.02)', outline: 'none', width: '100%',
  boxSizing: 'border-box',
};