import test from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createGitLab, segment } from '../src/client.mjs';
import { createServer } from '../src/tools.mjs';

test('HTTPS host, encoded paths, authentication, pagination and redirect protection', async () => {
  let called;
  const api = createGitLab({tokenProvider:async()=>'test-secret',fetchImpl:async(url,options)=>{
    called={url,options}; return new Response(JSON.stringify({description:'test-secret'}),{headers:{'content-type':'application/json','x-next-page':'2'}});
  }});
  const result = await api('GET',`/projects/${segment('group/repo')}`,{page:1});
  assert.equal(called.url.origin,'https://gitlab.seaburymro.com');
  assert.equal(called.url.pathname,'/api/v4/projects/group%2Frepo');
  assert.equal(called.options.headers['PRIVATE-TOKEN'],'test-secret');
  assert.equal(called.options.redirect,'error');
  assert.equal(result.next_page,'2');
  assert.equal(result.data.description,'[REDACTED]');
  await assert.rejects(()=>api('DELETE','/projects/1'),/Invalid API/);
  await assert.rejects(()=>api('GET','/../user'),/Invalid API/);
  assert.throws(()=>segment('..'));
});
test('HTTP errors hide response bodies and credentials',async()=>{
  for (const status of [401,403,404,429,500]) {
    const api=createGitLab({tokenProvider:async()=>'secret',fetchImpl:async()=>new Response('secret',{status})});
    await assert.rejects(()=>api('GET','/user'),new RegExp(`GitLab HTTP ${status}`));
  }
  const api=createGitLab({tokenProvider:async()=>{throw new Error('not authenticated');},fetchImpl:async()=>{throw new Error('must not call');}});
  await assert.rejects(()=>api('GET','/user'),/not authenticated/);
});
test('response limits and non-JSON login pages fail clearly',async()=>{
  const api=createGitLab({tokenProvider:async()=>'secret',fetchImpl:async()=>new Response('x'.repeat(2_000_001),{headers:{'content-type':'application/json'}})});
  await assert.rejects(()=>api('GET','/user'),/exceeds 2 MB/);
  const html=createGitLab({tokenProvider:async()=>'secret',fetchImpl:async()=>new Response('<html>login</html>',{headers:{'content-type':'text/html'}})});
  await assert.rejects(()=>html('GET','/user'),/Expected GitLab JSON/);
});
test('MCP negotiation, discovery, validation, drafts and write routing',async()=>{
  const calls=[];
  const server=createServer(async(...args)=>{calls.push(args);return {data:{web_url:'https://gitlab.seaburymro.com/g/p/-/merge_requests/1'},next_page:null};});
  const client=new Client({name:'test',version:'1.0'});
  const [ct,st]=InMemoryTransport.createLinkedPair();
  await server.connect(st); await client.connect(ct);
  try {
    const {tools}=await client.listTools();
    assert.equal(tools.length,20);
    assert.equal(tools.filter(t=>!t.annotations.readOnlyHint).length,5);
    assert(!tools.some(t=>/delete|^merge_|trigger/.test(t.name)));
    const created=await client.callTool({name:'create_merge_request',arguments:{project:'group/repo',source_branch:'feature',target_branch:'develop',title:'Change'}});
    assert(!created.isError);
    assert.deepEqual(calls.at(-1),['POST','/projects/group%2Frepo/merge_requests',{}, {source_branch:'feature',target_branch:'develop',title:'Draft: Change'}]);
    const invalid=await client.callTool({name:'get_issue',arguments:{project:'g/p',iid:-1}});
    assert.equal(invalid.isError,true);
    const empty=await client.callTool({name:'update_issue',arguments:{project:'g/p',iid:2}});
    assert.equal(empty.isError,true);
    await client.callTool({name:'update_issue',arguments:{project:'g/p',iid:2,state_event:'close'}});
    assert.deepEqual(calls.at(-1),['PUT','/projects/g%2Fp/issues/2',{}, {state_event:'close'}]);
    await client.callTool({name:'add_note',arguments:{project:'g/p',iid:7,kind:'merge_requests',body:'Requested comment'}});
    assert.deepEqual(calls.at(-1),['POST','/projects/g%2Fp/merge_requests/7/notes',{}, {body:'Requested comment'}]);
    await client.callTool({name:'get_repository_file',arguments:{project:'g/p',file_path:'src/a.ts',ref:'feature/test'}});
    assert.deepEqual(calls.at(-1),['GET','/projects/g%2Fp/repository/files/src%2Fa.ts',{ref:'feature/test'}]);
    const badPage=await client.callTool({name:'list_projects',arguments:{per_page:101}});
    assert.equal(badPage.isError,true);
  } finally { await client.close(); await server.close(); }
});
