export function resolveServiceUrl(envUrl, defaultPort, isRender = !!process.env.RENDER) {
  let url = envUrl || `http://localhost:${defaultPort}`;
  
  if (url && !url.startsWith('http')) {
    const isPublic = url.includes('onrender.com');
    const protocol = isPublic ? 'https' : 'http';
    
    const hasPath = url.includes('/');
    const needsPort = !isPublic && !url.includes(':') && !url.includes('localhost');
    const port = isRender ? '10000' : defaultPort;
    
    if (hasPath) {
      url = `${protocol}://${url}`;
    } else {
      url = `${protocol}://${url}${needsPort ? `:${port}` : ''}`;
    }
  }
  
  return url;
}
