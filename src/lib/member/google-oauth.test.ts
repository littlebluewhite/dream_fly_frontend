import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  googleClientId,
  isGoogleLoginEnabled,
  googleRedirectUri,
  buildGoogleAuthUrl,
  startGoogleLogin,
  consumeGoogleOauthState
} from './google-oauth';

const STATE_KEY = 'dreamfly_google_oauth_state';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  sessionStorage.clear();
});

describe('googleClientId / isGoogleLoginEnabled — progressive enhancement gate', () => {
  it('is empty/disabled when VITE_GOOGLE_CLIENT_ID is unset', () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', '');
    expect(googleClientId()).toBe('');
    expect(isGoogleLoginEnabled()).toBe(false);
  });

  it('is enabled once VITE_GOOGLE_CLIENT_ID is set', () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'abc.apps.googleusercontent.com');
    expect(googleClientId()).toBe('abc.apps.googleusercontent.com');
    expect(isGoogleLoginEnabled()).toBe(true);
  });
});

describe('googleRedirectUri', () => {
  it('appends the callback route path to the given origin', () => {
    expect(googleRedirectUri('http://localhost:5173')).toBe(
      'http://localhost:5173/member/login/google'
    );
  });
});

describe('buildGoogleAuthUrl', () => {
  it('assembles the Google authorization URL with the required params', () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'abc.apps.googleusercontent.com');

    const url = new URL(buildGoogleAuthUrl('http://localhost:5173', 'state-xyz'));

    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(url.searchParams.get('client_id')).toBe('abc.apps.googleusercontent.com');
    expect(url.searchParams.get('redirect_uri')).toBe('http://localhost:5173/member/login/google');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('scope')).toBe('openid email profile');
    expect(url.searchParams.get('state')).toBe('state-xyz');
  });
});

describe('startGoogleLogin — kicks off the redirect', () => {
  it('stashes a random state in sessionStorage and redirects to a URL carrying that same state', () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'abc.apps.googleusercontent.com');
    vi.stubGlobal('location', { href: '', origin: 'http://localhost:5173' });

    startGoogleLogin();

    const stashed = sessionStorage.getItem(STATE_KEY);
    expect(stashed).toBeTruthy();
    const url = new URL(window.location.href);
    expect(url.hostname).toBe('accounts.google.com');
    expect(url.searchParams.get('state')).toBe(stashed);
  });

  it('mints a different state on each call (non-guessable, not reused)', () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'abc.apps.googleusercontent.com');
    vi.stubGlobal('location', { href: '', origin: 'http://localhost:5173' });

    startGoogleLogin();
    const first = sessionStorage.getItem(STATE_KEY);
    startGoogleLogin();
    const second = sessionStorage.getItem(STATE_KEY);

    expect(first).not.toBe(second);
  });
});

describe('consumeGoogleOauthState — CSRF verification, one-time use', () => {
  it('returns true and clears storage when the value matches what was stashed', () => {
    sessionStorage.setItem(STATE_KEY, 'good-state');

    expect(consumeGoogleOauthState('good-state')).toBe(true);
    expect(sessionStorage.getItem(STATE_KEY)).toBeNull();
  });

  it('returns false and still clears storage when the value does not match', () => {
    sessionStorage.setItem(STATE_KEY, 'good-state');

    expect(consumeGoogleOauthState('wrong-state')).toBe(false);
    expect(sessionStorage.getItem(STATE_KEY)).toBeNull();
  });

  it('returns false when nothing was ever stashed', () => {
    expect(consumeGoogleOauthState('anything')).toBe(false);
  });

  it('returns false when the received state is null (no ?state= param on the callback URL)', () => {
    sessionStorage.setItem(STATE_KEY, 'good-state');

    expect(consumeGoogleOauthState(null)).toBe(false);
    expect(sessionStorage.getItem(STATE_KEY)).toBeNull(); // still cleared
  });

  it('is one-time-use: a second check after a successful match returns false', () => {
    sessionStorage.setItem(STATE_KEY, 'good-state');

    expect(consumeGoogleOauthState('good-state')).toBe(true);
    expect(consumeGoogleOauthState('good-state')).toBe(false);
  });
});
