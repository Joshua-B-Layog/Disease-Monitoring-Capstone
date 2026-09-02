import { useState, useEffect, useRef } from 'react';
import Sidebar from './Sidebar';
import ManageCases from './ManageCases';  
import Dashboard from './Dashboard'; 
import UserManagement from './UserManagement';
import BarangayReports from './BarangayReports';
import ChoSettings from './ChoSettings';
import Login from './components/Login'; 
import RecoverAccount from './components/RecoverAccount';
import MapView from './MapView';
import WeeklySummary from './WeeklySummary';
import { ToastHost } from './components/Toast';

import { API_URL } from './config';
import { getPendingCount, processSyncQueue } from './syncEngine';
import { cacheNotifications, getCachedNotifications } from './offlineSync';
import './App.css';

const getSavedFontScale = () => {
  const saved = localStorage.getItem('cdms_font_size');
  return saved || '1';
};
const getSavedCompact = () => {
  return localStorage.getItem('cdms_compact_mode') === 'true';
};
const loadStored = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    if (raw !== null) return JSON.parse(raw);
  } catch (e) {}
  return fallback;
};

const extractDiseaseFromMessage = (message) => {
  if (!message) return '';
  let m = message.match(/new case of (.+?) \(/);
  if (m) return m[1].trim();
  m = message.match(/the case of .+? \((.+?)\)/);
  if (m) return m[1].trim();
  m = message.match(/status for .+? \((.+?)\)/);
  if (m) return m[1].trim();
  m = message.match(/^Case for .+? \((.+?)\)/);
  if (m) return m[1].trim();
  m = message.match(/regarding (.+?)\.?$/);
  if (m) return m[1].trim();
  return '';
};

const translations = {
  en: { 'Dashboard':'Dashboard','Manage Cases':'Manage Cases','Audit Reports':'Audit Reports','Map View':'Map View','User Accounts':'User Accounts','Settings':'Settings','Logout':'Logout','CHO Profile':'CHO Profile','Specialist':'Specialist','Profile Settings':'Profile Settings','Account Security':'Account Security','Notifications':'Notifications','System Preferences':'System Preferences','Data Management':'Data Management','Save Preferences':'Save Preferences','Save Changes':'Save Changes','Cancel':'Cancel','Edit Profile':'Edit Profile' },
  fil: { 'Dashboard':'Dashboard','Manage Cases':'Pamahalaan ang mga Kaso','Audit Reports':'Mga Ulat ng Pag-audit','Map View':'Pananaw ng Mapa','User Accounts':'Mga Account ng User','Settings':'Mga Setting','Logout':'Mag-logout','CHO Profile':'Profile ng CHO','Specialist':'Specialista','Profile Settings':'Mga Setting ng Profile','Account Security':'Seguridad ng Account','Notifications':'Mga Abiso','System Preferences':'Mga Kagustuhan ng System','Data Management':'Pamamahala ng Data','Save Preferences':'I-save ang Mga Kagustuhan','Save Changes':'I-save ang Mga Pagbabago','Cancel':'Kanselahin','Edit Profile':'I-edit ang Profile' },
  id: { 'Dashboard':'Dasbor','Manage Cases':'Kelola Kasus','Audit Reports':'Laporan Audit','Map View':'Tampilan Peta','User Accounts':'Akun Pengguna','Settings':'Pengaturan','Logout':'Keluar','CHO Profile':'Profil CHO','Specialist':'Spesialis','Profile Settings':'Pengaturan Profil','Account Security':'Keamanan Akun','Notifications':'Notifikasi','System Preferences':'Preferensi Sistem','Data Management':'Manajemen Data','Save Preferences':'Simpan Preferensi','Save Changes':'Simpan Perubahan','Cancel':'Batal','Edit Profile':'Edit Profil' },
  vi: { 'Dashboard':'Bảng điều khiển','Manage Cases':'Quản lý ca bệnh','Audit Reports':'Báo cáo kiểm toán','Map View':'Xem bản đồ','User Accounts':'Tài khoản người dùng','Settings':'Cài đặt','Logout':'Đăng xuất','CHO Profile':'Hồ sơ CHO','Specialist':'Chuyên viên','Profile Settings':'Cài đặt hồ sơ','Account Security':'Bảo mật tài khoản','Notifications':'Thông báo','System Preferences':'Tùy chọn hệ thống','Data Management':'Quản lý dữ liệu','Save Preferences':'Lưu tùy chọn','Save Changes':'Lưu thay đổi','Cancel':'Hủy','Edit Profile':'Chỉnh sửa hồ sơ' },
  th: { 'Dashboard':'แดชบอร์ด','Manage Cases':'จัดการเคส','Audit Reports':'รายงานการตรวจสอบ','Map View':'มุมมองแผนที่','User Accounts':'บัญชีผู้ใช้','Settings':'การตั้งค่า','Logout':'ออกจากระบบ','CHO Profile':'โปรไฟล์ CHO','Specialist':'ผู้เชี่ยวชาญ','Profile Settings':'การตั้งค่าโปรไฟล์','Account Security':'ความปลอดภัยของบัญชี','Notifications':'การแจ้งเตือน','System Preferences':'การตั้งค่าระบบ','Data Management':'การจัดการข้อมูล','Save Preferences':'บันทึกการตั้งค่า','Save Changes':'บันทึกการเปลี่ยนแปลง','Cancel':'ยกเลิก','Edit Profile':'แก้ไขโปรไฟล์' },
};

function App() {
  const savedSession = (() => { try { return JSON.parse(localStorage.getItem('cdms_session')); } catch { return null; } })();
  const [isLoggedIn, setIsLoggedIn]       = useState(!!savedSession);
  const [loginRole, setLoginRole]         = useState(savedSession?.role || 'CHO');
  const [sessionContext, setSessionContext] = useState(savedSession?.context || ''); 
  const [loggedUser, setLoggedUser]       = useState(savedSession?.name || '');
  const [loggedUserId, setLoggedUserId]   = useState(savedSession?.id || null);
  const [loggedUserBarangay, setLoggedUserBarangay] = useState(savedSession?.barangay || null);

  const CHO_UNIT_BARANGAYS = {
    'CHO Unit I (Sala)': ['Barangay Uno (Poblacion)', 'Barangay Dos (Poblacion)', 'Barangay Tres (Poblacion)', 'Sala', 'Bigaa', 'Butong', 'Marinig', 'Gulod', 'Niugan', 'Baclaran'],
    'CHO Unit II (Pulo)': ['Pulo', 'Banay-Banay', 'Banlic', 'Mamatid', 'San Isidro', 'Diezmo', 'Pittland', 'Casile'],
  };
  const getChoUnitForBarangay = (barangay) => {
    const norm = barangay.replace(/\(.*?\)/g, '').trim().toLowerCase();
    for (const [unit, bList] of Object.entries(CHO_UNIT_BARANGAYS)) {
      if (bList.some(b => b.replace(/\(.*?\)/g, '').trim().toLowerCase() === norm)) return unit;
    }
    return null;
  };
  const sidebarChoUnit = loginRole === 'CHO' ? sessionContext : getChoUnitForBarangay(loggedUserBarangay);

  const [profilePhoto, setProfilePhoto]   = useState(null);

  const getWorkWeek = () => {
    const now = new Date();
    const day = now.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diffToMonday);
    const friday = new Date(monday);
    friday.setDate(monday.getDate() + 4);
    return {
      start: monday.toISOString().slice(0, 10),
      end: friday.toISOString().slice(0, 10),
    };
  };

  const [activeTab, setActiveTab]         = useState(() => {
    const valid = ['Dashboard','Manage Cases','Map View','User Accounts','Audit Reports','Settings','Weekly Summary'];
    const stored = loadStored('cdms_active_tab', 'Dashboard');
    return valid.includes(stored) ? stored : 'Dashboard';
  });
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedDisease, setSelectedDisease] = useState(() => loadStored('cdms_dash_disease', 'Dengue'));
  const [dateRange, setDateRange]         = useState(() => loadStored('cdms_dash_dates', getWorkWeek()));
  const [dashPeriod, setDashPeriod]       = useState(() => loadStored('cdms_dash_period', 'weekly'));
  const [dashQuarter, setDashQuarter]     = useState(() => loadStored('cdms_dash_quarter', Math.floor(new Date().getMonth() / 3) + 1));
  const [dashYear, setDashYear]           = useState(() => loadStored('cdms_dash_year', new Date().getFullYear()));
  const [caseFilter, setCaseFilter]       = useState({ disease: '', barangay: '', purok: '' });

  const [language, setLanguage]           = useState('en');
  const [timeZone, setTimeZone]           = useState('Asia/Manila');
  const [dateFormat, setDateFormat]       = useState(() => localStorage.getItem('cdms_date_format') || 'MM/DD/YY');
  const [autoSave, setAutoSave]           = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(() => localStorage.getItem('cdms_confirm_delete') !== 'false');
  const [keyboardShortcuts, setKeyboardShortcuts] = useState(false);
  const [fontScale, setFontScale] = useState(getSavedFontScale);
  const [pendingInboxView, setPendingInboxView] = useState(null);
  const [compactMode, setCompactMode] = useState(getSavedCompact);
  const [openProfileView, setOpenProfileView] = useState(false);
  const [openSecurityView, setOpenSecurityView] = useState(false);

  useEffect(() => { localStorage.setItem('cdms_date_format', dateFormat); }, [dateFormat]);
  useEffect(() => { localStorage.setItem('cdms_confirm_delete', String(confirmDelete)); }, [confirmDelete]);
  useEffect(() => { localStorage.setItem('cdms_dash_dates', JSON.stringify(dateRange)); }, [dateRange]);
  useEffect(() => { localStorage.setItem('cdms_dash_disease', JSON.stringify(selectedDisease)); }, [selectedDisease]);
  useEffect(() => { localStorage.setItem('cdms_dash_period', JSON.stringify(dashPeriod)); }, [dashPeriod]);
  useEffect(() => { localStorage.setItem('cdms_dash_quarter', JSON.stringify(dashQuarter)); }, [dashQuarter]);
  useEffect(() => { localStorage.setItem('cdms_dash_year', JSON.stringify(dashYear)); }, [dashYear]);
  useEffect(() => { localStorage.setItem('cdms_active_tab', JSON.stringify(activeTab)); }, [activeTab]);

  const [authView, setAuthView]           = useState('login'); 

  // ── Online/Offline status ──
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const checkOnline = async () => {
      let online = false;
      try {
        const res = await fetch(`${API_URL}/api/ping`, { method: 'HEAD', cache: 'no-store' });
        online = res.ok;
      } catch {
        online = false;
      }
      setIsOnline(online);
      window.dispatchEvent(new CustomEvent('cdms-online-status', { detail: { online } }));
    };
    checkOnline();
    const interval = setInterval(checkOnline, 15000);
    window.addEventListener('online', checkOnline);
    window.addEventListener('offline', () => {
      setIsOnline(false);
      window.dispatchEvent(new CustomEvent('cdms-online-status', { detail: { online: false } }));
    });
    return () => {
      clearInterval(interval);
      window.removeEventListener('online', checkOnline);
      window.removeEventListener('offline', () => setIsOnline(false));
    };
  }, []);

  // ── Sync state ──
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [syncingActive, setSyncingActive] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [syncToastKey, setSyncToastKey] = useState(0);

  const refreshPendingCount = async () => {
    try {
      const count = await getPendingCount();
      setPendingSyncCount(count);
    } catch {}
  };

  const handleManualSync = async () => {
    if (syncingActive || !navigator.onLine) return;
    setSyncingActive(true);
    setSyncResult(null);
    try {
      const result = await processSyncQueue(
        () => {},
        (conflict) => { setSyncResult({ type: 'conflict', detail: conflict }); setSyncToastKey(k => k + 1); }
      );
      setSyncResult(result);
      setSyncToastKey(k => k + 1);
      await refreshPendingCount();
      if (result.synced > 0 || result.failed > 0) {
        window.dispatchEvent(new CustomEvent('cdms-data-synced'));
      }
      if (result.synced > 0 && result.failed === 0) {
        setTimeout(() => setSyncResult(null), 5000);
      }
    } catch (err) {
      setSyncResult({ type: 'error', detail: err.message });
      setSyncToastKey(k => k + 1);
    }
    setSyncingActive(false);
  };

  // Auto-sync on reconnect
  const prevOnlineRef = useRef(isOnline);
  useEffect(() => {
    if (isOnline && !prevOnlineRef.current) {
      refreshPendingCount().then(() => {
        getPendingCount().then(count => { if (count > 0) handleManualSync(); });
      });
    }
    prevOnlineRef.current = isOnline;
  }, [isOnline]);

  // Poll pending count every 30s (only when online)
  useEffect(() => {
    if (!isOnline) return;
    refreshPendingCount();
    const interval = setInterval(refreshPendingCount, 30000);
    return () => clearInterval(interval);
  }, [isOnline]);

  // ── CHO Profile modal state ──
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileData, setProfileData]           = useState(null);
  const [profileLoading, setProfileLoading]     = useState(false);

  // ── Notifications ──
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const notifRef = useRef(null);

  // ── THEME ──
  const [theme, setTheme] = useState(() => localStorage.getItem('cdms_theme') || 'dark');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('cdms_theme', theme);
  }, [theme]);
  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark');
  // ── Apply font-scale globally ──
  useEffect(() => {
    document.documentElement.style.setProperty('--app-font-scale', fontScale);
  }, [fontScale]);

  // ── Apply compact-mode data attribute globally ──
  useEffect(() => {
    document.documentElement.setAttribute('data-compact', compactMode ? 'true' : 'false');
  }, [compactMode]);

  // ── One-time mount: ensure saved values are applied on load ──
  useEffect(() => {
    const scale = localStorage.getItem('cdms_font_size') || '1';
    const compact = localStorage.getItem('cdms_compact_mode') === 'true';
    document.documentElement.style.setProperty('--app-font-scale', scale);
    document.documentElement.setAttribute('data-compact', compact ? 'true' : 'false');
  }, []);

  // ── Load saved profile photo from localStorage on mount ──
  useEffect(() => {
    const saved = localStorage.getItem('cdms_profile_photo');
    if (saved) setProfilePhoto(saved);
  }, []);

  // ── Load saved prefs from localStorage ──
  useEffect(() => {
    const lang = localStorage.getItem('cdms_language');
    let tz = localStorage.getItem('cdms_timeZone');
    const df = localStorage.getItem('cdms_dateFormat');
    const as = localStorage.getItem('cdms_autoSave');
    const cd = localStorage.getItem('cdms_confirm_delete');
    const ks = localStorage.getItem('cdms_keyboardShortcuts');
    if (lang) setLanguage(lang);
    if (tz) {
      tz = tz.split(' (')[0];
      setTimeZone(tz);
    }
    if (df) setDateFormat(df);
    if (as !== null) setAutoSave(as === 'true');
    if (cd !== null) setConfirmDelete(cd === 'true');
    if (ks !== null) setKeyboardShortcuts(ks === 'true');
  }, []);

