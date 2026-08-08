import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // WebSocket connections are proxied directly from the browser to Callisto_Node.
  // No server-side proxying is needed — the WS URL is configured via env vars.
  output: 'standalone',
};

export default nextConfig;
