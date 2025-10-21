import cfg from './config.json';

const isDev = process.env.NODE_ENV !== 'production';

export const config = {
  // Dev: localhost, Prod: Railway/Vercel
  apiUrl: isDev ? 'http://localhost:3000' : cfg.urls.api,
  frontendUrl: isDev ? 'http://localhost:3001' : cfg.urls.frontend,

  // Solana (devnet for now)
  rpcUrl: 'https://api.devnet.solana.com',
  programId: cfg.solana.programId,
  commitment: cfg.solana.commitment,

  // CORS
  corsOrigins: cfg.cors.allowedOrigins,
};

export default config;
