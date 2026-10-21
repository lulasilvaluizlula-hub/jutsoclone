import { createNetlifyStore } from '../../lib/netlify-store.mjs';
import { createProjectsHandler } from '../../lib/projects.mjs';
export default async function projects(request) {
  try { return await createProjectsHandler({ store:createNetlifyStore() })(request); }
  catch { return Response.json({error:'O serviço de projetos está temporariamente indisponível.'},{status:503,headers:{'Cache-Control':'no-store'}}); }
}
export const config = { path:['/api/projects','/api/projects/:id'], rateLimit:{action:'rate_limit',aggregateBy:['ip'],windowSize:60,windowLimit:30} };
