import { createNetlifyStore } from '../../lib/netlify-store.mjs';
import { createAuthHandler } from '../../lib/auth.mjs';

export default async function auth(request, context) {
  try {
    const handler = createAuthHandler({ store: createNetlifyStore() });
    return await handler(request, { ip: context.ip });
  } catch (error) {
    console.error('netlify-auth-init-failed', error?.name || 'Error');
    return Response.json({ error: 'O serviço de contas não está disponível neste deploy. Tente novamente após a atualização.', code: 'AUTH_STORAGE_UNAVAILABLE' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}

export const config = {
  path: ['/api/auth/:action', '/api/demo/:action'],
  rateLimit: { action: 'rate_limit', aggregateBy: ['ip'], windowSize: 60, windowLimit: 40 }
};
