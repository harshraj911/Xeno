/**
 * Unified logic to resolve internal/external service URLs on Render or local.
 */

export function resolveServiceUrl(envUrl, defaultPort, isRender = !!process.env.RENDER) {
  if (!envUrl) return `http://localhost:${defaultPort}`;
  
  // If it already has a protocol, use it as is
  if (envUrl.startsWith('http://') || envUrl.startsWith('https://')) {
    return envUrl;
  }

  const isPublic = envUrl.includes('onrender.com');
  const protocol = isPublic ? 'https' : 'http';
  const hasPath = envUrl.includes('/');
  
  // Render internal hosts usually don't have dots (e.g. "xeno-backend")
  // Public hosts do have dots (e.g. "xeno-backend.onrender.com")
  const needsPort = !isPublic && !envUrl.includes(':') && !envUrl.includes('localhost');
  const port = isRender ? '10000' : defaultPort;

  let url;
  if (hasPath) {
    url = `${protocol}://${envUrl}`;
  } else {
    url = `${protocol}://${envUrl}${needsPort ? `:${port}` : ''}`;
  }

  console.log(`[URL Resolver] Resolved "${envUrl}" to "${url}" (isRender: ${isRender})`);
  return url;
}
