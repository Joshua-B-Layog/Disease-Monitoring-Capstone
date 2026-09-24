import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from './config';
import BackButton from './components/BackButton';
import ExportPreviewModal from './components/ExportPreview';
import { getAllQueueItems, clearCompleted, getSyncHistory, clearSyncHistory } from './syncEngine';
import { cacheUserProfile, getCachedUserProfile, getCachedBarangays, isOnline, getCachedAtMap } from './offlineSync';
import { authHeaders } from './auth';
import { emitTwoFaChanged, onTwoFaChanged } from './twoFaSignal';
import { formatDate, formatDateTime } from './formatDate';
import { useI18n } from './i18n';
import './ChoSettings.css';

const CACHE_STORES = [
  { key: 'cases_cached_at', label: 'Cases' },
  { key: 'diseases_cached_at', label: 'Diseases' },
  { key: 'barangays_cached_at', label: 'Barangays' },
  { key: 'users_cached_at', label: 'Users' },
  { key: 'auditLogs_cached_at', label: 'Audit Logs' },
  { key: 'generatedReports_cached_at', label: 'Generated Reports' },
  { key: 'notifications_cached_at', label: 'Notifications' },
  { key: 'contactMessages_cached_at', label: 'Contact Messages' },
];

function OfflineSyncPanel({ dateFormat = 'MM/DD/YY' }) {
  const [items, setItems] = useState([]);
  const [history, setHistory] = useState([]);
  const [cachedAt, setCachedAt] = useState({});
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('queue');
  const { t } = useI18n();

  const refresh = async () => {
    setLoading(true);
    try {
      const [all, hist] = await Promise.all([getAllQueueItems(), getSyncHistory()]);
      setItems(all.reverse());
      setHistory(hist);
      setCachedAt(await getCachedAtMap(CACHE_STORES.map(s => s.key)));
    } catch {}
    setLoading(false);
  };

  useEffect(() => { refresh(); }, []);

  const statusColor = (s) => {
    if (s === 'pending') return '#D97706';
    if (s === 'syncing') return '#6366F1';
    if (s === 'done') return '#129968';
    return '#EF4444';
  };

  const typeLabel = (ty) => {
    if (ty === 'create') return t('+ New Case');
    if (ty === 'edit') return t('✎ Edit Case');
    if (ty === 'delete') return t('✕ Delete Case');
    if (ty === 'message') return t('✉ Inbox Message');
    if (ty === 'add_request') return t('Submit New Case for Approval');
    if (ty === 'edit-request' || ty === 'edit_request') return t('Request Case Edit to CHO');
    return ty;
  };

  const statusLabel = (s) => {
    if (s === 'pending') return t('Waiting');
    if (s === 'syncing') return t('Syncing Now');
    if (s === 'done') return t('Completed');
    if (s === 'error') return t('Failed');
    return s;
  };

  if (loading) return <div style={{ padding: '16px', color: 'var(--text-muted)', fontSize: '17px' }}>{t('Loading sync queue...')}</div>;

  const renderRow = (item, idx) => (
    <div key={item.id || idx} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', borderBottom: '1px solid var(--border-color)', fontSize: '17px' }}>
      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: statusColor(item.status), flexShrink: 0 }}></span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontWeight: '600', color: 'var(--text-main)' }}>{typeLabel(item.type)}</span>
        <span style={{ color: 'var(--text-muted)', marginLeft: '8px' }}>
          {formatDateTime(item.timestamp, dateFormat)}
        </span>
      </div>
      <span style={{ fontSize: '17px', padding: '2px 8px', borderRadius: '10px', background: statusColor(item.status) + '22', color: statusColor(item.status), fontWeight: '600' }}>
        {statusLabel(item.status)}
      </span>
      {item.error && <span style={{ fontSize: '17px', color: '#EF4444', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.error}>{item.error}</span>}
    </div>
  );

  return (
    <div>
      <div style={{ background: 'var(--input-bg)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '12px 14px', marginBottom: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <span style={{ fontSize: '17px', fontWeight: '700', color: 'var(--text-main)' }}>{t('Last Sync & Local Cache')}</span>
          <span style={{ fontSize: '17px', fontWeight: '600', color: isOnline() ? '#129968' : '#EF4444' }}>
            {isOnline() ? t('● Online') : t('● Offline')}
          </span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {CACHE_STORES.map(s => {
            const at = cachedAt[s.key];
            return (
              <span key={s.key} style={{ padding: '4px 10px', borderRadius: '10px', fontSize: '15px', fontWeight: '600', background: at ? 'rgba(18,153,104,0.12)' : 'rgba(239,68,68,0.1)', color: at ? '#129968' : '#EF4444', border: `1px solid ${at ? 'rgba(18,153,104,0.35)' : 'rgba(239,68,68,0.35)'}` }}>
                {t(s.label)}: {at ? formatDateTime(at, dateFormat) : t('not cached yet')}
              </span>
            );
          })}
        </div>
        <p style={{ margin: '8px 0 0 0', fontSize: '15px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
          {t('Point-in-time copies of each dataset are saved locally so the app keeps working offline and syncs changes automatically once back online.')}
        </p>
      </div>

      <div style={{ display: 'flex', gap: '4px', marginBottom: '12px', background: 'var(--input-bg)', borderRadius: '8px', padding: '3px' }}>
        <button onClick={() => setTab('queue')} style={{ flex: 1, padding: '6px 12px', borderRadius: '6px', border: 'none', fontSize: '17px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s', background: tab === 'queue' ? 'var(--bg-surface)' : 'transparent', color: tab === 'queue' ? 'var(--text-main)' : 'var(--text-muted)', boxShadow: tab === 'queue' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>
          {t('Queue (')}{items.filter(i => i.status === 'pending').length})
        </button>
        <button onClick={() => setTab('history')} style={{ flex: 1, padding: '6px 12px', borderRadius: '6px', border: 'none', fontSize: '17px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s', background: tab === 'history' ? 'var(--bg-surface)' : 'transparent', color: tab === 'history' ? 'var(--text-main)' : 'var(--text-muted)', boxShadow: tab === 'history' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>
          {t('History (')}{history.length})
        </button>
      </div>

      {tab === 'queue' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
            <button onClick={async () => { await clearCompleted(); refresh(); }} style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-surface)', color: 'var(--text-main)', cursor: 'pointer', fontSize: '17px', fontWeight: '500' }}>
              {t('Archive & Clear Completed')}
            </button>
          </div>
          {items.length === 0 ? (
            <div style={{ padding: '16px', color: 'var(--text-muted)', fontSize: '17px' }}>{t('No offline operations in queue.')}</div>
          ) : (
            <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
              {items.slice(0, 20).map((item, idx) => renderRow(item, idx))}
            </div>
          )}
        </div>
      )}

      {tab === 'history' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
            <button onClick={async () => { await clearSyncHistory(); refresh(); }} style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-surface)', color: 'var(--text-main)', cursor: 'pointer', fontSize: '17px', fontWeight: '500' }}>
              {t('Clear History')}
            </button>
          </div>
          {history.length === 0 ? (
            <div style={{ padding: '16px', color: 'var(--text-muted)', fontSize: '17px' }}>{t('No sync history yet. Completed syncs will appear here.')}</div>
          ) : (
            <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
              {history.slice(0, 50).map((item, idx) => renderRow(item, idx))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const langCodeMap = { 'English':'en', 'Filipino':'fil' };

const CHO_UNIT_BARANGAYS = {
  'CHO Unit I (Sala)': ['Barangay Uno (Poblacion)', 'Barangay Dos (Poblacion)', 'Barangay Tres (Poblacion)', 'Sala', 'Bigaa', 'Butong', 'Marinig', 'Gulod', 'Niugan', 'Baclaran'],
  'CHO Unit II (Pulo)': ['Pulo', 'Banay-Banay', 'Banlic', 'Mamatid', 'San Isidro', 'Diezmo', 'Pittland', 'Casile'],
};

const normBarangay = (name) => (name || '').replace(/\(.*?\)/g, '').replace(/^Barangay\s*/i, '').replace(/^Brgy\.?\s*/i, '').trim().toLowerCase();

const getChoUnitForBarangay = (barangay) => {
  const n = normBarangay(barangay);
  for (const [unit, list] of Object.entries(CHO_UNIT_BARANGAYS)) {
    if (list.some(b => normBarangay(b) === n)) return unit;
  }
  return null;
};

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
  openSecurityView,
  onSecurityViewOpened,
}) {
  const navigate = useNavigate();
  const { t, translateStatus } = useI18n();
  const [currentView, setCurrentView] = useState('menu');
  useEffect(() => {
    if (openProfileView) {
      setCurrentView('profile');
      if (onProfileViewOpened) onProfileViewOpened();
    }
  }, [openProfileView, onProfileViewOpened]);
  useEffect(() => {
    if (openSecurityView) {
      setCurrentView('security');
      if (onSecurityViewOpened) onSecurityViewOpened();
    }
  }, [openSecurityView, onSecurityViewOpened]);
  const fileInputRef = useRef(null);
  const restoreInputRef = useRef(null);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [restoreMsg, setRestoreMsg] = useState('');
  const [restoreError, setRestoreError] = useState('');
  const [storageStats, setStorageStats] = useState(null);
  const [storageLoading, setStorageLoading] = useState(false);
  const [lastBackupDate, setLastBackupDate] = useState(() => localStorage.getItem('cdms_last_backup') || null);
  const [backupLoading, setBackupLoading] = useState(false);
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(() => localStorage.getItem('cdms_auto_backup') !== 'false');
  const [toastMsg, setToastMsg] = useState('');
  const [toastType, setToastType] = useState('success');
  const [preview, setPreview] = useState(null);

  const downloadBlob = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const openPrint = (html, filename) => {
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.open();
    w.document.write(html);
    w.document.close();
    if (filename) w.document.title = filename.replace(/\.(pdf|doc)$/, '');
    setTimeout(() => { try { w.focus(); w.print(); } catch (e) { /* ignore */ } }, 350);
  };

  // ── Offline detection ──
  const [offlineMode, setOfflineMode] = useState(!isOnline());
  useEffect(() => {
    const check = () => setOfflineMode(!isOnline());
    window.addEventListener('online', check);
    window.addEventListener('offline', check);
    document.addEventListener('visibilitychange', check);
    return () => {
      window.removeEventListener('online', check);
      window.removeEventListener('offline', check);
      document.removeEventListener('visibilitychange', check);
    };
  }, []);

  const offlineBtnStyle = offlineMode ? { opacity: 0.5, cursor: 'not-allowed', pointerEvents: 'none' } : {};

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

  // ── Unit Office Assignment custom dropdown ──
  const [assignOpen, setAssignOpen] = useState(false);
  const assignRef = useRef(null);
  useEffect(() => {
    const handler = (e) => {
      if (assignRef.current && !assignRef.current.contains(e.target)) setAssignOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const coveredNames = (() => {
    const role = activeUser?.role;
    const context = activeUser?.context || '';
    if (role === 'BHW') {
      const unit = getChoUnitForBarangay(context);
      return unit ? CHO_UNIT_BARANGAYS[unit] : (context ? [context] : []);
    }
    return CHO_UNIT_BARANGAYS[context] || Object.values(CHO_UNIT_BARANGAYS).flat();
  })();

  // ── Login sessions (server-tracked) ──
  const [loginSessions, setLoginSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionsMsg, setSessionsMsg] = useState('');
  const [showSessionsModal, setShowSessionsModal] = useState(false);

  // ── Barangay list ──
  const [barangayList, setBarangayList] = useState([]);

  const coveredOptions = barangayList.filter(b => coveredNames.some(cn => normBarangay(cn) === normBarangay(b.name)));

  // ── Security ──
  const [security, setSecurity] = useState({
    currentPassword: '', newPassword: '', confirmPassword: ''
  });
  const [passwordMsg, setPasswordMsg] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  // ── Password Change Request (BHW) ──
  const [pwRequestStatus, setPwRequestStatus] = useState('none'); // 'none' | 'pending' | 'accepted'
  const [pwRequestLoading, setPwRequestLoading] = useState(false);
  const [pwRequestMsg, setPwRequestMsg] = useState('');

  // ── 2FA ──
  const [isTwoFactorEnabled, setIsTwoFactorEnabled] = useState(false);
  const [twoFaStep, setTwoFaStep] = useState('idle'); // 'idle' | 'email_sent' | 'verified'
  const [twoFaLoading, setTwoFaLoading] = useState(false);
  const [twoFaMsg, setTwoFaMsg] = useState('');
  const [twoFaFallbackLink, setTwoFaFallbackLink] = useState('');
  const [disableOtp, setDisableOtp] = useState('');
  const [disableOtpError, setDisableOtpError] = useState('');
  const [disableOtpLoading, setDisableOtpLoading] = useState(false);

  // ── Notifications ──
  const [notifications, setNotifications] = useState({
    emailNotifications: false, pushNotifications: false,
    newCaseReported: false, caseStatusUpdated: false,
    updatedCaseReported: false,
    weeklySummary: false, systemMaintenance: false,
    vaccineAdvisories: false,
  });
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifSaveMsg, setNotifSaveMsg] = useState('');
  const [runningWeekly, setRunningWeekly] = useState(false);
  const [systemPrefsSaveMsg, setSystemPrefsSaveMsg] = useState('');

  useEffect(() => {
    if (currentView !== 'notifications' || !userId) return;
    setNotifSaveMsg('');
    setSystemPrefsSaveMsg('');
    setNotifLoading(true);
    fetch(`${API_URL}/api/notification-preferences/${userId}`, { headers: authHeaders() })
      .then(r => r.json())
      .then(data => {
        setNotifications({
          emailNotifications: !!data.email_notifications,
          pushNotifications: !!data.push_notifications,
          smsNotifications: !!data.sms_notifications,
          newCaseReported: !!data.new_case_reported,
          caseStatusUpdated: !!data.case_status_updated,
          updatedCaseReported: !!data.updated_case_reported,
          weeklySummary: !!data.weekly_summary,
          systemMaintenance: !!data.system_maintenance,
          vaccineAdvisories: !!data.vaccine_advisories,
        });
      })
      .catch(() => {})
      .finally(() => setNotifLoading(false));
  }, [currentView, userId]);

  useEffect(() => {
    setSystemPrefsSaveMsg('');
  }, [currentView]);

  // ── Fetch BHW password change request status ──
  useEffect(() => {
    if (currentView !== 'security' || !userId) return;
    if (activeUser?.role === 'BHW') {
      setPwRequestMsg('');
      fetch(`${API_URL}/api/password-change-requests?user_id=${userId}`, { headers: authHeaders() })
        .then(r => r.json())
        .then(data => {
          const pending = Array.isArray(data) ? data.find(r => r.status === 'pending') : null;
          const accepted = Array.isArray(data) ? data.find(r => r.status === 'accepted') : null;
          if (pending) setPwRequestStatus('pending');
          else if (accepted) setPwRequestStatus('accepted');
          else setPwRequestStatus('none');
        })
        .catch(() => {});
    }
  }, [currentView, userId, activeUser]);

  // ── System Prefs ──
  const scaleToLabel = (scale) => {
    if (scale === '0.9') return 'Small';
    if (scale === '1.15') return 'Large';
    return 'Medium';
  };
  const [systemPrefs, setSystemPrefs] = useState({
    darkMode: false,
    fontSize: scaleToLabel(savedFontScale || '1'),
    compactView: (() => { try { return window.matchMedia('(max-width: 820px)').matches; } catch (_e) { return false; } })(),
    displayLanguage: localStorage.getItem('cdms_language') === 'fil' ? 'Filipino'
      : 'English',
    timeZone: localStorage.getItem('cdms_timeZone')?.split(' (')[0] || 'Asia/Manila',
    dateFormat: savedDateFormat || 'MM/DD/YY',
    autoSave: localStorage.getItem('cdms_autoSave') !== 'false',
    confirmDelete: localStorage.getItem('cdms_confirm_delete') !== 'false',
    keyboardShortcuts: localStorage.getItem('cdms_keyboardShortcuts') === 'true',
  });
  const [systemPrefsSnapshot, setSystemPrefsSnapshot] = useState(null);

  // ── Editable keyboard shortcuts (Phase 3) - per-user, read by ManageCases ──
  const shortcutConfKey = `cdms_shortcuts_${userId || '0'}`;
  const [shortcuts, setShortcuts] = useState(() => {
    try {
      const p = JSON.parse(localStorage.getItem(shortcutConfKey) || '{}') || {};
      return { save: 's', saveCtrl: true, newCase: 'n', newCaseCtrl: false, ...p };
    } catch (e) {
      return { save: 's', saveCtrl: true, newCase: 'n', newCaseCtrl: false };
    }
  });
  const saveShortcuts = (next) => {
    setShortcuts(next);
    localStorage.setItem(shortcutConfKey, JSON.stringify(next));
    setSystemPrefsSaveMsg(t('Shortcuts updated!'));
  };
  const resetShortcuts = () => saveShortcuts({ save: 's', saveCtrl: true, newCase: 'n', newCaseCtrl: false });

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

  // Revert unsaved prefs on unmount (e.g. user clicks sidebar tab without saving)
  const snapshotRef = useRef(systemPrefsSnapshot);
  const themeRef = useRef(theme);
  const prefsRef = useRef(systemPrefs);
  const toggleThemeRef = useRef(toggleTheme);
  snapshotRef.current = systemPrefsSnapshot;
  themeRef.current = theme;
  prefsRef.current = systemPrefs;
  toggleThemeRef.current = toggleTheme;

  useEffect(() => {
    return () => {
      const snap = snapshotRef.current;
      if (snap) {
        if (themeRef.current !== snap.theme) toggleThemeRef.current();
        if (prefsRef.current.fontSize !== snap.fontSize) {
          const scale = snap.fontSize === 'Small' ? '0.9' : snap.fontSize === 'Large' ? '1.15' : '1';
          if (onFontSizeChange) onFontSizeChange(scale);
        }
        if (prefsRef.current.compactView !== snap.compactView) {
          if (onCompactChange) onCompactChange(snap.compactView);
        }
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const handleCreateBackup = (silent = false) => {
    setBackupLoading(true);
    fetch(API_URL + '/api/backup', { headers: authHeaders() })
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
        setIsTwoFactorEnabled(!!d.two_fa_enabled);
        setProfileLoading(false);
        cacheUserProfile(userId, d).catch(() => {});
      })
      .catch(async () => {
        const cached = await getCachedUserProfile(userId);
        if (cached) {
          const parts = (cached.full_name || '').trim().split(' ');
          setProfile({
            firstName: parts[0] || '',
            lastName: parts.slice(1).join(' ') || '',
            username: cached.username || '',
            email: cached.email || '',
            phone: cached.mobile_number || '',
            assignment: cached.assigned_barangay_name || activeUser?.context || '',
            assignedBarangayId: cached.assigned_barangay_id || null,
          });
        }
        setProfileLoading(false);
      });
  }, [userId]);

  // ── Load barangay list ──
  useEffect(() => {
    axios.get(API_URL + '/api/barangays')
      .then(res => setBarangayList(res.data))
      .catch(async () => {
        const cached = await getCachedBarangays();
        if (cached.length > 0) setBarangayList(cached);
      });
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
      setSaveMsg(t('First name and last name are required.'));
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
      setSaveMsg(t('✅ Profile saved successfully!'));
      setTimeout(() => { setSaveMsg(''); setCurrentView('menu'); }, 1500);
    } catch (err) {
      setSaveMsg(t('❌ ') + (err.response?.data?.error || t('Failed to save profile.')));
    } finally {
      setSaving(false);
    }
  };

  // ── Change Password ──
  const handleChangePassword = async () => {
    setPasswordMsg('');
    if (!security.currentPassword || !security.newPassword || !security.confirmPassword) {
      setPasswordMsg(t('❌ All password fields are required.'));
      return;
    }
    if (security.newPassword !== security.confirmPassword) {
      setPasswordMsg(t('❌ New passwords do not match.'));
      return;
    }
    if (security.newPassword.length < 8 || !/[A-Z]/.test(security.newPassword) || !/[a-z]/.test(security.newPassword) || !/[0-9]/.test(security.newPassword) || !/[^A-Za-z0-9]/.test(security.newPassword)) {
      setPasswordMsg(t('❌ New password must be 8+ characters with uppercase, lowercase, a number, and a special character.'));
      return;
    }

    setPasswordLoading(true);
    try {
      await axios.put(`${API_URL}/api/users/${userId}/change-password`, {
        currentPassword: security.currentPassword,
        newPassword: security.newPassword,
      });
      setPasswordMsg(t('✅ Password updated successfully!'));
      setSecurity({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      setPasswordMsg(t('❌ ') + (err.response?.data?.error || t('Failed to update password.')));
    } finally {
      setPasswordLoading(false);
    }
  };

  // ── BHW Password Change Request ──
  const handleRequestPasswordChange = async () => {
    setPwRequestLoading(true);
    setPwRequestMsg('');
    try {
      const userName = loggedUser || activeUser?.context || 'BHW User';
const res = await axios.post(`${API_URL}/api/password-change-request`, { user_id: userId, user_name: userName });
      setPwRequestMsg(t('✅ ') + (res.data?.message || t('Request sent to CHO.')));
      setPwRequestStatus('pending');
    } catch (err) {
      setPwRequestMsg(t('❌ ') + (err.response?.data?.error || t('Failed to send request.')));
    } finally {
      setPwRequestLoading(false);
    }
  };

  const handleCancelPasswordRequest = async () => {
    setPwRequestLoading(true);
    setPwRequestMsg('');
    try {
      const res = await axios.get(`${API_URL}/api/password-change-requests?user_id=${userId}`);
      const pending = Array.isArray(res.data) ? res.data.find(r => r.status === 'pending') : null;
      if (pending) {
        await axios.put(`${API_URL}/api/password-change-requests/${pending.id}/reject`);
        setPwRequestStatus('none');
        setPwRequestMsg(t('✅ Request cancelled.'));
      }
    } catch (err) {
      setPwRequestMsg(t('❌ ') + (err.response?.data?.error || t('Failed to cancel request.')));
    } finally {
      setPwRequestLoading(false);
    }
  };

  const handleSetNewPassword = async () => {
    setPasswordMsg('');
    if (!security.newPassword || !security.confirmPassword) {
      setPasswordMsg(t('❌ Both password fields are required.'));
      return;
    }
if (security.newPassword !== security.confirmPassword) {
      setPasswordMsg(t('❌ Passwords do not match.'));
      return;
    }
    if (security.newPassword.length < 8 || !/[A-Z]/.test(security.newPassword) || !/[a-z]/.test(security.newPassword) || !/[0-9]/.test(security.newPassword) || !/[^A-Za-z0-9]/.test(security.newPassword)) {
      setPasswordMsg(t('❌ New password must be 8+ characters with uppercase, lowercase, a number, and a special character.'));
      return;
    }

    setPasswordLoading(true);
    try {
      await axios.put(`${API_URL}/api/users/${userId}/set-password`, { newPassword: security.newPassword });
      setPasswordMsg(t('✅ Password updated successfully!'));
      setSecurity({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setPwRequestStatus('none');
      setPwRequestMsg('');
    } catch (err) {
      setPasswordMsg(t('❌ ') + (err.response?.data?.error || t('Failed to update password.')));
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
        setTwoFaMsg(t('📧 A 6-digit code was sent to ') + maskEmail(profile.email) + t('. Enter it below to disable 2FA.'));
      } catch (err) {
        setTwoFaMsg(t('❌ Failed to send verification code. Please try again.'));
      } finally {
        setTwoFaLoading(false);
      }
      return;
    }

    // Turning ON - send verification email
    setTwoFaLoading(true);
    setTwoFaMsg('');
    setTwoFaFallbackLink('');
    try {
      const res = await axios.post(API_URL + '/api/send-2fa-email', { userId });
      const data = res && res.data ? res.data : {};
      if (data.fallback && data.verifyLink) {
        setTwoFaFallbackLink(data.verifyLink);
        setTwoFaStep('email_sent');
        setTwoFaMsg(data.message || t('Email blocked by the mail service. Use the fallback link below to activate 2FA.'));
      } else {
        setTwoFaStep('email_sent');
        setTwoFaMsg(t('✅ Verification email sent to ') + maskEmail(profile.email) + t('. Click the link in your email to activate 2FA. Check spam/junk if it doesn\'t arrive soon.'));
      }
    } catch (err) {
      const fallbackLink = err.response?.data?.verifyLink;
      if (err.response?.data?.fallback && fallbackLink) {
        setTwoFaFallbackLink(fallbackLink);
        setTwoFaStep('email_sent');
        setTwoFaMsg(err.response.data.message || t('Email blocked by the mail service. Use the fallback link below to activate 2FA.'));
      } else {
        setTwoFaMsg(t('❌ ') + (err.response?.data?.error || t('Failed to send verification email. Please try again.')));
      }
    } finally {
      setTwoFaLoading(false);
    }
  };

  // ── Confirm disable 2FA with OTP ──
  const handleConfirmDisable2FA = async () => {
    setDisableOtpError('');
    if (disableOtp.length !== 6) {
      setDisableOtpError(t('Please enter the 6-digit code sent to your email.'));
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
        setTwoFaMsg(t('✅ Two-Factor Authentication has been disabled.'));
        setDisableOtp('');
        emitTwoFaChanged(userId, false);
      }
    } catch (err) {
      setDisableOtpError(err.response?.data?.error || t('Invalid or expired code.'));
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

  // ── Login sessions (server-tracked) ──
  const loadSessions = () => {
    if (!userId) return;
    setSessionsLoading(true);
    axios.get(`${API_URL}/api/users/${userId}/sessions`)
      .then(res => setLoginSessions(Array.isArray(res.data?.sessions) ? res.data.sessions : []))
      .catch(() => setLoginSessions([]))
      .finally(() => setSessionsLoading(false));
  };

  useEffect(() => {
    loadSessions();
  }, [userId]);

  useEffect(() => {
    if (showSessionsModal) {
      setSessionsMsg('');
      loadSessions();
    }
  }, [showSessionsModal]);

  const handleRevokeSession = async (sessionId) => {
    setSessionsMsg('');
    try {
      await axios.delete(`${API_URL}/api/users/${userId}/sessions/${sessionId}`);
      setLoginSessions(prev => prev.filter(s => s.id !== sessionId));
      setSessionsMsg(t('✅ That session has been logged out.'));
    } catch (err) {
      setSessionsMsg(t('❌ ') + (err.response?.data?.error || t('Failed to revoke session.')));
    }
  };

  const handleRevokeAllSessions = async () => {
    setSessionsMsg('');
    try {
      await axios.delete(`${API_URL}/api/users/${userId}/sessions`);
      setLoginSessions(prev => prev.filter(s => s.isCurrent));
      setSessionsMsg(t('✅ All other sessions have been logged out.'));
      loadSessions();
    } catch (err) {
      setSessionsMsg(t('❌ ') + (err.response?.data?.error || t('Failed to revoke sessions.')));
    }
  };

  // ── Real-time 2FA status sync (cross-tab) ──
  const refreshTwoFa = () => {
    if (!userId) return;
    axios.get(`${API_URL}/api/users/${userId}/profile`)
      .then(res => setIsTwoFactorEnabled(!!(res.data && res.data.two_fa_enabled)))
      .catch(() => {});
  };

  useEffect(() => {
    if (!userId) return;
    const unsubscribe = onTwoFaChanged(userId, (enabled) => {
      refreshTwoFa();
      if (enabled) {
        setTwoFaStep('idle');
        setTwoFaMsg('');
        setTwoFaFallbackLink('');
        setDisableOtp('');
        setDisableOtpError('');
      }
    });
    const onVisible = () => {
      if (document.visibilityState === 'visible') refreshTwoFa();
    };
    const onFocus = () => refreshTwoFa();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onFocus);
    return () => {
      unsubscribe();
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onFocus);
    };
  }, [userId]);

  // ── Format helpers ──
  const maskEmail = (email) => {
    if (!email) return '-';
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

    if (diffMins < 1) return t('Just Now');
    if (diffMins < 60) return `${diffMins}${diffMins !== 1 ? t(' minutes ago') : t(' minute ago')}`;
    if (diffHours < 24) return `${diffHours}${diffHours !== 1 ? t(' hours ago') : t(' hour ago')}`;
    if (diffDays === 1) return t('Yesterday');
    return formatDateTime(date, systemPrefs.dateFormat);
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
      newCaseReported: false,
      caseStatusUpdated: false,
      updatedCaseReported: false,
      weeklySummary: false,
      systemMaintenance: false,
    }));
  } else if (key === 'pushNotifications' && value) {
    // When push is turned ON, auto-enable the two case-report toggles
    setNotifications(prev => ({
      ...prev,
      pushNotifications: true,
      newCaseReported: true,
      updatedCaseReported: true,
    }));
  } else if (key !== 'pushNotifications' && value && !notifications.pushNotifications) {
    // Can't turn on sub-toggles if push is off
    return;
  } else {
    setNotifications(prev => ({ ...prev, [key]: value }));
  }
};

  const handleRunWeeklyNow = async () => {
    setRunningWeekly(true);
    try {
      const res = await fetch(`${API_URL}/api/weekly-summary/run`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() },
      });
      const data = await res.json();
      if (res.ok) {
        setToastMsg(data.message || t('Weekly summary sent to subscribed users!'));
        setToastType('success');
      } else {
        setToastMsg(data.error || t('Weekly summary run failed.'));
        setToastType('error');
      }
    } catch {
      setToastMsg(t('Network error. Is the server running?'));
      setToastType('error');
    }
    setRunningWeekly(false);
    setTimeout(() => setToastMsg(''), 4000);
  };

  // Derive display name
  const displayName = `${profile.firstName} ${profile.lastName}`.trim() || loggedUser || t('CHO Admin');
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
          padding: '12px 20px', borderRadius: '8px', fontSize: '17px', fontWeight: '500',
          background: toastType === 'success' ? '#129968' : '#ef4444',
          color: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
        }}>
          {toastMsg}
        </div>
      )}
      <div className="settings-container">

        {/* ── MENU VIEW ── */}
        {currentView === 'menu' && (
          <div>
            <h1 className="settings-title">{t('Settings')} Module</h1>
            {offlineMode && (
              <div style={{ padding: '10px 14px', marginBottom: '16px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '8px', fontSize: '17px', color: '#D97706', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '16px' }}>⚠</span>
                {t('Offline - settings changes require an internet connection.')}
              </div>
            )}
            <p className="settings-subtitle">
              {t('Manage your account credentials, notifications, and core configuration behaviors.')}
            </p>
            <div className="menu-grid">
              <NavigationCard title={t('Profile Settings')} icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="#121358"><path d="m23.58 8.536-3.362-5.4-4.945 3.08v-6.216h-6.546v6.216l-4.945-3.08-3.362 5.4 5.563 3.464-5.563 3.464 3.362 5.4 4.945-3.08v6.216h6.546v-6.216l4.945 3.08 3.362-5.4-5.563-3.464z"/></svg>} view="profile" />
              <NavigationCard title={t('Account Security')} icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="#2563EB"><path d="M19.944,2.642,12,.009,4.056,2.643A3,3,0,0,0,2,5.49V12c0,7.524,9.2,11.679,9.594,11.852l.354.157.368-.122C12.711,23.755,22,20.577,22,12V5.49A3,3,0,0,0,19.944,2.642Z"/></svg>} view="security" />
              <NavigationCard title={t('Notifications')} icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="#D97706"><path d="M20,8c-2.21,0-4-1.79-4-4S17.79,0,20,0s4,1.79,4,4-1.79,4-4,4Zm-8,7.42c.77,0,1.54-.29,2.12-.88l4.67-4.67c-2.73-.56-4.79-2.98-4.79-5.88,0-.34,.04-.67,.09-1H5c-1.81,0-3.38,.97-4.26,2.41L9.88,14.55c.58,.58,1.35,.88,2.12,.88Zm9.76-5.69l-6.23,6.23c-.97,.97-2.26,1.46-3.54,1.46s-2.56-.49-3.54-1.46L.05,7.54c-.01,.15-.05,.3-.05,.46v11c0,2.76,2.24,5,5,5h14c2.76,0,5-2.24,5-5l-.02-10.53c-.64,.57-1.39,1-2.22,1.26Z"/></svg>} view="notifications" />
              <NavigationCard title={t('System Preferences')} icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="#475569"><path d="M21,12a9.143,9.143,0,0,0-.15-1.645L23.893,8.6l-3-5.2L17.849,5.159A9,9,0,0,0,15,3.513V0H9V3.513A9,9,0,0,0,6.151,5.159L3.107,3.4l-3,5.2L3.15,10.355a9.1,9.1,0,0,0,0,3.29L.107,15.4l3,5.2,3.044-1.758A9,9,0,0,0,9,20.487V24h6V20.487a9,9,0,0,0,2.849-1.646L20.893,20.6l3-5.2L20.85,13.645A9.143,9.143,0,0,0,21,12Zm-6,0a3,3,0,1,1-3-3A3,3,0,0,1,15,12Z"/></svg>} view="system" />
              <NavigationCard title={t('Data Management')} icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="#0891B2"><path d="M2 20h20v-4H2v4zm2-3h2v2H4v-2zm-2-3h20v-4H2v4zm2-3h2V9H4v2zm-2-3h20V4H2v4zm2-3h2V5H4v2z"/></svg>} view="data" isFullWidth />
            </div>
          </div>
        )}

        {/* ── PROFILE SETTINGS VIEW ── */}
        {currentView === 'profile' && (
          <div className="detail-view-container">
            <BackButton onClick={() => { setCurrentView('menu'); setSaveMsg(''); }} style={{ marginBottom: '24px' }}>{t('Back to Settings')}</BackButton>

            {profileLoading ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>{t('Loading profile...')}</div>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '24px', marginBottom: '24px' }}>
                  <div style={{ position: 'relative', width: '110px', height: '110px', flexShrink: 0 }}>
                    <div style={{
                      width: '100%', height: '100%', borderRadius: '50%',
                      background: profilePhoto ? 'transparent' : '#129968',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                    }}>
                      {profilePhoto ? (
                        <img src={profilePhoto} alt={t('Profile')} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
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
                    <h2 style={{ fontSize: '26px', fontWeight: '600', color: 'var(--text-main)', margin: 0 }}>{displayName}</h2>
                    <p style={{ fontSize: '17px', color: 'var(--text-muted)', margin: 0 }}>
                      {activeUser?.role === 'BHW'
                        ? `BHW - ${profile.assignment || activeUser?.context || ''}`
                        : `${activeUser?.role || 'CHO'} ${t('Specialist')} - ${profile.assignment || activeUser?.context || ''}`
                      }
                    </p>
                    <button onClick={() => fileInputRef.current.click()}
                      style={{ background: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '8px', padding: '8px 18px', fontSize: '17px', fontWeight: '500', cursor: 'pointer', marginTop: '6px', width: 'fit-content' }}>
                      {t('Change Photo')}
                    </button>
                    {profilePhoto && (
                      <button onClick={() => onProfilePhotoChange(null)}
                        style={{ background: 'transparent', color: '#ef4444', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '6px 14px', fontSize: '17px', cursor: 'pointer', width: 'fit-content' }}>
                        {t('Remove Photo')}
                      </button>
                    )}
                  </div>
                  <input type="file" ref={fileInputRef} onChange={handleImageChange} style={{ display: 'none' }} accept="image/*" />
                </div>

                <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '24px 0' }} />

                {saveMsg && (
                  <div className={`cdms-msg-in ${saveMsg.startsWith('✅') ? '' : 'cdms-msg-shake'}`} style={{ background: 'var(--input-bg)', color: saveMsg.startsWith('✅') ? '#0a5e42' : '#991b1b', padding: '12px 16px', borderRadius: '8px', marginBottom: '20px', fontSize: '17px', fontWeight: '500' }}>
                    {saveMsg}
                  </div>
                )}

                <div className="cdms-profile-fields-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '40px' }}>
                  {[
                    { label: 'First Name', key: 'firstName', type: 'text' },
                    { label: 'Last Name', key: 'lastName', type: 'text' },
                    { label: 'Username', key: 'username', type: 'text', readOnly: true },
                    { label: 'Email', key: 'email', type: 'email' },
                    { label: 'Contact Number', key: 'phone', type: 'text' },
                  ].map(field => (
                    <div key={field.key} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '17px', fontWeight: '500', color: 'var(--text-muted)' }}>{t(field.label)}</label>
                      <input type={field.type} value={profile[field.key]} readOnly={field.readOnly}
                        onChange={e => !field.readOnly && setProfile({ ...profile, [field.key]: e.target.value })}
                        style={{ ...fieldStyle, background: 'var(--input-bg)', color: field.readOnly ? 'var(--text-muted)' : 'var(--text-main)', cursor: field.readOnly ? 'not-allowed' : 'text' }} />
                    </div>
                  ))}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '17px', fontWeight: '500', color: 'var(--text-muted)' }}>{t('Unit Office Assignment')}</label>
                    <div style={{ position: 'relative' }} ref={assignRef}>
                      <button type="button"
                        onClick={() => setAssignOpen(!assignOpen)}
                        style={{ ...fieldStyle, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', textAlign: 'left', background: 'var(--input-bg)', color: 'var(--text-main)' }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {profile.assignment || t('- Select Assignment -')}
                        </span>
                        <span style={{ fontSize: '15px', transform: assignOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', opacity: 0.6, pointerEvents: 'none' }}>▼</span>
                      </button>
                      {assignOpen && (
                        <div style={{
                          position: 'absolute', top: 'calc(100% + 6px)', left: '0', right: '0', zIndex: 30,
                          background: 'var(--bg-surface)', border: '1px solid var(--border-color)',
                          borderRadius: '12px', boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
                          maxHeight: '220px', overflowY: 'auto', padding: '4px',
                        }}>
                          <button type="button"
                            onClick={() => { setProfile({ ...profile, assignedBarangayId: null, assignment: '' }); setAssignOpen(false); }}
                            style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '9px 12px', border: 'none', borderRadius: '8px', cursor: 'pointer', background: !profile.assignedBarangayId ? 'rgba(96,165,250,0.18)' : 'transparent', color: 'var(--text-main)', fontSize: '15px', fontWeight: !profile.assignedBarangayId ? '600' : '400', textAlign: 'left' }}>
                            <span style={{ flex: 1 }}>{t('- Select Assignment -')}</span>
                            {!profile.assignedBarangayId && <span style={{ color: '#60a5fa', fontSize: '15px' }}>✓</span>}
                          </button>
                          {coveredOptions.map(b => {
                            const isSel = profile.assignedBarangayId === b.id;
                            return (
                              <button key={b.id} type="button"
                                onClick={() => { setProfile({ ...profile, assignedBarangayId: b.id, assignment: b.name }); setAssignOpen(false); }}
                                style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '9px 12px', border: 'none', borderRadius: '8px', cursor: 'pointer', background: isSel ? 'rgba(96,165,250,0.18)' : 'transparent', color: 'var(--text-main)', fontSize: '15px', fontWeight: isSel ? '600' : '400', textAlign: 'left' }}>
                                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.name}</span>
                                {isSel && <span style={{ color: '#60a5fa', fontSize: '15px' }}>✓</span>}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    <span style={{ fontSize: '15px', color: 'var(--text-muted)' }}>
                      {activeUser?.role === 'BHW'
                        ? `${t('Showing barangays covered by your CHO unit')}${coveredNames.length > 1 ? ` (${coveredNames.length})` : ''}.`
                        : `${t('Showing barangays covered by ')}${((activeUser?.context || '').split('(')[0] || t('your unit')).trim()} (${coveredNames.length}).`}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '16px', marginTop: '24px' }}>
                  <button onClick={() => { setCurrentView('menu'); setSaveMsg(''); }}
                    style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', color: 'var(--text-main)', borderRadius: '12px', padding: '12px 48px', fontSize: '17px', fontWeight: '500', cursor: 'pointer' }}>
                    {t('Cancel')}
                  </button>
                  <button onClick={handleSaveProfile} disabled={saving}
                    style={{ background: saving ? '#6fd4a2' : '#129968', border: 'none', color: '#ffffff', borderRadius: '12px', padding: '12px', fontSize: '17px', fontWeight: '500', cursor: saving ? 'not-allowed' : 'pointer', flexGrow: 1 }}>
                    {saving ? t('Saving...') : t('Save Changes')}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── ACCOUNT SECURITY VIEW ── */}
        {currentView === 'security' && (
          <div className="detail-view-container security-view-view">
            <BackButton onClick={() => { setCurrentView('menu'); setPasswordMsg(''); setTwoFaMsg(''); }}>{t('Back to Settings')}</BackButton>

            {/* ── 1. CHANGE PASSWORD ── */}
            <div className="security-section-card">
              <div className="security-card-header">
                <div className="security-icon-box">
                  <svg width="22" height="22" viewBox="0 0 512 512" fill="#D97706"><path d="M405.333,179.712v-30.379C405.333,66.859,338.475,0,256,0S106.667,66.859,106.667,149.333v30.379   c-38.826,16.945-63.944,55.259-64,97.621v128C42.737,464.214,90.452,511.93,149.333,512h213.333   c58.881-0.07,106.596-47.786,106.667-106.667v-128C469.278,234.971,444.159,196.657,405.333,179.712z M277.333,362.667   c0,11.782-9.551,21.333-21.333,21.333c-11.782,0-21.333-9.551-21.333-21.333V320c0-11.782,9.551-21.333,21.333-21.333   c11.782,0,21.333,9.551,21.333,21.333V362.667z M362.667,170.667H149.333v-21.333c0-58.91,47.756-106.667,106.667-106.667   s106.667,47.756,106.667,106.667V170.667z"/></svg>
                </div>
                <div className="security-header-text">
                  <h3>{t('Change Password')}</h3>
                  <span className="security-timestamp">{t('Update your account password')}</span>
                </div>
              </div>

              {passwordMsg && (
                <div style={{
                  margin: '0 0 16px 0', padding: '10px 14px', borderRadius: '8px', fontSize: '17px', fontWeight: '500',
                  background: 'var(--input-bg)',
                  color: passwordMsg.startsWith('✅') ? '#0a5e42' : '#991b1b',
                }}>
                  {passwordMsg}
                </div>
              )}

              {pwRequestMsg && (
                <div style={{
                  margin: '0 0 16px 0', padding: '10px 14px', borderRadius: '8px', fontSize: '17px', fontWeight: '500',
                  background: 'var(--input-bg)',
                  color: pwRequestMsg.startsWith('✅') ? '#0a5e42' : '#991b1b',
                }}>
                  {pwRequestMsg}
                </div>
              )}

              <div className="security-card-body">
                {activeUser?.role === 'BHW' ? (
                  /* ── BHW: Request / Cancel / Set New Password ── */
                  <>
                    {pwRequestStatus === 'pending' && (
                      <div style={{ textAlign: 'center', padding: '20px 0' }}>
                        <div style={{ fontSize: '17px', color: 'var(--text-main)', fontWeight: '600', marginBottom: '8px' }}>
                          {t('Request Pending')}
                        </div>
                        <p style={{ fontSize: '17px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                          {t('Your password change request is awaiting CHO approval.')}
                        </p>
                        <button onClick={handleCancelPasswordRequest} disabled={pwRequestLoading || offlineMode}
                          style={{ padding: '10px 24px', borderRadius: '8px', border: '1px solid #ef4444', background: 'transparent', color: '#ef4444', fontSize: '17px', fontWeight: '600', cursor: pwRequestLoading ? 'not-allowed' : 'pointer', opacity: offlineMode ? 0.5 : 1 }}>
                          {pwRequestLoading ? t('Cancelling...') : t('Cancel Request')}
                        </button>
                      </div>
                    )}

                    {pwRequestStatus === 'accepted' && (
                      <>
                        <p style={{ fontSize: '17px', color: 'var(--success-text)', marginBottom: '16px', padding: '8px 12px', background: 'var(--success-bg)', borderRadius: '8px' }}>
                          {t('Your request was approved. Set your new password below.')}
                        </p>
                        {[
                          { field: 'newPassword', label: 'New Password', show: showNew, setShow: setShowNew },
                          { field: 'confirmPassword', label: 'Confirm New Password', show: showConfirm, setShow: setShowConfirm },
                        ].map(({ field, label, show, setShow }) => (
                          <div key={field} className="security-input-row">
                            <label>{t(label)}</label>
                            <div className="security-password-wrapper">
                              <input type={show ? 'text' : 'password'} value={security[field]}
                                onChange={e => setSecurity({ ...security, [field]: e.target.value })}
                                placeholder={t(`Enter ${label}`)} />
                              <button type="button" className="security-eye-btn" onClick={() => setShow(!show)}>
                                {show ? (
                                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2">
                                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                                    <line x1="1" y1="1" x2="23" y2="23"/>
                                  </svg>
                                ) : (
                                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2">
                                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                    <circle cx="12" cy="12" r="3" />
                                  </svg>
                                )}
                              </button>
                            </div>
                            {field === 'confirmPassword' && security.confirmPassword && (
                              <p style={{ fontSize: '17px', marginTop: '5px', color: security.newPassword === security.confirmPassword ? '#129968' : '#ef4444' }}>
                                {security.newPassword === security.confirmPassword ? t('✓ Passwords match') : t('✗ Passwords do not match')}
                              </p>
                            )}
                          </div>
                        ))}
                        <button onClick={handleSetNewPassword} disabled={passwordLoading || offlineMode} className="security-action-blue-btn"
                          style={{ ...offlineBtnStyle, opacity: passwordLoading ? 0.7 : offlineBtnStyle.opacity || 1, cursor: passwordLoading ? 'not-allowed' : offlineBtnStyle.cursor || 'pointer' }}>
                          {passwordLoading ? t('Updating...') : t('Set New Password')}
                        </button>
                      </>
                    )}

                    {pwRequestStatus === 'none' && (
                      <div style={{ textAlign: 'center', padding: '20px 0' }}>
                        <p style={{ fontSize: '17px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                          {t('To change your password, send a request to the City Health Office for approval.')}
                        </p>
                        <button onClick={handleRequestPasswordChange} disabled={pwRequestLoading || offlineMode}
                          style={{ padding: '10px 28px', borderRadius: '8px', border: 'none', background: '#129968', color: '#fff', fontSize: '17px', fontWeight: '600', cursor: pwRequestLoading ? 'not-allowed' : 'pointer', opacity: offlineMode ? 0.5 : 1 }}>
                          {pwRequestLoading ? t('Sending...') : t('Request Password Change')}
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  /* ── CHO: Direct password change (existing form) ── */
                  <>
                    {[
                      { field: 'currentPassword', label: 'Current Password', show: showCurrent, setShow: setShowCurrent },
                      { field: 'newPassword', label: 'New Password', show: showNew, setShow: setShowNew },
                      { field: 'confirmPassword', label: 'Confirm New Password', show: showConfirm, setShow: setShowConfirm },
                    ].map(({ field, label, show, setShow }) => (
                      <div key={field} className="security-input-row">
                        <label>{t(label)}</label>
                        <div className="security-password-wrapper">
                          <input type={show ? 'text' : 'password'} value={security[field]}
                            onChange={e => setSecurity({ ...security, [field]: e.target.value })}
                            placeholder={t(`Enter ${label}`)} />
                          <button type="button" className="security-eye-btn" onClick={() => setShow(!show)}>
                            {show ? (
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2">
                                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                                <line x1="1" y1="1" x2="23" y2="23"/>
                              </svg>
                            ) : (
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                <circle cx="12" cy="12" r="3" />
                              </svg>
                            )}
                          </button>
                        </div>
                        {field === 'confirmPassword' && security.confirmPassword && (
                          <p style={{ fontSize: '17px', marginTop: '5px', color: security.newPassword === security.confirmPassword ? '#129968' : '#ef4444' }}>
                            {security.newPassword === security.confirmPassword ? t('✓ Passwords match') : t('✗ Passwords do not match')}
                          </p>
                        )}
                      </div>
                    ))}
                    <button onClick={handleChangePassword} disabled={passwordLoading || offlineMode} className="security-action-blue-btn"
                      style={{ ...offlineBtnStyle, opacity: passwordLoading ? 0.7 : offlineBtnStyle.opacity || 1, cursor: passwordLoading ? 'not-allowed' : offlineBtnStyle.cursor || 'pointer' }}
                      title={offlineMode ? t('Unavailable offline') : ''}>
                      {passwordLoading ? t('Updating...') : t('Update Password')}
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* ── 2. TWO-FACTOR AUTHENTICATION ── */}
            <div className="security-section-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div className="security-card-header" style={{ marginBottom: twoFaStep === 'idle' ? 0 : '16px', flex: 1 }}>
                  <div className="security-icon-box">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="#2563EB"><path d="M19.944,2.642,12,.009,4.056,2.643A3,3,0,0,0,2,5.49V12c0,7.524,9.2,11.679,9.594,11.852l.354.157.368-.122C12.711,23.755,22,20.577,22,12V5.49A3,3,0,0,0,19.944,2.642Z"/></svg>
                  </div>
                  <div className="security-header-text">
                    <h3>{t('Two-Factor Authentication')}</h3>
                    <span className="security-timestamp">
                      {isTwoFactorEnabled
                        ? `${t('✅ Active - verified via ')}${maskEmail(profile.email)}`
                        : t('Currently disabled - adds an extra layer of security')}
                    </span>
                  </div>
                </div>
                <label className="figma-toggle-switch" style={{ flexShrink: 0, marginLeft: '16px', marginTop: '4px', ...(offlineMode ? { opacity: 0.5, pointerEvents: 'none' } : {}) }}>
                  <input type="checkbox" checked={isTwoFactorEnabled}
                    onChange={handle2FAToggle} disabled={twoFaLoading || twoFaStep === 'disable_otp_sent' || offlineMode} title={offlineMode ? t('Unavailable offline') : ''} />
                  <span className="figma-slider" />
                </label>
              </div>

              {twoFaMsg && (
                <div style={{
                  padding: '12px 16px', borderRadius: '8px', fontSize: '17px', fontWeight: '500', marginTop: '12px',
                  background: 'var(--input-bg)',
                  color: twoFaMsg.startsWith('✅') ? '#0a5e42' : twoFaMsg.startsWith('📧') ? '#1e40af' : '#991b1b',
                }}>
                  {twoFaMsg}
                </div>
              )}

              {twoFaStep === 'email_sent' && !isTwoFactorEnabled && (
                <div style={{ marginTop: '14px', padding: '14px 16px', background: 'var(--input-bg)', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '17px', color: '#1e40af' }}>
                  {t('📧 Check your email and click ')}<strong>{t('"Verify Email"')}</strong>{t(' to complete 2FA setup. Once verified, 2FA will be active on your next login.')}
                </div>
              )}

              {twoFaFallbackLink && (
                <div style={{ marginTop: '14px', padding: '14px 16px', background: 'rgba(16,185,129,0.08)', border: '1px solid #129968', borderRadius: '8px', fontSize: '17px', color: 'var(--text-main)' }}>
                  <div style={{ fontWeight: '600', marginBottom: '8px', color: '#129968' }}>🔑 Fallback link (email blocked)</div>
                  <a href={twoFaFallbackLink} style={{ color: '#129968', textDecoration: 'underline', wordBreak: 'break-all' }}>
                    {twoFaFallbackLink}
                  </a>
                  <div style={{ marginTop: '8px', fontSize: '17px', color: 'var(--text-muted)' }}>
                    Open this link to verify and activate 2FA. It also appears in the server console.
                  </div>
                </div>
              )}

              {twoFaStep === 'disable_otp_sent' && (
                <div style={{ marginTop: '14px', padding: '16px', background: 'var(--input-bg)', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                  <label style={{ display: 'block', fontSize: '17px', fontWeight: '600', color: '#991b1b', marginBottom: '8px' }}>
                    {t('Enter the 6-digit code to confirm disabling 2FA')}
                  </label>
                  {disableOtpError && (
                    <div style={{ fontSize: '17px', color: '#dc2626', marginBottom: '8px' }}>{disableOtpError}</div>
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
                        color: '#fff', border: 'none', borderRadius: '6px', fontSize: '17px',
                        fontWeight: '600', cursor: disableOtpLoading ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap',
                      }}
                    >
                      {disableOtpLoading ? t('Verifying...') : t('Confirm Disable')}
                    </button>
                  </div>
                  <button
                    onClick={handleCancelDisable2FA}
                    style={{
                      marginTop: '10px', background: 'none', border: 'none', color: 'var(--text-muted)',
                      fontSize: '17px', cursor: 'pointer', padding: 0, textDecoration: 'underline',
                    }}
                  >
                    {t('Cancel and keep 2FA enabled')}
                  </button>
                </div>
              )}
            </div>

           {/* ── 3. LOGIN SESSIONS ── */}
            <div className="security-section-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div className="security-card-header" style={{ marginBottom: 0 }}>
                  <div className="security-icon-box" style={{ background: 'var(--input-bg)' }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="#64748B"><path d="M24,13V4a3,3,0,0,0-3-3H3A3,3,0,0,0,0,4v9Z"/><polygon points="24 19 24 15 0 15 0 19 11 19 11 21 6 21 6 23 18 23 18 21 13 21 13 19 24 19"/></svg>
                  </div>
                  <div className="security-header-text">
                    <h3>{t('Login Sessions')}</h3>
                    <span className="security-timestamp">
                      {sessionsLoading ? t('Loading sessions...') : `${loginSessions.length}${loginSessions.length !== 1 ? t(' active sessions') : t(' active session')}`}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setShowSessionsModal(true)}
                  className="security-manage-btn">
                  {t('Manage')}
                </button>
              </div>

              {/* Current Session preview (always visible) */}
              {(() => {
                const current = loginSessions.find(s => s.isCurrent) || loginSessions[0];
                if (!current) {
                  return (
                    <div style={{ fontSize: '17px', color: 'var(--text-muted)', textAlign: 'center', padding: '8px 0' }}>
                      {t('No active sessions found.')}
                    </div>
                  );
                }
                return (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '16px',
                    padding: '16px', background: 'var(--input-bg)', border: '1px solid var(--border-color)',
                    borderRadius: '10px',
                  }}>
                    <div style={{ fontSize: '28px', flexShrink: 0 }}>
                      {getDeviceIcon(current.device)}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span style={{ fontSize: '17px', fontWeight: '600', color: 'var(--text-h)' }}>
                          {current.device || t('Current Device')}
                        </span>
                        <span style={{ fontSize: '17px', fontWeight: '700', padding: '2px 8px', borderRadius: '10px', background: '#129968', color: 'white' }}>
                          {t('THIS DEVICE')}
                        </span>
                      </div>
                      <div style={{ fontSize: '17px', color: 'var(--text-muted)' }}>
                        {current.location || t('Cabuyao, Calabarzon, Philippines')}
                      </div>
                      <div style={{ fontSize: '17px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {formatLoginTime(current.created_at)}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {loginSessions.filter(s => !s.isCurrent).length === 0 && !sessionsLoading && (
                <p style={{ margin: '10px 0 0 0', fontSize: '17px', color: 'var(--text-muted)', textAlign: 'center' }}>
                  {t('No other active sessions found.')}
                </p>
              )}
            </div>

            {/* ── SESSIONS MANAGE MODAL ── */}
            {showSessionsModal && (
              <div
                className="cdms-modal-backdrop"
                onClick={() => setShowSessionsModal(false)}
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
                    background: 'var(--bg-surface)', borderRadius: '16px', width: '520px', maxWidth: '95vw',
                    maxHeight: '85vh', overflowY: 'auto',
                    boxShadow: '0 24px 60px rgba(0,0,0,0.25)',
                    padding: '28px 28px 24px 28px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '700', color: 'var(--text-h)' }}>{t('Manage Sessions')}</h3>
                    <button onClick={() => setShowSessionsModal(false)}
                      style={{ background: 'none', border: 'none', fontSize: '22px', color: 'var(--text-muted)', cursor: 'pointer', lineHeight: 1, padding: 0 }}>
                      ×
                    </button>
                  </div>
                  <p style={{ margin: '0 0 20px 0', fontSize: '17px', color: 'var(--text-muted)' }}>
                    {t('Devices currently signed in to your account.')}
                  </p>

                  {sessionsMsg && (
                    <div style={{
                      padding: '12px 16px', borderRadius: '8px', fontSize: '17px', fontWeight: '500', marginBottom: '12px',
                      background: 'var(--input-bg)',
                      color: sessionsMsg.startsWith('✅') ? '#0a5e42' : '#991b1b',
                    }}>
                      {sessionsMsg}
                    </div>
                  )}

                  {sessionsLoading ? (
                    <div style={{ fontSize: '17px', color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>
                      {t('Loading sessions...')}
                    </div>
                  ) : loginSessions.length === 0 ? (
                    <div style={{ padding: '14px 16px', background: 'var(--input-bg)', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '17px', color: 'var(--text-muted)', textAlign: 'center', marginBottom: '12px' }}>
                      {t('No active sessions found.')}
                    </div>
                  ) : (
                    loginSessions.map(session => (
                      <div key={session.id} style={{
                        display: 'flex', alignItems: 'center', gap: '14px',
                        padding: '14px 16px', background: 'var(--input-bg)', border: '1px solid var(--border-color)',
                        borderRadius: '10px', marginBottom: '12px',
                      }}>
                        <div style={{ fontSize: '26px', flexShrink: 0 }}>
                          {getDeviceIcon(session.device)}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '17px', fontWeight: '600', color: 'var(--text-h)' }}>
                              {session.device || t('Unknown Device')}
                            </span>
                            {session.isCurrent && (
                              <>
                                <span style={{ fontSize: '15px', fontWeight: '700', padding: '2px 7px', borderRadius: '10px', background: '#129968', color: 'white' }}>
                                  {t('TRUSTED')}
                                </span>
                                <span style={{ fontSize: '15px', fontWeight: '700', padding: '2px 7px', borderRadius: '10px', background: '#dcf7eb', color: '#129968' }}>
                                  {t('THIS DEVICE')}
                                </span>
                              </>
                            )}
                          </div>
                          <div style={{ fontSize: '17px', color: 'var(--text-muted)' }}>
                            {session.location || t('Unknown Location')}
                          </div>
                          <div style={{ fontSize: '17px', color: 'var(--text-muted)', marginTop: '2px' }}>
                            {formatLoginTime(session.created_at)}
                          </div>
                        </div>
                        {!session.isCurrent && (
                          <button
                            onClick={() => handleRevokeSession(session.id)}
                            style={{ padding: '7px 14px', background: 'transparent', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '17px', fontWeight: '600', color: '#dc2626', cursor: 'pointer', flexShrink: 0 }}>
                            {t('Revoke')}
                          </button>
                        )}
                      </div>
                    ))
                  )}

                  {/* Log Out of All Other Sessions */}
                  {loginSessions.filter(s => !s.isCurrent).length > 0 && (
                    <button
                      onClick={handleRevokeAllSessions}
                      disabled={sessionsLoading}
                      style={{
                        width: '100%', marginTop: '8px', padding: '12px',
                        background: 'var(--input-bg)', border: '1px solid var(--border-color)', borderRadius: '8px',
                        fontSize: '17px', fontWeight: '600', color: '#dc2626', cursor: sessionsLoading ? 'not-allowed' : 'pointer',
                      }}>
                      {t('Log Out of All Other Sessions')}
                    </button>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
                    <button
                      onClick={() => setShowSessionsModal(false)}
                      style={{ padding: '10px 24px', background: '#1e3a8a', border: 'none', borderRadius: '8px', fontSize: '17px', fontWeight: '600', color: '#fff', cursor: 'pointer' }}>
                      {t('Done')}
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
            <BackButton onClick={() => setCurrentView('menu')}>Back to Settings</BackButton>

            {[
              {
                icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="#D97706"><path d="M20,8c-2.21,0-4-1.79-4-4S17.79,0,20,0s4,1.79,4,4-1.79,4-4,4Zm-8,7.42c.77,0,1.54-.29,2.12-.88l4.67-4.67c-2.73-.56-4.79-2.98-4.79-5.88,0-.34,.04-.67,.09-1H5c-1.81,0-3.38,.97-4.26,2.41L9.88,14.55c.58,.58,1.35,.88,2.12,.88Zm9.76-5.69l-6.23,6.23c-.97,.97-2.26,1.46-3.54,1.46s-2.56-.49-3.54-1.46L.05,7.54c-.01,.15-.05,.3-.05,.46v11c0,2.76,2.24,5,5,5h14c2.76,0,5-2.24,5-5l-.02-10.53c-.64,.57-1.39,1-2.22,1.26Z"/></svg>,
                title: 'Notification Channels', subtitle: 'Choose how you want to receive notifications',
                rows: [
                  { key: 'pushNotifications', label: 'Push Notifications', sub: 'Receive push notifications in browser' },
                  { key: 'emailNotifications', label: 'Email Notifications', sub: 'Receive notifications via email' },
                  { key: 'smsNotifications', label: 'SMS Notifications', sub: 'Receive urgent alerts via SMS (mobile number required on your profile)' },
                ],
              },
              {
                icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="#EA580C"><path d="m21.976,10.015h-6.976c-1.654,0-3-1.346-3-3V.038c-.161-.011-.322-.024-.485-.024h-4.515C4.243.015,2,2.258,2,5.015v14c0,2.757,2.243,5,5,5h10c2.757,0,5-2.243,5-5v-8.515c0-.163-.013-.324-.024-.485Zm-10.976,1.985c0-.552.448-1,1-1s1,.448,1,1v3.5c0,.552-.448,1-1,1s-1-.448-1-1v-3.5Zm1,9c-.828,0-1.5-.672-1.5-1.5s.672-1.5,1.5-1.5,1.5.672,1.5,1.5-.672,1.5-1.5,1.5Zm2-13.985V.474c.913.346,1.753.879,2.465,1.59l3.484,3.486c.712.711,1.245,1.551,1.591,2.464h-6.54c-.552,0-1-.449-1-1Z"/></svg>,
                title: 'Case Notifications', subtitle: 'Get notified about case activities',
                rows: [
                  { key: 'newCaseReported', label: 'New Case Reported', sub: 'When a new case is reported in your barangay' },
                  { key: 'updatedCaseReported', label: 'Updated Case Reported', sub: 'When a BHW requests an edit or a CHO updates a case' },
                  { key: 'caseStatusUpdated', label: 'Case Status Updated', sub: 'When a case status changes' },
                ],
              },
              {
                icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="#D97706"><path d="m20,0H4C1.794,0,0,1.794,0,4v12c0,2.206,1.794,4,4,4h2.923l3.749,3.157c.382.339.861.507,1.337.507.468,0,.931-.163,1.292-.484l3.848-3.18h2.852c2.206,0,4-1.794,4-4V4c0-2.206-1.794-4-4-4ZM7,12c-.828,0-1.5-.672-1.5-1.5s.672-1.5,1.5-1.5,1.5.672,1.5,1.5-.672,1.5-1.5,1.5Zm5,0c-.828,0-1.5-.672-1.5-1.5s.672-1.5,1.5-1.5,1.5.672,1.5,1.5-.672,1.5-1.5,1.5Zm5,0c-.828,0-1.5-.672-1.5-1.5s.672-1.5,1.5-1.5,1.5.672,1.5,1.5-.672,1.5-1.5,1.5Z"/></svg>,
                title: 'System Notifications', subtitle: 'Updates about the system',
                rows: [
                  { key: 'weeklySummary', label: 'Weekly Summary', sub: 'Receive a weekly summary of cases' },
                  { key: 'systemMaintenance', label: 'System Maintenance', sub: 'Get notified about scheduled maintenance' },
                  { key: 'vaccineAdvisories', label: 'Seasonal Vaccine Advisories', sub: 'Season-based vaccine reminders so leftover stock does not expire' },
                ],
              },
            ].map(section => (
              <div key={section.title} className="security-section-card">
                <div className="security-card-header">
                  <div className="security-icon-box">{section.icon}</div>
                  <div className="security-header-text">
                    <h3>{t(section.title)}</h3>
                    <span className="security-timestamp">{t(section.subtitle)}</span>
                  </div>
                </div>
                <div className="security-sessions-container">
                  {section.rows.map(row => (
                    <React.Fragment key={row.key}>
                      <div className="session-list-row"
                          style={{ 
                            opacity: row.key !== 'pushNotifications' && !notifications.pushNotifications ? 0.4 : 1,
                            pointerEvents: row.key !== 'pushNotifications' && !notifications.pushNotifications ? 'none' : 'auto'
                          }}>
                        <div className="session-info-meta"><h4>{t(row.label)}</h4><p>{t(row.sub)}</p></div>
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
                      {row.key === 'weeklySummary' && activeUser?.role === 'CHO' && notifications.weeklySummary && (
                        <div style={{ padding: '2px 0 14px 0', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <button onClick={handleRunWeeklyNow} disabled={runningWeekly}
                            style={{
                              alignSelf: 'flex-start', padding: '8px 16px', borderRadius: '8px',
                              border: '1px solid var(--border-color)',
                              background: runningWeekly ? 'var(--input-bg)' : 'var(--bg-surface)',
                              color: 'var(--text-main)', cursor: runningWeekly ? 'wait' : 'pointer',
                              fontSize: '15px', fontWeight: '700',
                              display: 'flex', alignItems: 'center', gap: '6px',
                            }}>
                            ⚡ {runningWeekly ? t('Sending...') : t('Run Weekly Summary Now')}
                          </button>
                          <span style={{ fontSize: '15px', color: 'var(--text-muted)' }}>
                            {t('Runs now instead of waiting for the Friday 5PM auto-send.')}
                          </span>
                        </div>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            ))}

            <div className="notifications-action-container">
              {notifLoading && <span style={{ fontSize: '17px', color: 'var(--text-muted)', marginRight: '12px' }}>{t('Loading...')}</span>}
              {notifSaveMsg && <span style={{ fontSize: '17px', color: 'var(--text-muted)', marginRight: '12px' }}>{notifSaveMsg}</span>}
              <button className="notifications-save-btn" disabled={offlineMode} style={offlineBtnStyle} title={offlineMode ? t('Unavailable offline') : ''} onClick={async () => {
                setNotifSaveMsg('');
                try {
                  const res = await fetch(`${API_URL}/api/notification-preferences/${userId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', ...authHeaders() },
                    body: JSON.stringify({
                      push_notifications: notifications.pushNotifications,
                      email_notifications: notifications.emailNotifications,
                      sms_notifications: notifications.smsNotifications,
                      new_case_reported: notifications.newCaseReported,
                      case_status_updated: notifications.caseStatusUpdated,
                      updated_case_reported: notifications.updatedCaseReported,
                      weekly_summary: notifications.weeklySummary,
                      system_maintenance: notifications.systemMaintenance,
                      vaccine_advisories: notifications.vaccineAdvisories,
                    }),
                  });
                  if (res.ok) {
                    setNotifSaveMsg(t('Preferences saved!'));
                    setTimeout(() => setCurrentView('menu'), 800);
                  } else {
                    setNotifSaveMsg(t('Failed to save.'));
                  }
                } catch {
                  setNotifSaveMsg(t('Save error. Try again.'));
                }
              }}>{t('Save Preferences')}</button>
            </div>

            {/* Send Maintenance Notice - only for CHO */}
            {activeUser?.role === 'CHO' && notifications.systemMaintenance && (
              <div className="security-section-card" style={{ marginTop: '24px', borderColor: '#fde68a' }}>
                <div className="security-card-header">
                  <div className="security-icon-box" style={{ background: 'var(--input-bg)' }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="#DC2626"><path d="M20.5,8.48V3.5h-4.98L12-.02l-3.52,3.52H3.5v4.98L-.02,12l3.52,3.52v4.98h4.98l3.52,3.52,3.52-3.52h4.98v-4.98l3.52-3.52-3.52-3.52Zm-7.5,9.52h-2v-2h2v2Zm0-4h-2V6h2V14Z"/></svg>
                  </div>
                  <div className="security-header-text">
                    <h3>{t('Send Maintenance Notice')}</h3>
                    <span className="security-timestamp">{t('Broadcast a system maintenance alert to all users')}</span>
                  </div>
                </div>
                <div style={{ padding: '0 0 12px 0', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <input type="text" placeholder={t('Subject (e.g. Scheduled Maintenance)')} id="maint-title"
                    style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '17px', background: 'var(--input-bg)', color: 'var(--text-main)', outline: 'none' }} />
                  <textarea placeholder={t('Message describing the maintenance...')} id="maint-message" rows={3}
                    style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '17px', background: 'var(--input-bg)', color: 'var(--text-main)', outline: 'none', resize: 'vertical' }} />
                  <button onClick={async () => {
                    const title = document.getElementById('maint-title').value.trim();
                    const message = document.getElementById('maint-message').value.trim();
                    if (!title || !message) { setToastMsg(t('Please enter both a subject and message.')); setToastType('error'); setTimeout(() => setToastMsg(''), 3000); return; }
                    try {
                      const res = await fetch(`${API_URL}/api/notifications/system-maintenance`, {
                        method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify({ title, message }),
                      });
                      const data = await res.json();
                      if (res.ok) {
                        setToastMsg(data.message);
                        setToastType('success');
                        setTimeout(() => setToastMsg(''), 3000);
                        document.getElementById('maint-title').value = '';
                        document.getElementById('maint-message').value = '';
                      } else {
                        setToastMsg(data.error || t('Failed to send.'));
                        setToastType('error');
                        setTimeout(() => setToastMsg(''), 3000);
                      }
                    } catch {
                      setToastMsg(t('Network error. Is the server running?'));
                      setToastType('error');
                      setTimeout(() => setToastMsg(''), 3000);
                    }
                  }} style={{ padding: '10px 20px', background: '#d97706', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '17px', fontWeight: '600', cursor: 'pointer', alignSelf: 'flex-start' }}>
                    {t('Send Notice')}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── SYSTEM PREFERENCES VIEW ── */}
        {currentView === 'system' && (
          <div className="detail-view-container security-view-view">
            <BackButton onClick={() => {
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
            }}>Back to Settings</BackButton>

            <div className="security-section-card">
              <div className="security-card-header">
                <div className="security-icon-box">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="#9333EA"><path d="m15.988,11.726c.158,1.78-1.24,3.274-2.988,3.274h-3.978c-.691,0-1.181-.666-.975-1.325.502-1.609,1.936-4.165,4.24-4.608,1.755-.338,3.542.879,3.7,2.659Zm.034-3.662c.74.558,1.279,1.309,1.611,2.141l5.659-6.085c.943-.942.945-2.47.003-3.413-.941-.942-2.467-.943-3.409-.002-.032.032-5.573,6.513-5.573,6.513.609.175,1.191.456,1.708.846Zm.667,7.312c-.944,1.032-2.289,1.625-3.688,1.625h-3.978c-.958,0-1.868-.46-2.435-1.23s-.735-1.776-.45-2.69c.729-2.332,2.621-5.229,5.565-5.915l4.388-5.164H5C2.243,2,0,4.243,0,7v8c0,2.757,2.243,5,5,5h6v2h-3c-.552,0-1,.447-1,1s.448,1,1,1h8c.553,0,1-.447,1-1s-.447-1-1-1h-3v-2h6c2.757,0,5-2.243,5-5V6.285l-6.091,6.546c-.16.94-.568,1.83-1.22,2.543Z"/></svg>
                </div>
                <div className="security-header-text">
                  <h3>{t('Appearance')}</h3>
                  <span className="security-timestamp">{t('Customize how the system looks')}</span>
                </div>
              </div>
              <div className="security-sessions-container">
                <div className="session-list-row">
                    <div className="session-info-meta"><h4>{t('Dark Mode')}</h4><p>{t('Switch between light and dark theme')}</p></div>
                    <label className="figma-toggle-switch">
                      <input type="checkbox" checked={theme === 'dark'} onChange={() => toggleTheme()} />
                      <span className="figma-slider" />
                    </label>
                </div>
                <div className="session-list-row">
                  <div className="session-info-meta"><h4>{t('Font Size')}</h4><p>{t('Adjust text size for better readability')}</p></div>
                  <div style={{ position: 'relative' }}>
                    <select value={systemPrefs.fontSize} onChange={e => {
                      const label = e.target.value;
                      const scale = label === 'Small' ? '0.9' : label === 'Large' ? '1.15' : '1';
                      setSystemPrefs({ ...systemPrefs, fontSize: label });
                      if (onFontSizeChange) onFontSizeChange(scale);
                    }}
                      style={{ background: 'var(--input-bg)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '8px 36px 8px 14px', fontSize: '17px', cursor: 'pointer', appearance: 'none', color: 'var(--text-main)', minWidth: '120px' }}>
                      <option value="Small">{t('Small')}</option><option value="Medium">{t('Medium')}</option><option value="Large">{t('Large')}</option>
                    </select>
                    <span style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-muted)', fontSize: '17px' }}>▼</span>
                  </div>
                </div>
                <div className="session-list-row">
                  <div className="session-info-meta"><h4>{t('Compact View')}</h4><p>{t('Show more content with less spacing')}</p></div>
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
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="#0D9488"><path d="M24,7v2c0,.552-.448,1-1,1s-1-.448-1-1v-2c0-1.103-.897-2-2-2h-2.029l1.25,1.307c.383,.398,.371,1.031-.028,1.414-.194,.187-.443,.279-.693,.279-.262,0-.524-.103-.721-.307l-2.212-2.301c-.761-.761-.761-2.023,.013-2.798L17.779,.307c.383-.398,1.017-.41,1.414-.028,.398,.383,.411,1.016,.028,1.414l-1.257,1.307h2.036c2.206,0,4,1.794,4,4ZM6.221,16.307c-.383-.398-1.016-.409-1.414-.027-.398,.383-.411,1.016-.028,1.414l1.25,1.307h-2.029c-1.103,0-2-.897-2-2v-2c0-.553-.448-1-1-1s-1,.447-1,1v2c0,2.206,1.794,4,4,4h2.035l-1.256,1.307c-.383,.398-.371,1.031,.028,1.414,.194,.187,.443,.279,.693,.279,.262,0,.524-.103,.721-.307l2.199-2.288c.773-.774,.773-2.036,.013-2.798l-2.212-2.301Zm5.779-8.307c0,2.209-1.791,4-4,4H4c-2.209,0-4-1.791-4-4V4C0,1.791,1.791,0,4,0h4c2.209,0,4,1.791,4,4v4Zm-2.5-4.384c0-.34-.276-.616-.616-.616h-2.257v-.384c0-.34-.276-.616-.616-.616h-.021c-.34,0-.616,.276-.616,.616v.384H3.116c-.34,0-.616,.276-.616,.616v.021c0,.34,.276,.616,.616,.616H7.308c-.111,.963-.484,2.151-1.303,3.071-.276-.31-.507-.648-.692-1-.106-.202-.318-.325-.545-.325-.464,0-.769,.492-.553,.903,.225,.43,.501,.843,.83,1.22-.539,.328-1.189,.559-1.977,.635-.32,.031-.568,.293-.568,.614v.021c0,.365,.316,.648,.679,.614,1.146-.107,2.079-.485,2.832-1.022,.749,.533,1.671,.913,2.808,1.022,.364,.035,.68-.248,.68-.613v-.021c0-.316-.24-.583-.555-.613-.792-.075-1.442-.31-1.984-.639,.99-1.135,1.485-2.591,1.607-3.866h.316c.34,0,.616-.276,.616-.616v-.021ZM24,16v4c0,2.209-1.791,4-4,4h-4c-2.209,0-4-1.791-4-4v-4c0-2.209,1.791-4,4-4h4c2.209,0,4,1.791,4,4Zm-3.196,5.144l-1.363-5.948c-.107-.464-.403-.886-.842-1.07-.919-.385-1.855,.155-2.056,1.021l-1.413,5.993c-.104,.439,.23,.86,.681,.86h0c.324,0,.606-.223,.681-.539l.274-1.161h2.409l.265,1.157c.073,.318,.356,.543,.682,.543h.002c.449,0,.782-.418,.682-.856Zm-2.818-5.744c-.038,0-.071,.026-.079,.063l-.811,3.437h1.757l-.787-3.437c-.009-.037-.041-.063-.079-.063Z"/></svg>
                </div>
                <div className="security-header-text">
                  <h3>{t('Language & Region')}</h3>
                  <span className="security-timestamp">{t('Set your preferred language')}</span>
                </div>
              </div>
              <div className="security-sessions-container">
                <div className="session-list-row">
                  <div className="session-info-meta"><h4>{t('Display Language')}</h4></div>
                  <div style={{ position: 'relative' }}>
                      <select value={systemPrefs.displayLanguage} onChange={e => setSystemPrefs({ ...systemPrefs, displayLanguage: e.target.value })}
                        style={{ background: 'var(--input-bg)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '8px 36px 8px 14px', fontSize: '17px', cursor: 'pointer', appearance: 'none', color: 'var(--text-main)', minWidth: '120px' }}>
                        <option>English</option>
                        <option>Filipino</option>
                      </select>
                    <span style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-muted)', fontSize: '17px' }}>▼</span>
                  </div>
                </div>
                <div className="session-list-row">
                  <div className="session-info-meta"><h4>{t('Date Format')}</h4></div>
                  <div style={{ position: 'relative' }}>
                      <select value={systemPrefs.dateFormat} onChange={e => setSystemPrefs({ ...systemPrefs, dateFormat: e.target.value })}
                        style={{ background: 'var(--input-bg)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '8px 36px 8px 14px', fontSize: '17px', cursor: 'pointer', appearance: 'none', color: 'var(--text-main)', minWidth: '120px' }}>
                        <option>MM/DD/YY</option>
                        <option>DD/MM/YY</option>
                        <option>YYYY-MM-DD</option>
                      </select>
                    <span style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-muted)', fontSize: '17px' }}>▼</span>
                  </div>
                </div>
              </div>
            </div>

            {/* ── System Behavior ── */}
            <div className="security-section-card">
              <div className="security-card-header">
                <div className="security-icon-box">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="#8B5CF6"><path d="m23.265 8.379-.983-.567c.129-.418.218-.853.218-1.313s-.09-.895-.218-1.313l.983-.567c.479-.275.643-.887.367-1.366-.276-.478-.886-.643-1.366-.367l-.977.563c-.605-.652-1.393-1.126-2.289-1.33v-1.121c0-.552-.448-1-1-1s-1 .448-1 1v1.121c-.896.205-1.685.678-2.289 1.33l-.977-.563c-.48-.276-1.09-.112-1.366.367s-.112 1.09.367 1.366l.983.567c-.129.418-.218.853-.218 1.313s.09.895.218 1.313l-.983.567c-.479.275-.643.887-.367 1.366.277.482.895.64 1.366.367l.977-.563c.605.652 1.393 1.126 2.289 1.33v1.121c0 .552.448 1 1 1s1-.448 1-1v-1.121c.896-.205 1.685-.678 2.289-1.33l.977.563c.47.273 1.088.116 1.366-.367.276-.479.112-1.09-.367-1.366zm-5.265-.379c-.827 0-1.5-.673-1.5-1.5s.673-1.5 1.5-1.5 1.5.673 1.5 1.5-.673 1.5-1.5 1.5zm6 4.52v2.48c0 2.757-2.243 5-5 5h-6v2h4c.552 0 1 .448 1 1s-.448 1-1 1h-10c-.552 0-1-.448-1-1s.448-1 1-1h4v-2h-6c-2.757 0-5-2.243-5-5v-8c0-2.757 2.243-5 5-5h5.798c-.818 1.306-1.298 2.845-1.298 4.5 0 4.694 3.806 8.5 8.5 8.5 2.342 0 4.463-.948 6-2.48z"/></svg>
                </div>
                <div className="security-header-text">
                  <h3>{t('System Behavior')}</h3>
                  <span className="security-timestamp">{t('Configure how the system behaves')}</span>
                </div>
              </div>
              <div className="security-sessions-container">
                <div className="session-list-row">
                  <div className="session-info-meta"><h4>{t('Auto-Save')}</h4><p>{t('Automatically save changes while editing')}</p></div>
                  <label className="figma-toggle-switch">
                    <input type="checkbox" checked={systemPrefs.autoSave} onChange={e => setSystemPrefs({ ...systemPrefs, autoSave: e.target.checked })} />
                    <span className="figma-slider" />
                  </label>
                </div>
                <div className="session-list-row">
                  <div className="session-info-meta"><h4>{t('Confirm Before Delete')}</h4><p>{t('Show confirmation dialog before deleting items')}</p></div>
                  <label className="figma-toggle-switch">
                    <input type="checkbox" checked={systemPrefs.confirmDelete} onChange={e => { const val = e.target.checked; setSystemPrefs(prev => ({ ...prev, confirmDelete: val })); if (onConfirmDeleteChange) onConfirmDeleteChange(val); }} />
                    <span className="figma-slider" />
                  </label>
                </div>
                <div className="session-list-row">
                  <div className="session-info-meta"><h4>{t('Keyboard Shortcuts')}</h4><p>{t('Enable keyboard shortcuts for quick actions')}</p></div>
                  <label className="figma-toggle-switch">
                    <input type="checkbox" checked={systemPrefs.keyboardShortcuts} onChange={e => setSystemPrefs({ ...systemPrefs, keyboardShortcuts: e.target.checked })} />
                    <span className="figma-slider" />
                  </label>
                </div>
                {systemPrefs.keyboardShortcuts && (
                  <>
                  <div className="session-list-row">
                    <div className="session-info-meta"><h4>{t('Save Form Shortcut')}</h4><p>{t('Press to save the case form')}</p></div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '15px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        <input type="checkbox" checked={!!shortcuts.saveCtrl} onChange={e => saveShortcuts({ ...shortcuts, saveCtrl: e.target.checked })} />Ctrl
                      </label>
                      <input type="text" maxLength={1} value={String(shortcuts.save || '').toUpperCase()}
                        onChange={e => {
                          const ch = (e.target.value || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 1).toLowerCase();
                          if (ch || e.target.value === '') saveShortcuts({ ...shortcuts, save: ch });
                        }}
                        style={{ width: '64px', textAlign: 'center', background: 'var(--input-bg)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '8px 12px', fontSize: '17px', color: 'var(--text-main)', textTransform: 'uppercase' }} />
                    </div>
                  </div>
                  <div className="session-list-row">
                    <div className="session-info-meta"><h4>{t('New Case Shortcut')}</h4><p>{t('Open the Add Case form from the list')}</p></div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '15px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        <input type="checkbox" checked={!!shortcuts.newCaseCtrl} onChange={e => saveShortcuts({ ...shortcuts, newCaseCtrl: e.target.checked })} />Ctrl
                      </label>
                      <input type="text" maxLength={1} value={String(shortcuts.newCase || '').toUpperCase()}
                        onChange={e => {
                          const ch = (e.target.value || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 1).toLowerCase();
                          if (ch || e.target.value === '') saveShortcuts({ ...shortcuts, newCase: ch });
                        }}
                        style={{ width: '64px', textAlign: 'center', background: 'var(--input-bg)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '8px 12px', fontSize: '17px', color: 'var(--text-main)', textTransform: 'uppercase' }} />
                      <button onClick={resetShortcuts} style={{ background: 'transparent', border: 'none', color: '#3B82F6', cursor: 'pointer', fontSize: '15px', fontWeight: '600', whiteSpace: 'nowrap' }}>{t('Reset')}</button>
                    </div>
                  </div>
                  </>
                )}
              </div>
            </div>

            <div className="notifications-action-container">
              {systemPrefsSaveMsg && <span style={{ fontSize: '17px', color: 'var(--text-muted)', marginRight: '12px' }}>{systemPrefsSaveMsg}</span>}
              <button className="notifications-save-btn" onClick={() => {
                setSystemPrefsSnapshot(takeSystemSnapshot());
                setSystemPrefsSaveMsg(t('Preferences saved!'));
                setTimeout(() => setCurrentView('menu'), 1200);
              }}>{t('Save Preferences')}</button>
            </div>
          </div>
        )}

        {/* ── DATA MANAGEMENT VIEW ── */}
        {currentView === 'data' && (
          <div className="detail-view-container security-view-view">
            <BackButton onClick={() => setCurrentView('menu')}>Back to Settings</BackButton>

            {/* Storage Overview */}
            <div className="security-section-card">
              <div className="security-card-header">
                <div className="security-icon-box">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="#0891B2"><path d="m22.5 18c0-.46-.089-.895-.218-1.312l1.417-.816-.999-1.732-1.41.813c-.605-.652-1.393-1.126-2.289-1.331v-1.621h-2v1.621c-.896.205-1.685.678-2.289 1.331l-1.41-.813-.999 1.732 1.417.816c-.129.418-.218.853-.218 1.312s.089.895.218 1.312l-1.417.816.999 1.732 1.41-.813c.605.652 1.393 1.126 2.289 1.331v1.621h2v-1.621c.896-.205 1.685-.678 2.289-1.331l1.41.813.999-1.732-1.417-.816c.129-.418.218-.853.218-1.312zm-4.5 1.5c-.827 0-1.5-.673-1.5-1.5s.673-1.5 1.5-1.5 1.5.673 1.5 1.5-.673 1.5-1.5 1.5zm-18-8.933v-2.167c1.876 1.596 4.92 2.6 8.5 2.6s6.624-1.004 8.5-2.6v1.669c-2.455.307-4.559 1.724-5.802 3.735-.841.124-1.745.196-2.698.196-4.865 0-8.5-1.812-8.5-3.433zm0-6.067c0-2.485 3.806-4.5 8.5-4.5s8.5 2.015 8.5 4.5-3.806 4.5-8.5 4.5-8.5-2.015-8.5-4.5zm0 11.066v-1.74c1.876 1.334 4.92 2.174 8.5 2.174.614 0 1.204-.033 1.783-.081-.179.665-.283 1.36-.283 2.081 0 .316.023.627.059.933-.504.041-1.022.067-1.559.067-4.865 0-8.5-1.812-8.5-3.434zm10.549 5.329c.395 1.016.987 1.932 1.736 2.697-1.183.27-2.485.408-3.784.408-4.224 0-8.5-1.447-8.5-4.214v-.96c1.876 1.334 4.92 2.174 8.5 2.174.708 0 1.387-.042 2.049-.105z"/></svg>
                </div>
                <div className="security-header-text">
                  <h3>{t('Storage Overview')}</h3>
                  <span className="security-timestamp">{t('Manage your data storage')}</span>
                </div>
              </div>
              <div style={{ padding: '0 16px 20px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '17px', marginBottom: '8px', color: 'var(--text-muted)', fontWeight: '500' }}>
                  <span>{t('Storage Used')}</span>
                  <span style={{ color: 'var(--text-main)', fontWeight: '600' }}>{storageLoading ? t('Loading...') : storageStats ? `${storageStats.totalMB} MB ${t('of ')}10 GB` : `${t('- of ')}10 GB`}</span>
                </div>
                <div style={{ width: '100%', height: '12px', background: 'var(--border-color)', borderRadius: '6px', overflow: 'hidden', marginBottom: '24px' }}>
                  <div style={{ width: `${storageStats ? storageStats.usedPercent : 0}%`, height: '100%', background: 'var(--text-main)', borderRadius: '6px' }} />
                </div>
                <div className="cdms-storage-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                  {[
                    { val: storageStats ? `${storageStats.caseDataMB} MB` : '-', lbl: 'Case Data', sub: `${storageStats ? storageStats.cases : '-'} records` },
                    { val: storageStats ? `${storageStats.userDataMB} MB` : '-', lbl: 'Reports', sub: `${storageStats ? storageStats.users : '-'} accounts` },
                    { val: storageStats ? `${storageStats.otherMB} MB` : '-', lbl: 'Other', sub: `${storageStats ? storageStats.notifications : '-'} notifications` },
                  ].map(item => (
                    <div key={item.lbl} style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
                      <div style={{ fontSize: '22px', fontWeight: '600', color: 'var(--text-main)', marginBottom: '4px' }}>{item.val}</div>
                      <div style={{ fontSize: '17px', color: 'var(--text-muted)' }}>{t(item.lbl)}</div>
                      <div style={{ fontSize: '17px', color: 'var(--text-muted)', marginTop: '2px' }}>{item.sub.includes('records') ? `${storageStats ? storageStats.cases : '-'}${t(' records')}` : item.sub.includes('accounts') ? `${storageStats ? storageStats.users : '-'}${t(' accounts')}` : `${storageStats ? storageStats.notifications : '-'}${t(' notifications')}`}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Export Data */}
            <div className="security-section-card">
              <div className="security-card-header">
                <div className="security-icon-box">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="#129968"><path d="M23.13,18.09l-1.61,1.61c-.2,.2-.45,.29-.71,.29s-.51-.1-.71-.29c-.39-.39-.39-1.02,0-1.41l1.29-1.29h-7.4c-.55,0-1-.45-1-1s.45-1,1-1h7.4l-1.29-1.29c-.39-.39-.39-1.02,0-1.41s1.02-.39,1.41,0l1.61,1.61c1.15,1.15,1.15,3.03,0,4.19ZM13,8h6.54c-.35-.91-.88-1.75-1.59-2.46l-3.48-3.49c-.71-.71-1.55-1.24-2.46-1.59V7c0,.55,.45,1,1,1Zm4.81,11h-3.81c-1.65,0-3-1.35-3-3s1.35-3,3-3h3.81c0-.77,.29-1.54,.88-2.12,.37-.37,.82-.63,1.29-.76v-.12h-6.98c-1.65,0-3-1.35-3-3V.02c-.16-.01-.32-.02-.49-.02H5C2.24,0,0,2.24,0,5v14c0,2.76,2.24,5,5,5H15c1.81,0,3.4-.97,4.28-2.42-.21-.13-.41-.28-.59-.46-.58-.58-.88-1.35-.88-2.12Z"/></svg>
                </div>
                <div className="security-header-text">
                  <h3>{t('Export Data')}</h3>
                  <span className="security-timestamp">{t('Download your data in various formats')}</span>
                </div>
              </div>
              <div className="security-sessions-container">
                {[
                  { label: 'Export as PDF', sub: 'Download all data as PDF documents', color: '#dc2626', icon: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6' },
                  { label: 'Export as Excel', sub: 'Download data as Excel spreadsheet', color: '#129968', icon: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6' },
                  { label: 'Export as CSV', sub: 'Download data as CSV file', color: '#2563eb', icon: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6' },
                ].map(row => (
                  <div key={row.label} className="session-list-row">
                    <div className="session-info-meta" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={row.color} strokeWidth="2">
                        <path d={row.icon} />
                      </svg>
                      <div>
                        <h4>{t(row.label)}</h4>
                        <p>{t(row.sub)}</p>
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
                          timestamp: formatDateTime(l.created_at, systemPrefs.dateFormat),
                          userName: l.user_name || '',
                          userRole: l.user_role || '',
                          action: l.action || '',
                          entity: l.entity || '',
                          details: l.details || '',
                        }));
                        const stamp = new Date().toISOString().split('T')[0];

                        if (row.label === 'Export as PDF') {
                          const caseRows = cases.map(c =>
                            `<tr><td>${c.case_id}</td><td>${c.patient_name||''}</td><td>${c.age||''}</td><td>${c.gender||''}</td><td>${c.barangay_name||''}</td><td>${c.disease_name||''}</td><td>${c.severity||''}</td><td>${translateStatus(c.status)||''}</td><td>${c.vaccination_status||''}</td><td>${c.vaccine_expiry_date||''}</td><td>${formatDate(c.date_reported, systemPrefs.dateFormat)}</td></tr>`
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
                          <button class="print-btn" onclick="window.print();">🖨️ ${t('Print / Save as PDF')}</button>
                          <h2>Cabuyao CDMS - Full Data Export</h2>
                          <p class="meta">Generated: ${formatDateTime(new Date(), systemPrefs.dateFormat)} &nbsp;|&nbsp; ${cases.length} Cases, ${users.length} Users</p>
                          <h3>Case Records (${cases.length})</h3>
                          <table><thead><tr><th>ID</th><th>Patient Name</th><th>Age</th><th>Gender</th><th>Barangay</th><th>Disease</th><th>Severity</th><th>Status</th><th>Vaccination</th><th>Vaccine Expiry</th><th>Date Reported</th></tr></thead><tbody>${caseRows}</tbody></table>
                          <h3>User Accounts (${users.length})</h3>
                          <table><thead><tr><th>User ID</th><th>Full Name</th><th>Username</th><th>Role</th><th>Barangay</th><th>Status</th><th>Email</th></tr></thead><tbody>${userRows}</tbody></table>
                          <h3>System Activity Log</h3>
                          <div class="note">For detailed audit logs, please export from the Audit Reports section.</div>
                          </body></html>`;
                          setPreview({
                            title: t('Preview: PDF Document'),
                            html,
                            actions: [{
                              label: `🖨 ${t('Print / Save as PDF')}`,
                              primary: true,
                              onClick: () => openPrint(html),
                            }],
                          });
                        } else if (row.label === 'Export as Excel') {
                          const sep = '\t';
                          const nl = '\n';
                          let content = '';
                          content += '=== CASE RECORDS ===' + nl;
                          content += 'Case ID' + sep + 'Patient Name' + sep + 'Age' + sep + 'Barangay' + sep + 'Disease' + sep + 'Severity' + sep + 'Status' + sep + 'Vaccination' + sep + 'Vaccine Expiry' + sep + 'Date Reported' + nl;
                          cases.forEach(c => { content += `${c.case_id}${sep}${c.patient_name||''}${sep}${c.age||''}${sep}${c.barangay_name||''}${sep}${c.disease_name||''}${sep}${c.severity||''}${sep}${translateStatus(c.status)||''}${sep}${c.vaccination_status||''}${sep}${c.vaccine_expiry_date||''}${sep}${c.date_reported||''}${nl}`; });
                          content += nl + '=== USER ACCOUNTS ===' + nl;
                          content += 'ID' + sep + 'Name' + sep + 'Username' + sep + 'Barangay' + sep + 'Role' + sep + 'Status' + nl;
                          users.forEach(u => { content += `U-${String(u.user_id).padStart(3,'0')}${sep}${u.full_name||''}${sep}${u.username||''}${sep}${u.barangay_name||''}${sep}${u.role||''}${sep}${u.is_active?'Active':'Inactive'}${nl}`; });
                          content += nl + '=== SYSTEM LOGS ===' + nl;
                          content += '#' + sep + 'Timestamp' + sep + 'User' + sep + 'Role' + sep + 'Action' + sep + 'Entity' + sep + 'Details' + nl;
                          logs.forEach(l => { content += `${l.id}${sep}${l.timestamp}${sep}${l.userName}${sep}${l.userRole}${sep}${l.action}${sep}${l.entity}${sep}${l.details}${nl}`; });
                          const columns = [t('Case ID'), t('Patient Name'), t('Age'), t('Barangay'), t('Disease'), t('Severity'), t('Status'), t('Vaccination'), t('Vaccine Expiry'), t('Date Reported')];
                          const previewRows = cases.map(c => [c.case_id, c.patient_name||'', c.age||'', c.barangay_name||'', c.disease_name||'', c.severity||'', translateStatus(c.status)||'', c.vaccination_status||'', c.vaccine_expiry_date||'', c.date_reported||'']);
                          setPreview({
                            title: t('Preview: Excel Export'),
                            columns,
                            rows: previewRows,
                            actions: [{
                              label: `⬇ ${t('Download Excel (.xls)')}`,
                              primary: true,
                              onClick: () => {
                                downloadBlob(new Blob([content], { type: 'application/vnd.ms-excel' }), `CDMS_Export_${stamp}.xls`);
                                setPreview(null);
                              },
                            }],
                          });
                        } else if (row.label === 'Export as CSV') {
                          const sep = ',';
                          const nl = '\n';
                          let content = '';
                          content += '=== CASE RECORDS ===' + nl;
                          content += 'Case ID' + sep + 'Patient Name' + sep + 'Age' + sep + 'Barangay' + sep + 'Disease' + sep + 'Severity' + sep + 'Status' + sep + 'Vaccination' + sep + 'Vaccine Expiry' + sep + 'Date Reported' + nl;
                          cases.forEach(c => { content += `${c.case_id}${sep}${c.patient_name||''}${sep}${c.age||''}${sep}${c.barangay_name||''}${sep}${c.disease_name||''}${sep}${c.severity||''}${sep}${c.status||''}${sep}${c.vaccination_status||''}${sep}${c.vaccine_expiry_date||''}${sep}${c.date_reported||''}${nl}`; });
                          content += nl + '=== USER ACCOUNTS ===' + nl;
                          content += 'ID' + sep + 'Name' + sep + 'Username' + sep + 'Barangay' + sep + 'Role' + sep + 'Status' + nl;
                          users.forEach(u => { content += `U-${String(u.user_id).padStart(3,'0')}${sep}${u.full_name||''}${sep}${u.username||''}${sep}${u.barangay_name||''}${sep}${u.role||''}${sep}${u.is_active?'Active':'Inactive'}${nl}`; });
                          content += nl + '=== SYSTEM LOGS ===' + nl;
                          content += '#' + sep + 'Timestamp' + sep + 'User' + sep + 'Role' + sep + 'Action' + sep + 'Entity' + sep + 'Details' + nl;
                          logs.forEach(l => { content += `${l.id}${sep}${l.timestamp}${sep}${l.userName}${sep}${l.userRole}${sep}${l.action}${sep}${l.entity}${sep}${l.details}${nl}`; });
                          const columns = [t('Case ID'), t('Patient Name'), t('Age'), t('Barangay'), t('Disease'), t('Severity'), t('Status'), t('Vaccination'), t('Vaccine Expiry'), t('Date Reported')];
                          const previewRows = cases.map(c => [c.case_id, c.patient_name||'', c.age||'', c.barangay_name||'', c.disease_name||'', c.severity||'', c.status||'', c.vaccination_status||'', c.vaccine_expiry_date||'', c.date_reported||'']);
                          setPreview({
                            title: t('Preview: CSV Export'),
                            columns,
                            rows: previewRows,
                            actions: [{
                              label: `⬇ ${t('Download CSV (.csv)')}`,
                              primary: true,
                              onClick: () => {
                                downloadBlob(new Blob([content], { type: 'text/csv;charset=utf-8;' }), `CDMS_Export_${stamp}.csv`);
                                setPreview(null);
                              },
                            }],
                          });
                        }
                      } catch (err) {
                        setToastMsg(t('Export failed. Please try again.'));
                        setToastType('error');
                        setTimeout(() => setToastMsg(''), 3000);
                      }
                    }} style={{ ...offlineBtnStyle, padding: '8px 18px', background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '17px', fontWeight: '600', color: 'var(--text-main)', cursor: 'pointer' }} disabled={offlineMode} title={offlineMode ? t('Unavailable offline') : ''}>
                      {t('Export')}
                    </button>
                  </div>
                ))}
              </div>
            </div>

              {/* Backup & Restore */}
              <div className="security-section-card">
                <div className="security-card-header">
                  <div className="security-icon-box">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="#0D9488"><path d="m8.5,16c3.58,0,6.624-.839,8.5-2.173v1.74c0,1.621-3.635,3.434-8.5,3.434S0,17.188,0,15.566v-1.74c1.876,1.334,4.92,2.174,8.5,2.174ZM0,18.826v.96c0,2.767,4.276,4.214,8.5,4.214s8.5-1.447,8.5-4.214v-.96c-1.876,1.334-4.92,2.174-8.5,2.174s-6.624-.839-8.5-2.174ZM22,0v1.534c-1.078-.97-2.482-1.534-4-1.534-2.967,0-5.431,2.167-5.91,5h2.052c.447-1.72,1.999-3,3.858-3,1,0,1.928.367,2.644,1h-1.644v2h5V0h-2Zm-4,10c-.994,0-1.929-.368-2.646-1h1.646v-2h-5v5h2v-1.531c1.08.966,2.494,1.531,4,1.531,2.967,0,5.431-2.167,5.91-5h-2.052c-.447,1.72-1.999,3-3.858,3Zm-9.5-1c.513,0,1.012-.028,1.5-.074v-2.926c0-2.151.854-4.1,2.235-5.538-1.128-.293-2.393-.462-3.735-.462C3.806,0,0,2.015,0,4.5s3.806,4.5,8.5,4.5Zm0,5c.516,0,1.015-.024,1.5-.063v-3.003c-.489.04-.987.066-1.5.066-3.58,0-6.624-1.004-8.5-2.6v2.167c0,1.621,3.635,3.433,8.5,3.433Z"/></svg>
                  </div>
                  <div className="security-header-text">
                    <h3>{t('Backup & Restore')}</h3>
                    <span className="security-timestamp">{t('Manage data backups')}</span>
                  </div>
                </div>

                <div style={{ padding: '0 0 16px 0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderTop: '1px solid var(--border-color)' }}>
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontSize: '17px', fontWeight: '600', color: 'var(--text-main)' }}>{t('Last Backup')}</div>
                      <div style={{ fontSize: '17px', color: 'var(--text-muted)' }}>{lastBackupDate ? formatDateTime(lastBackupDate, systemPrefs.dateFormat) : t('No backup yet')}</div>
                    </div>
                    {lastBackupDate
                      ? <span style={{ fontSize: '17px', fontWeight: '600', padding: '4px 12px', borderRadius: '16px', background: 'var(--input-bg)', color: '#027a48' }}>{t('Successful')}</span>
                      : <span style={{ fontSize: '17px', color: 'var(--text-muted)' }}>{t('Never')}</span>
                    }
                  </div>

                  <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                    <button onClick={() => handleCreateBackup(false)} disabled={backupLoading || offlineMode} style={{ ...offlineBtnStyle, flex: 1, padding: '12px', background: '#003cb4', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '17px', fontWeight: '600', cursor: backupLoading || offlineMode ? 'not-allowed' : 'pointer', opacity: backupLoading ? 0.7 : offlineBtnStyle.opacity || 1 }} title={offlineMode ? t('Unavailable offline') : ''}>
                      {backupLoading ? t('Creating Backup...') : t('Create Backup')}
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
                            method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify(data),
                          });
                          if (!previewRes.ok) throw new Error('Invalid backup file');
                          const preview = await previewRes.json();
                          const confirmed = window.confirm(
                            `${t('Restore backup from ')}${formatDate(preview.backup_date, systemPrefs.dateFormat)}?\n\n` +
                            `${t('Will restore')}:\n` +
                            `• ${preview.counts.disease_cases}${t(' disease cases')}\n` +
                            `• ${preview.counts.users}${t(' users')}\n` +
                            `• ${preview.counts.barangays}${t(' barangays')}\n` +
                            `• ${preview.counts.diseases}${t(' diseases')}\n\n` +
                            t('Existing records with the same ID will be skipped. Continue?')
                          );
                          if (!confirmed) { setRestoreLoading(false); return; }
                          const res = await fetch(`${API_URL}/api/restore`, {
                            method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify(data),
                          });
                          if (!res.ok) throw new Error((await res.json()).error || t('Restore failed'));
                          setRestoreMsg(t('✅ Restore completed successfully!'));
                          setTimeout(() => setRestoreMsg(''), 3000);
                        } catch (err) {
                          setRestoreError(t('❌ ') + (err.message || t('Restore failed. Check the file format.')));
                          setTimeout(() => setRestoreError(''), 4000);
                        } finally {
                          setRestoreLoading(false);
                          e.target.value = '';
                        }
                      }} />
                    <button onClick={() => restoreInputRef.current?.click()} disabled={restoreLoading || offlineMode} style={{ ...offlineBtnStyle, flex: 1, padding: '12px', background: restoreLoading ? '#64748b' : 'var(--bg-surface)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '17px', fontWeight: '600', cursor: restoreLoading || offlineMode ? 'not-allowed' : 'pointer' }} title={offlineMode ? t('Unavailable offline') : ''}>
                      {restoreLoading ? t('Restoring...') : t('Restore')}
                    </button>
                  </div>

                  {restoreMsg && (
                    <div style={{ marginTop: '8px', padding: '8px 14px', borderRadius: '8px', fontSize: '17px', fontWeight: '500', background: 'var(--input-bg)', color: 'var(--success-text)' }}>
                      {restoreMsg}
                    </div>
                  )}
                  {restoreError && (
                    <div style={{ marginTop: '8px', padding: '8px 14px', borderRadius: '8px', fontSize: '17px', fontWeight: '500', background: 'var(--input-bg)', color: 'var(--warning-text)' }}>
                      {restoreError}
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 0 0 0', marginTop: '12px', borderTop: '1px solid var(--border-color)' }}>
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontSize: '17px', fontWeight: '600', color: 'var(--text-main)' }}>{t('Auto-Backup')}</div>
                      <div style={{ fontSize: '17px', color: 'var(--text-muted)' }}>{t('Automatically backup data weekly')}</div>
                    </div>
                    <label className="figma-toggle-switch">
                      <input type="checkbox" checked={autoBackupEnabled} onChange={e => { setAutoBackupEnabled(e.target.checked); localStorage.setItem('cdms_auto_backup', String(e.target.checked)); }} />
                      <span className="figma-slider" />
                    </label>
                  </div>
                </div>
              </div>

              {/* Sync History */}
              <div className="security-section-card" style={{ borderColor: 'var(--border-color)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(18,153,104,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="#2563EB"><path d="M0,7v-3c0-.552,.448-1,1-1s1,.448,1,1v1.412C4.21,2.067,7.966,0,12,0c6.253,0,11.391,4.69,11.951,10.91,.05,.55-.356,1.036-.906,1.086-.03,.002-.061,.004-.091,.004-.512,0-.948-.391-.995-.91-.467-5.182-4.748-9.09-9.959-9.09-3.559,0-6.878,1.916-8.662,5h1.662c.552,0,1,.448,1,1s-.448,1-1,1H2c-1.103,0-2-.897-2-2ZM22,15h-3c-.553,0-1,.447-1,1s.447,1,1,1h1.662c-1.785,3.084-5.104,5-8.662,5-5.21,0-9.492-3.908-9.959-9.09-.049-.549-.523-.944-1.086-.906C.405,12.054,0,12.54,.049,13.09c.561,6.22,5.699,10.91,11.951,10.91,4.033,0,7.79-2.068,10-5.413v1.413c0,.553,.447,1,1,1s1-.447,1-1v-3c0-1.103-.897-2-2-2ZM14,7c1.105,0,2,.895,2,2v6c0,1.105-.895,2-2,2h-4c-1.105,0-2-.895-2-2v-6c0-1.105,.895-2,2-2h4Zm-1,7c0-.552-.448-1-1-1h-1c-.552,0-1,.448-1,1s.448,1,1,1h1c.552,0,1-.448,1-1Zm1-4c0-.552-.448-1-1-1h-2c-.552,0-1,.448-1,1s.448,1,1,1h2c.552,0,1-.448,1-1Z"/></svg>
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '700', color: 'var(--text-main)' }}>{t('Offline Sync')}</h3>
                    <span style={{ fontSize: '17px', color: 'var(--text-muted)' }}>{t('View offline operation queue and sync history')}</span>
                  </div>
                </div>

                <OfflineSyncPanel dateFormat={systemPrefs.dateFormat} />
              </div>
              </div>
            )}
          </div>
      <ExportPreviewModal preview={preview} onClose={() => setPreview(null)} />
    </div>
  );
}

const fieldStyle = {
  background: 'var(--input-bg)', border: '1px solid var(--border-color)', borderRadius: '12px',
  padding: '12px 16px', fontSize: '17px', color: 'var(--text-main)',
  boxShadow: '0 2px 4px rgba(0,0,0,0.02)', outline: 'none', width: '100%',
  boxSizing: 'border-box',
};