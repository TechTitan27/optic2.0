import { SurfaceType } from '../types';

export interface DomainInfo {
  isProdOpticDomain: boolean;
  currentHostname: string;
  detectedSurface: SurfaceType;
}

export function getDomainInfo(): DomainInfo {
  if (typeof window === 'undefined') {
    return {
      isProdOpticDomain: false,
      currentHostname: '',
      detectedSurface: 'main',
    };
  }

  const hostname = window.location.hostname.toLowerCase();
  const isProd =
    hostname === 'optic.doy.best' || hostname.endsWith('.optic.doy.best');

  let detectedSurface: SurfaceType = 'main';
  if (hostname.startsWith('cloud.')) detectedSurface = 'cloud';
  else if (hostname.startsWith('hosting.')) detectedSurface = 'hosting';
  else if (hostname.startsWith('docs.')) detectedSurface = 'docs';
  else if (hostname.startsWith('api.')) detectedSurface = 'api';
  else if (window.location.pathname.startsWith('/dashboard')) detectedSurface = 'dashboard';

  return {
    isProdOpticDomain: isProd,
    currentHostname: hostname,
    detectedSurface,
  };
}

/**
 * Generates the correct target URL based on whether the app is running in production (subdomains)
 * or local/preview development (path-based).
 */
export function getSurfaceUrl(surface: SurfaceType, path: string = '/'): string {
  if (typeof window === 'undefined') return path;

  const hostname = window.location.hostname.toLowerCase();
  const isProd =
    hostname === 'optic.doy.best' || hostname.endsWith('.optic.doy.best');

  if (isProd) {
    switch (surface) {
      case 'main':
        return 'https://optic.doy.best/';
      case 'dashboard':
        return `https://optic.doy.best${path.startsWith('/dashboard') ? path : '/dashboard'}`;
      case 'cloud':
        return `https://cloud.optic.doy.best${path === '/cloud' ? '/' : path}`;
      case 'hosting':
        return `https://hosting.optic.doy.best${path === '/hosting' ? '/' : path}`;
      case 'docs':
        return `https://docs.optic.doy.best${path === '/docs' ? '/' : path}`;
      case 'api':
        return `https://api.optic.doy.best${path === '/api' ? '/' : path}`;
      case 'login':
        return `https://optic.doy.best/login`;
      case 'signup':
        return `https://optic.doy.best/signup`;
      case 'callback':
        return `https://optic.doy.best/auth/callback`;
      case 'privacy':
        return `https://optic.doy.best/privacy`;
      case 'terms':
        return `https://optic.doy.best/terms`;
      default:
        return path;
    }
  }

  // Local development / preview fallback: return clean local paths
  switch (surface) {
    case 'main':
      return '/';
    case 'dashboard':
      return path.startsWith('/dashboard') ? path : '/dashboard';
    case 'cloud':
      return path.startsWith('/cloud') ? path : '/cloud';
    case 'hosting':
      return path.startsWith('/hosting') ? path : '/hosting';
    case 'docs':
      return path.startsWith('/docs') ? path : '/docs';
    case 'api':
      return path.startsWith('/api') ? path : '/api';
    case 'login':
      return '/login';
    case 'signup':
      return '/signup';
    case 'callback':
      return '/auth/callback';
    case 'privacy':
      return '/privacy';
    case 'terms':
      return '/terms';
    default:
      return path;
  }
}

/**
 * Smart navigation helper:
 * If target surface belongs to another subdomain in production, performs cross-subdomain redirect.
 * Otherwise, uses client-side state navigation.
 */
export function navigateToSurface(
  targetSurface: SurfaceType,
  targetPath: string = '/',
  tab?: 'overview' | 'keys' | 'settings',
  clientNavigate?: (surface: SurfaceType, path?: string, tab?: 'overview' | 'keys' | 'settings') => void
) {
  if (typeof window === 'undefined') return;

  const hostname = window.location.hostname.toLowerCase();
  const isProd =
    hostname === 'optic.doy.best' || hostname.endsWith('.optic.doy.best');

  if (isProd) {
    // Determine expected host for target surface
    let expectedHost = 'optic.doy.best';
    if (targetSurface === 'cloud') expectedHost = 'cloud.optic.doy.best';
    else if (targetSurface === 'hosting') expectedHost = 'hosting.optic.doy.best';
    else if (targetSurface === 'docs') expectedHost = 'docs.optic.doy.best';
    else if (targetSurface === 'api') expectedHost = 'api.optic.doy.best';

    // If we need to cross subdomains, perform full window location change
    if (hostname !== expectedHost) {
      const destinationUrl = getSurfaceUrl(targetSurface, targetPath);
      window.location.href = destinationUrl;
      return;
    }
  }

  // Same subdomain or local development: perform client-side route update
  if (clientNavigate) {
    clientNavigate(targetSurface, targetPath, tab);
  }
}