useEffect(() => {
  if (!loggedUserId) return;

  const fetchNotifications = () => {
    fetch(`${API_URL}/api/notifications?userId=${loggedUserId}`)
      .then(res => res.json())
      .then(data => {
        const arr = Array.isArray(data) ? data : [];
        setNotifications(arr);
        cacheNotifications(arr).catch(() => {});
      })
      .catch(() => {});
  };

  if (!isOnline) {
    getCachedNotifications().then(cached => {
      if (cached.length > 0) setNotifications(cached);
    }).catch(() => {});
    return;
  }
  fetchNotifications();
  const interval = setInterval(fetchNotifications, 10000);
  return () => clearInterval(interval);
}, [loggedUserId, isOnline]);

// ── Close notification dropdown on outside click ──
useEffect(() => {
  const handler = (e) => {
    if (notifRef.current && !notifRef.current.contains(e.target)) {
      setShowNotifications(false);
    }
  };
  document.addEventListener('mousedown', handler);
  return () => document.removeEventListener('mousedown', handler);
}, []);

  // ── Live clock for top-nav ──
  const [clock, setClock] = useState(new Date());
  useEffect(() => {
    const interval = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // ── 30-minute session timeout ──
  useEffect(() => {
    if (!isLoggedIn) return;
    let timeout;
    const resetTimer = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        window.alert('Your session has expired due to inactivity. Please log in again.');
        handleLogout();
      }, 30 * 60 * 1000);
    };
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach(e => document.addEventListener(e, resetTimer));
    resetTimer();
    return () => {
      clearTimeout(timeout);
      events.forEach(e => document.removeEventListener(e, resetTimer));
    };
  }, [isLoggedIn]);

  // ── Session idle timeout (30 min) ──
  const [idleWarning, setIdleWarning] = useState(false);
  const idleTimerRef = useRef(null);
  const warningTimerRef = useRef(null);

  useEffect(() => {
    if (!isLoggedIn) return;
    const IDLE_LIMIT = 30 * 60 * 1000;
    const WARNING_AT = 25 * 60 * 1000;

    const resetTimers = () => {
      setIdleWarning(false);
      clearTimeout(idleTimerRef.current);
      clearTimeout(warningTimerRef.current);
      warningTimerRef.current = setTimeout(() => setIdleWarning(true), WARNING_AT);
      idleTimerRef.current = setTimeout(() => {
        setIdleWarning(false);
        handleLogout();
      }, IDLE_LIMIT);
    };

    const events = ['mousemove', 'keydown', 'click', 'scroll'];
    events.forEach(e => window.addEventListener(e, resetTimers));
    resetTimers();

    return () => {
      events.forEach(e => window.removeEventListener(e, resetTimers));
      clearTimeout(idleTimerRef.current);
      clearTimeout(warningTimerRef.current);
    };
  }, [isLoggedIn]);

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
      const res = await fetch(`${API_URL}/api/users/${loggedUserId}/profile`);
      const data = await res.json();
      setProfileData(data);
    } catch (e) {
      setProfileData(null);
    } finally {
      setProfileLoading(false);
    }
  };

  const handleDismissNotification = (id) => {
  fetch(`${API_URL}/api/notifications/${id}`, { method: 'DELETE' })
    .then(() => setNotifications(prev => prev.filter(n => n.id !== id)));
  };

  const handleDismissAll = () => {
    fetch(`${API_URL}/api/notifications?userId=${loggedUserId}`, { method: 'DELETE' })
      .then(() => setNotifications([]));
  };

  const handleMarkRead = (id) => {
    fetch(`${API_URL}/api/notifications/${id}/read`, { method: 'PUT' })
      .then(() => setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, is_read: 1 } : n)
      ))
      .catch(() => {});
  };

