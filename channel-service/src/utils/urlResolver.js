export function resolveServiceUrl(envUrl, defaultPort, isRender = !!process.env.RENDER) {
  // Sanitize: remove trailing slash and whitespace
  let cleanUrl = (envUrl || '').trim();
  if (cleanUrl.endsWith('/')) cleanUrl = cleanUrl.slice(0, -1);

  if (!cleanUrl) return `http://localhost:${defaultPort}`;
  
  // If it already has a protocol, just ensure no trailing slash
  if (cleanUrl.startsWith('http://') || cleanUrl.startsWith('https://')) {
    return cleanUrl;
  }

  // Handle Render internal vs public
  const isPublic = cleanUrl.includes('.onrender.com');
  const protocol = isPublic ? 'https' : 'http';
  
  // Internal Render URLs (e.g. "xeno-backend") usually need port 10000
  const needsPort = !isPublic && !cleanUrl.includes(':') && !cleanUrl.includes('localhost');
  const port = isRender ? '10000' : defaultPort;

  const resolved = `${protocol}://${cleanUrl}${needsPort ? `:${port}` : ''}`;
  console.log(`[URL Resolver] ${cleanUrl} -> ${resolved} (isRender: ${isRender})`);
  return resolved;
}
