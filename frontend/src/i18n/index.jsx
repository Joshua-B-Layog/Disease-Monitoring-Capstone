import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { dictionaries, CASE_STATUSES, langNames } from './dictionaries';

const I18nContext = createContext(null);

const STORAGE_KEYS = {
  app: 'cdms_language',
  resident: 'cdms_resident_lang',
};

export function I18nProvider({ children, scope = 'app' }) {
  const storageKey = STORAGE_KEYS[scope] || STORAGE_KEYS.app;
  const [lang, setLangState] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved && dictionaries[saved] ? saved : 'en';
    } catch {
      return 'en';
    }
  });

  const setLang = useCallback((code) => {
    if (!dictionaries[code]) return;
    setLangState(code);
    try {
      localStorage.setItem(storageKey, code);
    } catch { /* ignore */ }
  }, [storageKey]);

  const t = useCallback((key, vars) => {
    let text = dictionaries[lang]?.[key] ?? key;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        text = text.split(`{${k}}`).join(String(v ?? ''));
      }
    }
    return text;
  }, [lang]);

  const translateStatus = useCallback((status) => {
    const s = (status || '').toLowerCase();
    const match = CASE_STATUSES.find(c => c.toLowerCase() === s);
    if (!match) return status;
    return dictionaries[lang]?.[match] ?? match;
  }, [lang]);

  const translateServerError = useCallback((error) => {
    const map = {
      'User already exists': 'May account na',
      'Invalid credentials': 'Invalid na credentials',
      'Account not found': 'Hindi nahanap ang account',
      'Registration submitted': 'Naipasa ang rehistrasyon',
      'Registration failed': 'Nabigo ang rehistrasyon',
      'Password reset link sent': 'Naipadala ang password reset link',
      'Invalid or expired code': 'Invalid o expired na code',
      'Verification sent': 'Na-verify na',
      'Request sent': 'Naipala ang kahilingan',
      'Operation failed': 'Nabigo ang operasyon',
      'Network error': 'Network error',
      'Server error': 'Server error',
      'Unauthorized': 'Hindi awtorizado',
      'Forbidden': 'Natatanggalan ng access',
      'Not found': 'Hindi nahanap',
      'Internal server error': 'Internal na server error',
      'Bad request': 'Mali ang pag-request',
      'Conflict': 'Conflict',
      'Timeout': 'Timeout',
      'Cannot connect': 'Hindi makakonekta',
    };
    return map[error] || error;
  }, []);

  const value = useMemo(() => ({ t, lang, setLang, translateStatus, translateServerError }), [t, lang, setLang, translateStatus, translateServerError]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}

export function getLangName(code) {
  return langNames[code] || code;
}

export { langNames };