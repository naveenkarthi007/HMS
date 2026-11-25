import axios from 'axios';

export const API_BASE = '/hostel/api/v1';
const SESSION_KEY = 'hms.session';
const REFRESH_MARGIN_MS = 30 * 1000;

/**
 * A tiny, non-sensitive marker in localStorage that tells us a session *may* exist
 * (the real tokens live in httpOnly cookies). It lets us skip calling /auth/me for
 * anonymous visitors and refresh the access token shortly before it expires.
 */
export const session = {
  get() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },
  set(accessTokenExpiresAt) {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ exp: accessTokenExpiresAt }));
  },
  clear() {
    localStorage.removeItem(SESSION_KEY);
  },
};

const VIEW_ORG_KEY = 'hms.viewOrg';

/**
 * Platform view: the organisation a super admin is currently looking at (read-only).
 * Sent as `X-Organisation-Id`; the API ignores it for every other role.
 */
export const viewOrg = {
  get() {
    try {
      const raw = localStorage.getItem(VIEW_ORG_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },
  set(org) {
    localStorage.setItem(VIEW_ORG_KEY, JSON.stringify({ id: org.id, name: org.name, code: org.code }));
  },
  clear() {
    localStorage.removeItem(VIEW_ORG_KEY);
  },
};

const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

let refreshPromise = null;
let sessionExpiredHandler = null;

export function onSessionExpired(handler) {
  sessionExpiredHandler = handler;
}

const isAuthUrl = (url = '') => /\/auth\/(login|refresh|logout)$/.test(url);

/** Refreshes the access token once, even when many requests ask for it at the same time. */
export function refreshSession() {
  if (!refreshPromise) {
    refreshPromise = axios
      .post(`${API_BASE}/auth/refresh`, null, { withCredentials: true })
      .then((res) => {
        session.set(res.data.data.accessTokenExpiresAt);
        return res.data.data;
      })
      .catch((err) => {
        session.clear();
        if (sessionExpiredHandler) sessionExpiredHandler();
        throw err;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

// Proactive refresh: avoid sending a request with an access token we know has expired.
api.interceptors.request.use(async (config) => {
  if (isAuthUrl(config.url)) return config;
  const current = session.get();
  if (current?.exp && Date.now() > current.exp - REFRESH_MARGIN_MS) {
    await refreshSession();
  }
  // Only the organisation pages (/admin/*) look inside the viewed organisation;
  // the platform pages (/super/*) always see every organisation.
  const org = viewOrg.get();
  if (org?.id && window.location.pathname.startsWith('/admin')) {
    config.headers.set('X-Organisation-Id', String(org.id));
  }
  return config;
});

// Reactive refresh: on 401 retry the original request once after refreshing.
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;
    if (status === 401 && original && !original._retry && !isAuthUrl(original.url) && session.get()) {
      original._retry = true;
      await refreshSession();
      return api(original);
    }
    return Promise.reject(error);
  },
);

/** Drops empty values so the URL only carries active filters. */
export function cleanParams(params = {}) {
  const out = {};
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') out[key] = value;
  }
  return out;
}

/** Returns the `{ data, meta }` envelope of a successful response. */
export const unwrap = (promise) => promise.then((res) => ({ data: res.data.data, meta: res.data.meta }));

/** Returns only `data` of a successful response. */
export const unwrapData = (promise) => promise.then((res) => res.data.data);

/**
 * Downloads a CSV from `GET <path>` (same filters as the list) and saves it with the server's file name.
 * Returns the number of rows exported.
 */
export async function downloadCsv(path, params = {}) {
  let res;
  try {
    res = await api.get(path, { params: cleanParams(params), responseType: 'blob' });
  } catch (err) {
    // Error bodies arrive as a Blob because of responseType; turn them back into JSON for the message.
    const blob = err?.response?.data;
    if (blob instanceof Blob) {
      try {
        err.response.data = JSON.parse(await blob.text());
      } catch {
        /* keep the original error */
      }
    }
    throw err;
  }
  const disposition = res.headers['content-disposition'] || '';
  const match = disposition.match(/filename="?([^";]+)"?/);
  const filename = match ? match[1] : 'export.csv';
  const url = URL.createObjectURL(res.data);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return Number(res.headers['x-row-count'] ?? 0);
}

/** Posts CSV text (plus any extra fields such as defaultPassword) to `POST <path>`. */
export const uploadCsv = (path, body) => unwrapData(api.post(path, body, { timeout: 120000 }));

export function getErrorMessage(error, fallback = 'Something went wrong') {
  if (error?.response?.data?.error?.message) return error.response.data.error.message;
  if (error?.code === 'ECONNABORTED') return 'The server took too long to respond';
  if (error?.message === 'Network Error') return 'Cannot reach the server. Is the API running?';
  return error?.message || fallback;
}

export function getFieldErrors(error) {
  const details = error?.response?.data?.error?.details;
  return details && typeof details === 'object' && !Array.isArray(details) ? details : {};
}

export default api;
