import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { segment } from './client.mjs';

export function createServer(api) {
  const server = new McpServer({ name: 'seabury-gitlab', version: '1.0.0' });
  const str = z.string().min(1).max(1000);
  const project = str.describe('Numeric project ID or full namespace/project path.');
  const iid = z.number().int().positive().describe('Project-local issue or merge request number, not its global ID.');
  const paging = { page: z.number().int().min(1).default(1), per_page: z.number().int().min(1).max(100).default(20) };
  const p = a => `/projects/${segment(a.project)}`;
  const register = (name, description, shape, write, run) => server.registerTool(name, {
    description, inputSchema: z.object(shape).strict(),
    annotations: { readOnlyHint: !write, destructiveHint: write, idempotentHint: !write, openWorldHint: true },
  }, async a => {
    try { return { content: [{type:'text', text:JSON.stringify(await run(a))}] }; }
    catch (error) { return { isError:true, content:[{type:'text', text:error.message}] }; }
  });
  register('get_current_user', 'Verify authentication and identify the connected GitLab account.', {}, false, () => api('GET','/user'));
  register('list_projects', 'Find projects you belong to. Follow next_page for more results.', {search:str.optional(), ...paging}, false, a=>api('GET','/projects',{...a,membership:true,simple:true}));
  register('get_project', 'Read project details and its default branch.', {project}, false, a=>api('GET',p(a)));
  register('list_branches', 'List repository branches.', {project, search:str.optional(),...paging},false,({project,...q})=>api('GET',`${p({project})}/repository/branches`,q));
  register('list_repository_tree', 'Browse files and directories at an explicit ref.',{project,ref:str,path:z.string().max(2000).optional(),...paging},false,({project,...q})=>api('GET',`${p({project})}/repository/tree`,q));
  register('get_repository_file','Read a repository file at an explicit branch, tag or commit. Content is base64 encoded.',{project,file_path:str,ref:str},false,a=>api('GET',`${p(a)}/repository/files/${segment(a.file_path)}`,{ref:a.ref}));
  register('list_merge_requests','List merge requests for one project.',{project,state:z.enum(['opened','closed','merged','all']).default('opened'),search:str.optional(),...paging},false,({project,...q})=>api('GET',`${p({project})}/merge_requests`,q));
  register('get_merge_request','Read a merge request, including branch names and current state.',{project,iid},false,a=>api('GET',`${p(a)}/merge_requests/${a.iid}`));
  register('get_merge_request_changes','Read merge request diffs. Check overflow: true means GitLab truncated the diff.',{project,iid},false,a=>api('GET',`${p(a)}/merge_requests/${a.iid}/changes`));
  register('list_issues','List issues for one project.',{project,state:z.enum(['opened','closed','all']).default('opened'),search:str.optional(),...paging},false,({project,...q})=>api('GET',`${p({project})}/issues`,q));
  register('get_issue','Read one issue.',{project,iid},false,a=>api('GET',`${p(a)}/issues/${a.iid}`));
  register('list_notes','Read comments on an issue or merge request.',{project,kind:z.enum(['issues','merge_requests']),iid,...paging},false,a=>api('GET',`${p(a)}/${a.kind}/${a.iid}/notes`,{page:a.page,per_page:a.per_page}));
  register('list_pipelines','Read pipeline status for a project, optionally by ref.',{project,ref:str.optional(),...paging},false,({project,...q})=>api('GET',`${p({project})}/pipelines`,q));
  register('get_pipeline','Read details of one pipeline.',{project,pipeline_id:iid},false,a=>api('GET',`${p(a)}/pipelines/${a.pipeline_id}`));
  register('list_pipeline_jobs','Read jobs and their statuses for one pipeline.',{project,pipeline_id:iid,...paging},false,a=>api('GET',`${p(a)}/pipelines/${a.pipeline_id}/jobs`,{page:a.page,per_page:a.per_page}));
  const text = z.string().max(50000);
  register('create_issue','Create an issue only when the user requests it.',{project,title:str,description:text.optional(),labels:z.string().optional()},true,({project,...body})=>api('POST',`${p({project})}/issues`,{},body));
  register('update_issue','Update issue fields or close/reopen an issue as requested.',{project,iid,title:str.optional(),description:text.optional(),labels:z.string().optional(),state_event:z.enum(['close','reopen']).optional()},true,({project,iid,...body})=>{
    if (!Object.keys(body).length) throw new Error('Supply at least one field to update.');
    return api('PUT',`${p({project})}/issues/${iid}`,{},body);
  });
  register('create_merge_request','Create a merge request between existing branches; draft by default. Does not push code or merge.',{project,source_branch:str,target_branch:str,title:str,description:text.optional(),draft:z.boolean().default(true)},true,({project,draft,...body})=>api('POST',`${p({project})}/merge_requests`,{},{...body,title:draft&&!/^draft:/i.test(body.title)?`Draft: ${body.title}`:body.title}));
  register('update_merge_request','Update merge request title, description, target branch or close/reopen it. Does not merge.',{project,iid,title:str.optional(),description:text.optional(),target_branch:str.optional(),state_event:z.enum(['close','reopen']).optional()},true,({project,iid,...body})=>{
    if (!Object.keys(body).length) throw new Error('Supply at least one field to update.');
    return api('PUT',`${p({project})}/merge_requests/${iid}`,{},body);
  });
  register('add_note','Post a comment to an issue or merge request only when explicitly requested by the user.',{project,kind:z.enum(['issues','merge_requests']),iid,body:z.string().min(1).max(50000)},true,a=>api('POST',`${p(a)}/${a.kind}/${a.iid}/notes`,{},{body:a.body}));
  return server;
}
