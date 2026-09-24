import axios from 'axios';
import { readSession, clearSession } from './sessionStore';

function readStoredToken() {
  const parsed = readSession();
  return (parsed && parsed.token) || null;
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

// Force logout when an authenticated request comes back 401 (revoked session / expired token).
// Only fires when the request actually carried our token, and only once per cycle.
let handling401 = false;
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error && error.response ? error.response.status : null;
    if (status === 401 && authToken && !handling401) {
      handling401 = true;
      setAuthToken(null);
      clearSession();
      window.location.reload();
    }
    return Promise.reject(error);
  }
);