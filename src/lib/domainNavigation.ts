import { SurfaceType } from '../types';

export type ProductHost = 'cloud' | 'hosting' | 'docs' | 'api' | 'central' | 'local';

export interface DomainInfo {
  isProdOpticDomain: boolean;
  currentHostname: string;
  productHost: ProductHost;
  lockedSurface: SurfaceType | null;
}

/**
 * Checks if the hostname belongs to the production Optic domain cluster (*.optic.doy.best).
 */
export function isProdOpticDomain(hostname?: string): boolean {
  const host = (hostname || (typeof window !== 'undefined' ? window.location.hostname : ''))
    .toLowerCase()
    .trim();
  return host === 'optic.doy.best' || host.endsWith('.optic.doy.best');
}

/**
 * Determines the Product Host archetype directly from the window hostname.
 * The hostname is the single unbreakable source of truth.
 *
 * Rules:
 * - cloud.optic.doy.best (or cloud.localhost) -> 'cloud' product only
 * - hosting.optic.doy.best (or hosting.localhost) -> 'hosting' product only
 * - docs.optic.doy.best (or docs.localhost) -> 'docs' product only
 * - api.optic.doy.best (or api.localhost) -> 'api' product only
 * - optic.doy.best -> 'central' (central dashboard & account system)
 * - localhost / 127.0.0.1 / preview cloud run containers -> 'local'
 */
export function getProductHost(hostname?: string): ProductHost {
  const host = (hostname || (typeof window !== 'undefined' ? window.location.hostname : ''))
    .toLowerCase()
    .trim();

  if (!host) return 'local';

  // Subdomain matching for production & local subdomain simulation
  if (host === 'cloud.optic.doy.best' || host === 'cloud.localhost' || host.startsWith('cloud.')) {
    return 'cloud';
  }
  if (
    host === 'hosting.optic.doy.best' ||
    host === 'hosting.localhost' ||
    host.startsWith('hosting.')
  ) {
    return 'hosting';
  }
  if (host === 'docs.optic.doy.best' || host === 'docs.localhost' || host.startsWith('docs.')) {
    return 'docs';
  }
  if (host === 'api.optic.doy.best' || host === 'api.localhost' || host.startsWith('api.')) {
    return 'api';
  }
  if (host === 'optic.doy.best') {
    return 'central';
  }

  return 'local';
}

/**
 * Retrieves domain information and any surface locks imposed by the hostname.
 */
export function getDomainInfo(): DomainInfo {
  if (typeof window === 'undefined') {
    return {
      isProdOpticDomain: false,
      currentHostname: '',
      productHost: 'local',
      lockedSurface: null,
    };
  }

  const currentHostname = window.location.hostname.toLowerCase().trim();
  const isProd = isProdOpticDomain(currentHostname);
  const productHost = getProductHost(currentHostname);

  let lockedSurface: SurfaceType | null = null;
  if (productHost === 'cloud') lockedSurface = 'cloud';
  else if (productHost === 'hosting') lockedSurface = 'hosting';
  else if (productHost === 'docs') lockedSurface = 'docs';
  else if (productHost === 'api') lockedSurface = 'api';

  return {
    isProdOpticDomain: isProd,
    currentHostname,
    productHost,
    lockedSurface,
  };
}

/**
 * Generates the canonical target URL for a given surface and path.
 */