const unreadCount = notifications.filter(n => n.is_read === 0).length;

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
            setDateRange={setDateRange}
            dashPeriod={dashPeriod}
            setDashPeriod={setDashPeriod}
            dashQuarter={dashQuarter}
            setDashQuarter={setDashQuarter}
            dashYear={dashYear}
            setDashYear={setDashYear}
            setActiveTab={setActiveTab}
            loggedUser={loggedUser}
            dateFormat={dateFormat}
            fontScale={fontScale}
            compactMode={compactMode}
            loginRole={loginRole}
            loginBarangay={loggedUserBarangay}
            sessionContext={sessionContext}
          />
        );
      case 'Manage Cases':
        return <ManageCases caseFilter={caseFilter} setCaseFilter={setCaseFilter} dateFormat={dateFormat} autoSave={autoSave} confirmDelete={confirmDelete} keyboardShortcuts={keyboardShortcuts} fontScale={fontScale} compactMode={compactMode} loggedUserId={loggedUserId} loggedUser={loggedUser} loginRole={loginRole} loginBarangay={loggedUserBarangay} sessionContext={sessionContext} initialView={pendingInboxView} onInitialViewConsumed={() => setPendingInboxView(null)} />;
      case 'Map View':
        return <MapView setActiveTab={setActiveTab} setCaseFilter={setCaseFilter} fontScale={fontScale} compactMode={compactMode} loginRole={loginRole} loginBarangay={loggedUserBarangay} sessionContext={sessionContext} />;
      case 'User Accounts': 
        if (loginRole !== 'CHO') {
          return (
            <div style={{ padding: '40px', textAlign: 'center' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔒</div>
              <h2 style={{ fontSize: '22px', fontWeight: '700', color: 'var(--text-main)', margin: '0 0 8px' }}>Access Denied</h2>
              <p style={{ fontSize: '15px', color: 'var(--text-muted)', margin: '0 0 20px' }}>User Accounts management is restricted to CHO personnel.</p>
              <button onClick={() => setActiveTab('Dashboard')} style={{ padding: '10px 24px', background: '#129968', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '15px', fontWeight: '600' }}>← Back to Dashboard</button>
            </div>
          );
        }
        return <UserManagement dateFormat={dateFormat} confirmDelete={confirmDelete} fontScale={fontScale} compactMode={compactMode} loggedUserId={loggedUserId} loginRole={loginRole} />;
      case 'Audit Reports':
        return <BarangayReports dateFormat={dateFormat} activeUser={{ role: loginRole, context: sessionContext }} fontScale={fontScale} compactMode={compactMode} loggedUserId={loggedUserId} />;
      case 'Settings':
        return (
          <ChoSettings
            activeUser={{ role: loginRole, context: sessionContext }}
            userId={loggedUserId}
            loggedUser={loggedUser}
            setLoggedUser={setLoggedUser}
            profilePhoto={profilePhoto}
            onProfilePhotoChange={handleProfilePhotoChange}
            theme={theme}
            toggleTheme={toggleTheme}
            onLanguageChange={handleLanguageChange}
            onTimeZoneChange={handleTimeZoneChange}
            onDateFormatChange={handleDateFormatChange}
            onAutoSaveChange={handleAutoSaveChange}
            onConfirmDeleteChange={handleConfirmDeleteChange}
            onKeyboardShortcutsChange={handleKeyboardShortcutsChange}
            onFontSizeChange={(scale) => {
              setFontScale(scale);
              localStorage.setItem('cdms_font_size', scale);
            }}
            onCompactChange={(value) => {
              setCompactMode(value);
              localStorage.setItem('cdms_compact_mode', String(value));
            }}
            savedFontScale={fontScale}
            savedCompactMode={compactMode}
            savedDateFormat={dateFormat}
            savedConfirmDelete={confirmDelete}
            fontScale={fontScale}
            compactMode={compactMode}
            openProfileView={openProfileView}
            onProfileViewOpened={() => setOpenProfileView(false)}
            openSecurityView={openSecurityView}
            onSecurityViewOpened={() => setOpenSecurityView(false)}
          />
        );
      case 'Weekly Summary':
        return <WeeklySummary userId={loggedUserId} loginRole={loginRole} compactMode={compactMode} fontScale={fontScale} onBack={() => setActiveTab('Dashboard')} />;
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
    setLoggedUserBarangay(sessionData.barangay || null);
    localStorage.setItem('cdms_session', JSON.stringify({
      id: sessionData.id,
      name: sessionData.name || sessionData.username,
      role: sessionData.role,
      context: sessionData.context,
      barangay: sessionData.barangay || null,
    }));
  };

  const handleLogout = () => { 
    if (!navigator.onLine) {
      if (!window.confirm('You are currently offline. Logging out will prevent you from logging back in until reconnected. Continue?')) return;
    }
    fetch(`${API_URL}/api/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: loggedUserId, userName: loggedUser, userRole: loginRole, barangay: null }),
    }).catch(() => {});
    localStorage.removeItem('cdms_session');
    localStorage.removeItem('cdms_active_tab');
    setIsLoggedIn(false); 
    setSessionContext('');
    setLoggedUser('');
    setLoggedUserId(null);
    window.location.reload();
  };

  const handleLanguageChange = (langCode) => { setLanguage(langCode); localStorage.setItem('cdms_language', langCode); };
  const handleTimeZoneChange = (tzVal) => { setTimeZone(tzVal); localStorage.setItem('cdms_timeZone', tzVal); };
  const handleDateFormatChange = (df) => { setDateFormat(df); localStorage.setItem('cdms_date_format', df); };
  const handleAutoSaveChange = (val) => { setAutoSave(val); localStorage.setItem('cdms_autoSave', String(val)); };
  const handleConfirmDeleteChange = (val) => { setConfirmDelete(val); localStorage.setItem('cdms_confirm_delete', String(val)); };
  const handleKeyboardShortcutsChange = (val) => { setKeyboardShortcuts(val); localStorage.setItem('cdms_keyboardShortcuts', String(val)); };

  const t = (key) => translations[language]?.[key] || key;

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
      <span style={{ fontSize: '15px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
      <span style={{ fontSize: '15px', color: '#0f172a', fontWeight: '500' }}>{value || '-'}</span>
    </div>
  );

  return (
    <div className="dashboard-layout">
      <Sidebar role={loginRole} activeTab={activeTab} setActiveTab={setActiveTab} language={language} choUnit={sidebarChoUnit} />

      <div className="main-content">
        <div className="top-nav">
          <div className="nav-title" style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <h2 style={{ margin: 0 }}>{activeTab}</h2>
            <small style={{ color: '#129968', fontSize: '15px', fontWeight: '500' }}>
              Scope: {sessionContext} ({loginRole})
            </small>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {/* ── ONLINE/OFFLINE INDICATOR ── */}
            <div key={isOnline ? 'online' : 'offline'} className={isOnline ? '' : 'cdms-status-flash'} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 12px', borderRadius: '20px', fontSize: '15px', fontWeight: '600', background: isOnline ? 'rgba(18,153,104,0.1)' : 'rgba(245,158,11,0.1)', color: isOnline ? '#129968' : '#D97706', border: `1px solid ${isOnline ? 'rgba(18,153,104,0.3)' : 'rgba(245,158,11,0.3)'}` }}>
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: isOnline ? '#129968' : '#D97706' }}></span>
              {isOnline ? 'Online' : 'Offline'}
            </div>
            {/* ── BELL ICON + NOTIFICATION DROPDOWN ── */}
            <div style={{ position: 'relative' }} ref={notifRef}>
              <button
                onClick={() => {
                  setShowNotifications(!showNotifications);
                  setIsDropdownOpen(false);
                }}
                style={{
                  position: 'relative', background: 'none', border: 'none',
                  cursor: 'pointer', padding: '6px', color: '#ffffff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                </svg>
                {unreadCount > 0 && (
                  <span key={unreadCount} className="cdms-badge-pulse" style={{
                    position: 'absolute', top: '2px', right: '2px',
                    background: '#ef4444', color: 'white', borderRadius: '50%',
                    width: '16px', height: '16px', fontSize: '13px', fontWeight: '700',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    paddingTop: '1px'
                  }}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {/* DROPDOWN PANEL */}
              {showNotifications && (
                <div className="cdms-dropdown-panel" style={{
                  position: 'absolute', top: '44px', right: 0, width: '360px',
                  background: 'var(--bg-surface)', border: '1px solid var(--border-color)',
                  borderRadius: '12px', boxShadow: '0 12px 32px rgba(0,0,0,0.3)',
                  zIndex: 9999, overflow: 'hidden'
                }}>
                  {/* Header */}
                  <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '14px 16px', borderBottom: '1px solid var(--border-color)'
                  }}>
                    <span style={{ fontWeight: '700', fontSize: '15px', color: 'var(--text-main)' }}>
                      Notifications {unreadCount > 0 && (
                        <span style={{
                          background: '#ef4444', color: 'white', borderRadius: '10px',
                          padding: '1px 7px', fontSize: '15px', marginLeft: '6px'
                        }}>{unreadCount}</span>
                      )}
                    </span>
                    {notifications.length > 0 && (
                      <button onClick={handleDismissAll} style={{
                        background: 'none', border: 'none', color: '#ef4444',
                        cursor: 'pointer', fontSize: '15px', fontWeight: '600'
                      }}>
                        Clear All
                      </button>
                    )}
                  </div>

                  {/* Notification List */}
                  <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                    {notifications.length === 0 ? (
                      <div style={{
                        padding: '32px', textAlign: 'center',
                        color: 'var(--text-muted)', fontSize: '15px'
                      }}>
                        <div style={{ fontSize: '32px', marginBottom: '8px' }}>🔔</div>
                        No notifications yet
                      </div>
                    ) : (
                      notifications.map(n => (
                        <div key={n.id} style={{
                          padding: '12px 16px',
                          background: n.is_read === 0 ? 'rgba(59,130,246,0.06)' : 'transparent',
                          borderBottom: '1px solid var(--border-color)',
                          display: 'flex', gap: '12px', alignItems: 'flex-start',
                          transition: 'background 0.2s'
                        }}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--input-bg)'}
                          onMouseLeave={e => e.currentTarget.style.background = n.is_read === 0 ? 'rgba(59,130,246,0.06)' : 'transparent'}
                        >
                          {/* Icon */}
                          <div style={{
                            width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px',
                            background: n.type === 'high_risk' ? '#fecaca' : '#dbeafe'
                          }}>
                            {n.type === 'high_risk' ? '🚨' : '📋'}
                          </div>

                          {/* Content */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                              fontSize: '15px', fontWeight: n.is_read === 0 ? '600' : '400',
                              color: 'var(--text-main)', marginBottom: '3px'
                            }}>
                              {n.title}
                            </div>
                            <div style={{
                              fontSize: '15px', color: 'var(--text-muted)',
                              lineHeight: '1.4', marginBottom: '6px'
                            }}>
                              {n.message}
                            </div>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                              <span style={{ fontSize: '15px', color: 'var(--text-muted)' }}>
                                {new Date(n.created_at).toLocaleString('en-PH', {
                                  month: 'short', day: 'numeric',
                                  hour: '2-digit', minute: '2-digit'
                                })}
                              </span>
                              {n.is_read === 0 && (
                                <button onClick={() => handleMarkRead(n.id)} style={{
                                  background: 'none', border: 'none', color: '#121358',
                                  cursor: 'pointer', fontSize: '15px', fontWeight: '600', padding: 0
                                }}>
                                  Mark read
                                </button>
                              )}
                              {n.link_to && (
                                <button onClick={() => {
                                  handleMarkRead(n.id);
                                  const target = (n.link_to || '').replace(/\s+/g, '');
                                   if (target === 'Inbox') {
                                     const isEditReq = n.title === 'A BHW needs your help';
                                     const isPwChangeReq = n.title === 'Password Change Request';
                                     if (isEditReq || isPwChangeReq) {
                                       setPendingInboxView('inbox:edit-requests');
                                     } else {
                                       setPendingInboxView('inbox');
                                     }
                                     setActiveTab('Manage Cases');
                                   } else if (target === 'Outbox') {
                                     setPendingInboxView('outbox');
                                     setActiveTab('Manage Cases');
                                   } else if (target === 'ManageCases') {
                                     const diseaseName = extractDiseaseFromMessage(n.message);
                                     setCaseFilter({ disease: diseaseName, barangay: '', purok: '' });
                                     setActiveTab('Manage Cases');
                                   } else if (target === 'Registrations') {
                                     setPendingInboxView('inbox:registrations');
                                     setActiveTab('Manage Cases');
                                   } else if (target === 'Settings') {
                                     setActiveTab('Settings');
                                     setOpenSecurityView(true);
                                   } else if (target === 'MapView') {
                                     setActiveTab('Map View');
                                   } else {
                                     setActiveTab(n.link_to);
                                   }
                                  setShowNotifications(false);
                                }} style={{
                                  background: 'none', border: 'none', color: '#129968',
                                  cursor: 'pointer', fontSize: '15px', fontWeight: '600', padding: 0
                                }}>
                                  View →
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Dismiss */}
                          <button onClick={() => handleDismissNotification(n.id)} style={{
                            background: 'none', border: 'none', color: 'var(--text-muted)',
                            cursor: 'pointer', fontSize: '18px', lineHeight: 1,
                            padding: '0 2px', flexShrink: 0
                          }}>
                            ×
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* ── LIVE CLOCK ── */}
            <div style={{
              fontSize: '15px', fontWeight: '500', color: 'rgba(255,255,255,0.7)',
              fontFamily: 'ui-monospace, Consolas, monospace', whiteSpace: 'nowrap',
            }}>
              {clock.toLocaleTimeString('en', {
                timeZone: timeZone.split(' (')[0],
                hour: '2-digit', minute: '2-digit', second: '2-digit',
              })}
            </div>

            <div className="user-profile" onClick={() => setIsDropdownOpen(!isDropdownOpen)}>
              <div className="user-info">
                <div className="user-name">{loggedUser || 'System Officer'}</div>
                <div className="user-role">{loginRole} {t('Specialist')}</div>
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
                  <span style={{ color: 'white', fontWeight: 'bold', fontSize: '15px' }}>
                    {getInitials()}
                  </span>
                )}
              </div>

              <span style={{ color: 'rgba(255,255,255,0.5)', marginLeft: '5px' }}>
                {isDropdownOpen ? '▲' : '▼'}
              </span>

              {isDropdownOpen && (
                <div className="dropdown-menu">
                  <div
                    className="dropdown-item"
                    onClick={openProfileModal}
                  >
                    {loginRole === 'BHW' ? 'BHW Profile' : t('CHO Profile')}
                  </div>
                  <div
                    className="dropdown-item"
                    style={{ color: '#ef4444' }}
                    onClick={handleLogout}
                  >
                    {t('Logout')}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="content-scroller" style={{ zoom: parseFloat(fontScale) }}>
          <div key={`page-${activeTab}`} className="app-page-enter">
            {renderContent()}
          </div>
        </div>
      </div>

      {/* ── FLOATING SYNC BUTTON ── */}
      {pendingSyncCount > 0 && (
        <button
          onClick={handleManualSync}
          disabled={syncingActive || !navigator.onLine}
          style={{
            position: 'fixed', bottom: '24px', right: '24px', zIndex: 9000,
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '10px 18px', borderRadius: '24px',
            background: syncingActive ? '#6366F1' : navigator.onLine ? '#129968' : '#D97706',
            color: '#fff', border: 'none', cursor: syncingActive ? 'wait' : 'pointer',
            boxShadow: '0 4px 16px rgba(0,0,0,0.25)', fontSize: '15px', fontWeight: '600',
            transition: 'all 0.2s'
          }}
        >
          {syncingActive ? (
            <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>⟳</span>
          ) : '⟳'}
          {syncingActive ? 'Syncing...' : `Sync ${pendingSyncCount} item${pendingSyncCount > 1 ? 's' : ''}`}
          {pendingSyncCount > 0 && !syncingActive && (
            <span style={{ background: '#fff', color: navigator.onLine ? '#129968' : '#D97706', borderRadius: '50%', width: '20px', height: '20px', fontSize: '15px', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {pendingSyncCount}
            </span>
          )}
        </button>
      )}

      {/* ── SYNC RESULT TOAST ── */}
      {syncResult && (
        <div
          key={syncToastKey}
          className="cdms-msg-in"
          style={{
            position: 'fixed', bottom: '80px', right: '24px', zIndex: 9001,
            padding: '12px 18px', borderRadius: '10px',
            background: syncResult.type === 'error' ? '#FEF2F2' : syncResult.type === 'conflict' ? '#FFFBEB' : '#F0FDF4',
            border: `1px solid ${syncResult.type === 'error' ? '#FECACA' : syncResult.type === 'conflict' ? '#FDE68A' : '#baf0d7'}`,
            color: syncResult.type === 'error' ? '#DC2626' : syncResult.type === 'conflict' ? '#D97706' : '#129968',
            fontSize: '15px', fontWeight: '500', maxWidth: '340px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
          }}
        >
          {syncResult.synced !== undefined
            ? `${syncResult.synced} case${syncResult.synced !== 1 ? 's' : ''} synced successfully${syncResult.failed > 0 ? `. ${syncResult.failed} failed.` : '.'}`
            : syncResult.type === 'conflict'
            ? `Conflict: ${syncResult.detail?.error || 'Version mismatch detected'}`
            : `Sync error: ${syncResult.detail || 'Unknown'}`
          }
        </div>
      )}

      {/* ── CHO PROFILE MODAL ── */}
      {showProfileModal && (
        <div
          className="cdms-modal-backdrop"
          onClick={() => setShowProfileModal(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 9999,
          }}
        >
          <div
            className="cdms-modal-card"
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
                background: profilePhoto ? 'transparent' : '#129968',
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
                <p style={{ margin: 0, color: 'rgba(255,255,255,0.75)', fontSize: '15px' }}>
                  {loginRole === 'BHW' ? `BHW - ${sessionContext}` : `${loginRole} Specialist - ${sessionContext}`}
                </p>
              </div>
            </div>

            {/* ── Profile details body ── */}
            <div style={{ padding: '28px 32px' }}>
              {profileLoading ? (
                <div style={{ textAlign: 'center', padding: '24px', color: '#64748b', fontSize: '15px' }}>
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
                <div style={{ textAlign: 'center', padding: '16px', color: '#64748b', fontSize: '15px' }}>
                  Could not load profile details.
                </div>
              )}

              {/* ── Action buttons ── */}
              <div style={{ display: 'flex', gap: '12px', marginTop: '24px', paddingTop: '20px', borderTop: '1px solid #e2e8f0' }}>
                <button
                  onClick={() => { setShowProfileModal(false); setActiveTab('Settings'); setOpenProfileView(true); }}
                  style={{
                    flex: 1, padding: '12px', background: '#129968', color: '#fff',
                    border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: '600',
                    cursor: 'pointer',
                  }}
                >
                    ✏️ {t('Edit Profile')}
                </button>
                <button
                  onClick={() => setShowProfileModal(false)}
                  style={{
                    padding: '12px 24px', background: '#f1f5f9', color: '#475569',
                    border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '15px',
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

      {/* ── IDLE TIMEOUT WARNING MODAL ── */}
      {idleWarning && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}>
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '32px', maxWidth: '400px', textAlign: 'center' }}>
            <div style={{ fontSize: '36px', marginBottom: '12px' }}>⏱️</div>
            <h3 style={{ fontSize: '20px', fontWeight: '700', margin: '0 0 8px', color: 'var(--text-main)' }}>Session Timeout Warning</h3>
            <p style={{ fontSize: '15px', color: 'var(--text-muted)', margin: '0 0 20px' }}>You will be logged out in 5 minutes due to inactivity. Move your mouse or press a key to stay signed in.</p>
            <button onClick={() => setIdleWarning(false)} style={{ padding: '10px 28px', background: '#129968', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '15px', fontWeight: '600' }}>
              Stay Signed In
            </button>
          </div>
        </div>
      )}

      <ToastHost />
    </div>
  );
}

export default App;