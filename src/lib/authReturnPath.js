/** @type {string[]} */
const AUTH_ROUTE_PREFIXES = ['/login', '/signup', '/auth/'];

/**
 * @param {string | undefined | null} path
 * @returns {string}
 */
export function safeAuthReturnPath(path) {
  if (typeof path !== 'string' || !path.startsWith('/')) {
    return '/library';
  }
  if (AUTH_ROUTE_PREFIXES.some((p) => path === p || path.startsWith(`${p}`))) {
    return '/library';
  }
  return path;
}

/**
 * @param {{ pathname: string, search?: string, hash?: string }} location
 */
export function loginRedirectStateFromLocation(location) {
  const path = `${location.pathname || ''}${location.search || ''}${location.hash || ''}`;
  return { from: path };
}

/**
 * @param {import('react-router-dom').Location} location
 */
export function navigateToLoginWithReturn(location) {
  return {
    pathname: '/login',
    state: loginRedirectStateFromLocation(location),
  };
}