export function getSurfaceUrl(surface: SurfaceType, path: string = '/'): string {
  if (typeof window === 'undefined') return path;

  const currentHostname = window.location.hostname.toLowerCase().trim();
  const isProd = isProdOpticDomain(currentHostname);

  if (isProd) {
    switch (surface) {
      case 'cloud':
        return `https://cloud.optic.doy.best${path === '/cloud' ? '/' : path}`;
      case 'hosting':
        return `https://hosting.optic.doy.best${path === '/hosting' ? '/' : path}`;
      case 'docs':
        return `https://docs.optic.doy.best${path === '/docs' ? '/' : path}`;
      case 'api':
        return `https://api.optic.doy.best${path === '/api' ? '/' : path}`;
      case 'dashboard':
        return `https://optic.doy.best${path.startsWith('/dashboard') ? path : '/dashboard'}`;
      case 'main':
        return 'https://optic.doy.best/';
      case 'login':
        return 'https://optic.doy.best/login';
      case 'signup':
        return 'https://optic.doy.best/signup';
      case 'callback':
        return 'https://optic.doy.best/auth/callback';
      case 'privacy':
        return 'https://optic.doy.best/privacy';
      case 'terms':
        return 'https://optic.doy.best/terms';
      default:
        return `https://optic.doy.best${path.startsWith('/') ? path : `/${path}`}`;
    }
  }

  // Local development / single-origin fallback
  switch (surface) {
    case 'cloud':
      return path.startsWith('/cloud') ? path : '/cloud';
    case 'hosting':
      return path.startsWith('/hosting') ? path : '/hosting';
    case 'docs':
      return path.startsWith('/docs') ? path : '/docs';
    case 'api':
      return path.startsWith('/api') ? path : '/api';
    case 'dashboard':
      return path.startsWith('/dashboard') ? path : '/dashboard';
    case 'main':
      return '/';
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
 * Checks if navigating to targetSurface from the current hostname requires a cross-subdomain redirect.
 */
export function isCrossSubdomainNavigation(targetSurface: SurfaceType): boolean {
  if (typeof window === 'undefined') return false;

  const currentHostname = window.location.hostname.toLowerCase().trim();
  const isProd = isProdOpticDomain(currentHostname);
  if (!isProd) return false;

  const currentProduct = getProductHost(currentHostname);

  // If on Cloud product subdomain
  if (currentProduct === 'cloud') {
    // Internal cloud navigation stays on cloud.optic.doy.best
    return targetSurface !== 'cloud';
  }

  // If on Hosting product subdomain
  if (currentProduct === 'hosting') {
    // Internal hosting navigation stays on hosting.optic.doy.best
    return targetSurface !== 'hosting';
  }

  // If on Docs product subdomain
  if (currentProduct === 'docs') {
    return targetSurface !== 'docs';
  }

  // If on API product subdomain
  if (currentProduct === 'api') {
    return targetSurface !== 'api';
  }

  // If on Central application (optic.doy.best)
  if (currentProduct === 'central') {
    // Switching to Cloud, Hosting, Docs, API requires navigating to the dedicated subdomain
    return (
      targetSurface === 'cloud' ||
      targetSurface === 'hosting' ||
      targetSurface === 'docs' ||
      targetSurface === 'api'
    );
  }

  return false;
}

/**
 * Resolves the active surface from the hostname and pathname with strict hierarchy:
 * THE HOSTNAME ALWAYS WINS OVER THE PATHNAME.
 */
export function resolveSurfaceState(): {
  surface: SurfaceType;
  path: string;
  tab?: 'overview' | 'keys' | 'settings';
} {
  if (typeof window === 'undefined') {
    return { surface: 'main', path: '/' };
  }

  const hostname = window.location.hostname.toLowerCase().trim();
  const pathname = window.location.pathname.toLowerCase();
  const hash = window.location.hash || '';
  const search = window.location.search || '';
  const productHost = getProductHost(hostname);

  // Universal OAuth callback detection
  const isCallback =
    pathname.startsWith('/auth/callback') ||
    pathname.startsWith('/callback') ||
    hash.includes('access_token=') ||
    hash.includes('refresh_token=') ||
    search.includes('code=') ||
    search.includes('error_description=');

  if (isCallback) {
    return { surface: 'callback', path: pathname || '/auth/callback' };
  }

  // 1. CLOUD PRODUCT HOSTNAME (cloud.optic.doy.best / cloud.localhost)
  // Must ONLY render the Cloud application.
  if (productHost === 'cloud') {
    if (pathname === '/login' || pathname === '/signin') {
      return { surface: 'login', path: '/login' };
    }
    if (pathname === '/signup' || pathname === '/register') {
      return { surface: 'signup', path: '/signup' };
    }
    // Clean pathname if history or direct entry had extraneous segments like /dashboard or /cloud
    if (
      pathname === '/dashboard' ||
      pathname.startsWith('/dashboard/') ||
      pathname === '/cloud' ||
      pathname === '/hosting'
    ) {
      try {
        window.history.replaceState(null, '', '/');
      } catch {
        // ignore
      }
    }
    return { surface: 'cloud', path: '/' };
  }

  // 2. HOSTING PRODUCT HOSTNAME (hosting.optic.doy.best / hosting.localhost)
  // Must ONLY render the Hosting application.
  if (productHost === 'hosting') {
    if (pathname === '/login' || pathname === '/signin') {
      return { surface: 'login', path: '/login' };
    }
    if (pathname === '/signup' || pathname === '/register') {
      return { surface: 'signup', path: '/signup' };
    }
    if (
      pathname === '/dashboard' ||
      pathname.startsWith('/dashboard/') ||
      pathname === '/hosting' ||
      pathname === '/cloud'
    ) {
      try {
        window.history.replaceState(null, '', '/');
      } catch {
        // ignore
      }
    }
    return { surface: 'hosting', path: '/' };
  }

  // 3. DOCS PRODUCT HOSTNAME (docs.optic.doy.best / docs.localhost)
  if (productHost === 'docs') {
    return { surface: 'docs', path: '/' };
  }

  // 4. API PRODUCT HOSTNAME (api.optic.doy.best / api.localhost)
  if (productHost === 'api') {
    return { surface: 'api', path: '/' };
  }

  // 5. CENTRAL APPLICATION (optic.doy.best)
  if (productHost === 'central') {
    // Direct visits to product sub-paths on central domain redirect to respective subdomains
    if (pathname === '/cloud' || pathname.startsWith('/cloud/')) {
      window.location.replace('https://cloud.optic.doy.best/');
      return { surface: 'cloud', path: '/' };
    }
    if (pathname === '/hosting' || pathname.startsWith('/hosting/')) {
      window.location.replace('https://hosting.optic.doy.best/');
      return { surface: 'hosting', path: '/' };
    }
    if (pathname === '/docs' || pathname.startsWith('/docs/')) {
      window.location.replace('https://docs.optic.doy.best/');
      return { surface: 'docs', path: '/' };
    }
    if (pathname === '/api' || pathname.startsWith('/api/')) {
      window.location.replace('https://api.optic.doy.best/');
      return { surface: 'api', path: '/' };
    }

    // Auth & Legal
    if (pathname === '/login' || pathname === '/signin') return { surface: 'login', path: '/login' };
    if (pathname === '/signup' || pathname === '/register') return { surface: 'signup', path: '/signup' };
    if (pathname.startsWith('/privacy')) return { surface: 'privacy', path: '/privacy' };
    if (pathname.startsWith('/terms')) return { surface: 'terms', path: '/terms' };

    // Dashboard tabs
    if (
      pathname === '/keys' ||
      pathname === '/apikeys' ||
      pathname === '/api-keys' ||
      pathname.startsWith('/dashboard/keys')
    ) {
      return { surface: 'dashboard', path: '/dashboard/keys', tab: 'keys' };
    }
    if (
      pathname === '/settings' ||
      pathname === '/account' ||
      pathname.startsWith('/dashboard/settings')
    ) {
      return { surface: 'dashboard', path: '/dashboard/settings', tab: 'settings' };
    }
    if (pathname === '/dashboard' || pathname.startsWith('/dashboard')) {
      return { surface: 'dashboard', path: '/dashboard', tab: 'overview' };
    }

    // Root landing / dashboard
    return { surface: 'main', path: '/' };
  }

  // 6. LOCAL DEVELOPMENT / SINGLE ORIGIN FALLBACK (localhost:3000, preview URLs)
  if (pathname.startsWith('/cloud') || pathname.startsWith('/storage')) {
    return { surface: 'cloud', path: '/cloud' };
  }
  if (pathname.startsWith('/hosting') || pathname.startsWith('/deploy')) {
    return { surface: 'hosting', path: '/hosting' };
  }
  if (pathname.startsWith('/docs') || pathname.startsWith('/documentation')) {
    return { surface: 'docs', path: '/docs' };
  }
  if (pathname === '/api' || pathname.startsWith('/api/')) {
    return { surface: 'api', path: '/api' };
  }
  if (
    pathname === '/keys' ||
    pathname === '/apikeys' ||
    pathname.startsWith('/dashboard/keys')
  ) {
    return { surface: 'dashboard', path: '/dashboard/keys', tab: 'keys' };
  }
  if (
    pathname === '/settings' ||
    pathname === '/account' ||
    pathname.startsWith('/dashboard/settings')
  ) {
    return { surface: 'dashboard', path: '/dashboard/settings', tab: 'settings' };
  }
  if (pathname === '/dashboard' || pathname.startsWith('/dashboard')) {
    return { surface: 'dashboard', path: '/dashboard', tab: 'overview' };
  }
  if (pathname === '/login' || pathname === '/signin') return { surface: 'login', path: '/login' };
  if (pathname === '/signup' || pathname === '/register') return { surface: 'signup', path: '/signup' };
  if (pathname.startsWith('/privacy')) return { surface: 'privacy', path: '/privacy' };
  if (pathname.startsWith('/terms')) return { surface: 'terms', path: '/terms' };
  if (pathname === '/' || pathname === '') return { surface: 'main', path: '/' };

  return { surface: 'notfound', path: pathname };
}
