const env = require('../../config/env');
const service = require('./service');
const { sendData } = require('../../utils/pagination');

const ACCESS_COOKIE = 'access_token';
const REFRESH_COOKIE = 'refresh_token';
const REFRESH_PATH = '/api/v1/auth';

const baseCookie = {
  httpOnly: true,
  secure: env.isProd,
  sameSite: 'lax',
};

function setAuthCookies(res, { access, refresh }) {
  res.cookie(ACCESS_COOKIE, access.token, {
    ...baseCookie,
    path: '/api',
    maxAge: env.ACCESS_TOKEN_TTL_MINUTES * 60 * 1000,
  });
  res.cookie(REFRESH_COOKIE, refresh.token, {
    ...baseCookie,
    path: REFRESH_PATH,
    maxAge: env.REFRESH_TOKEN_TTL_DAYS * 86400 * 1000,
  });
}

function clearAuthCookies(res) {
  res.clearCookie(ACCESS_COOKIE, { ...baseCookie, path: '/api' });
  res.clearCookie(REFRESH_COOKIE, { ...baseCookie, path: REFRESH_PATH });
}

async function login(req, res) {
  const result = await service.login(req.body, { ip: req.ip });
  setAuthCookies(res, result);
  sendData(res, { user: result.user, accessTokenExpiresAt: result.access.expiresAt });
}

async function refresh(req, res) {
  try {
    const result = await service.refresh(req.cookies?.[REFRESH_COOKIE]);
    setAuthCookies(res, result);
    sendData(res, { user: result.user, accessTokenExpiresAt: result.access.expiresAt });
  } catch (err) {
    clearAuthCookies(res);
    throw err;
  }
}

async function logout(req, res) {
  await service.logout(req.cookies?.[REFRESH_COOKIE]);
  clearAuthCookies(res);
  sendData(res, { loggedOut: true });
}

async function me(req, res) {
  sendData(res, await service.me(req.user.id));
}

async function changePassword(req, res) {
  await service.changePassword(req.user, req.body);
  sendData(res, { updated: true });
}

module.exports = { login, refresh, logout, me, changePassword };
