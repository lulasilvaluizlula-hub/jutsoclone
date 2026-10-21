import { createPublicationHandler } from '../../lib/publication.mjs';
import { createNetlifyStore } from '../../lib/netlify-store.mjs';
export default async function published(request) {
  try { return await createPublicationHandler({store:createNetlifyStore()})(request); }
  catch { return new Response('Publicação indisponível.',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}}); }
}
export const config={path:['/p/:token','/p/:token/:pageid'],rateLimit:{action:'rate_limit',aggregateBy:['ip'],windowSize:60,windowLimit:120}};
