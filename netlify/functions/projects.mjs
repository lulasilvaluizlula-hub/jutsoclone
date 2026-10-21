import { createNetlifyStore } from '../../lib/netlify-store.mjs';
import { createProjectsHandler } from '../../lib/projects.mjs';
import { captureRenderedPage } from '../../lib/render.mjs';
export default async function projects(request) {
  try { return await createProjectsHandler({ store:createNetlifyStore(),capture:captureRenderedPage })(request); }
  catch { return Response.json({error:'O serviço de projetos está temporariamente indisponível.'},{status:503,headers:{'Cache-Control':'no-store'}}); }
}
export const config = { path:['/api/projects','/api/projects/:id','/api/projects/:id/pages','/api/projects/:id/pages/:pageid'], rateLimit:{action:'rate_limit',aggregateBy:['ip'],windowSize:60,windowLimit:30} };
