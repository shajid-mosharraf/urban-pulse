import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './pages/App';
import reportWebVitals from './reportWebVitals';

const API_BASE = 'http://localhost:5000';
const nativeFetch = window.fetch.bind(window);
let refreshPromise = null;

const getRequestUrl = (input) => {
  if (typeof input === 'string') return input;
  if (input && typeof input.url === 'string') return input.url;
  return '';
};

const isApiRequest = (url) => url.startsWith(API_BASE);
const isRefreshRequest = (url) => url.includes('/api/auth/refresh');

const hasAuthorizationHeader = (headers) => {
  if (!headers) return false;

  if (headers instanceof Headers) {
    return headers.has('Authorization') || headers.has('authorization');
  }

  if (Array.isArray(headers)) {
    return headers.some(([key]) => String(key || '').toLowerCase() === 'authorization');
  }

  return Object.keys(headers).some((key) => String(key || '').toLowerCase() === 'authorization');
};

const buildHeadersWithToken = (headers, token, forceReplace = false) => {
  const merged = new Headers(headers || {});
  if (token && (forceReplace || !merged.has('Authorization'))) {
    merged.set('Authorization', `Bearer ${token}`);
  }
  return merged;
};

const refreshAccessToken = async () => {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const response = await nativeFetch(`${API_BASE}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Unable to refresh access token.');
      }

      const payload = await response.json();
      const nextToken = payload?.data?.accessToken;

      if (!nextToken) {
        throw new Error('Refresh response did not include access token.');
      }

      localStorage.setItem('accessToken', nextToken);
      return nextToken;
    })().finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
};

window.fetch = async (input, init = {}) => {
  const url = getRequestUrl(input);
  const token = localStorage.getItem('accessToken');
  const shouldHandle = isApiRequest(url) && !isRefreshRequest(url);

  let requestInit = init;
  if (shouldHandle && typeof input === 'string' && !hasAuthorizationHeader(init.headers)) {
    requestInit = {
      ...init,
      headers: buildHeadersWithToken(init.headers, token),
    };
  }

  let response = await nativeFetch(input, requestInit);

  if (!shouldHandle || response.status !== 401 || requestInit.__retryAttempted) {
    return response;
  }

  try {
    const nextToken = await refreshAccessToken();

    const retryInit = {
      ...requestInit,
      __retryAttempted: true,
      headers: buildHeadersWithToken(requestInit.headers, nextToken, true),
    };

    response = await nativeFetch(input, retryInit);
    return response;
  } catch (err) {
    localStorage.removeItem('accessToken');
    return response;
  }
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
