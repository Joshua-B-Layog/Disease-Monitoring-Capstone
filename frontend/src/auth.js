import axios from 'axios';

const SESSION_KEY = 'cdms_session';

function readStoredToken() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return (parsed && parsed.token) || null;
  } catch {
    return null;
  }
}

let authToken = (typeof localStorage !== 'undefined') ? readStoredToken() : null;

export function setAuthToken(token) {
  authToken = token || null;
}

export function getAuthToken() {
  return authToken;
}

export function authHeaders() {
  return authToken ? { Authorization: `Bearer ${authToken}` } : {};
}

axios.interceptors.request.use((config) => {
  if (authToken) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${authToken}`;
  }
  return config;
});