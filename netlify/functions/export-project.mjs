import { createPublicationHandler } from '../../lib/publication.mjs';
import { createNetlifyStore } from '../../lib/netlify-store.mjs';
export default async function exportProject(request) {
  try { return await createPublicationHandler({store:createNetlifyStore()})(request); }
  catch { return Response.json({error:'Exportação e publicação temporariamente indisponíveis.'},{status:503,headers:{'Cache-Control':'no-store'}}); }
}
export const config={path:['/api/projects/:id/export','/api/projects/:id/publish'],rateLimit:{action:'rate_limit',aggregateBy:['ip'],windowSize:60,windowLimit:30}};
