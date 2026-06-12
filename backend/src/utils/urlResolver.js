/**
 * Unified logic to resolve internal/external service URLs on Render or local.
 */

export function resolveServiceUrl(envUrl, defaultPort, isRender = !!process.env.RENDER) {
  let url = envUrl || `http://localhost:${defaultPort}`;
  
  if (url && !url.startsWith('http')) {
    const isPublic = url.includes('onrender.com');
    const protocol = isPublic ? 'https' : 'http';
    
    // Render internal discovery often needs port 10000 for web services
    const needsPort = !isPublic && !url.includes(':') && !url.includes('localhost');
    const port = isRender ? '10000' : defaultPort;
    
    url = `${protocol}://${url}${needsPort ? `:${port}` : ''}`;
  }
  
  return url;
}
