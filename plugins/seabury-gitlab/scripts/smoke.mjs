import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { resolve } from 'node:path';
const root = resolve(process.argv[2] || '.');
const transport = new StdioClientTransport({command:process.execPath,args:['--use-system-ca',resolve(root,'src/server.mjs')],cwd:root,env:{...process.env},stderr:'pipe'});
const client = new Client({name:'seabury-install-check',version:'1.0.0'});
try {
  await client.connect(transport);
  const result = await client.listTools();
  if(result.tools.length!==20) throw new Error('Expected 20 tools');
  console.log('Installed server: MCP connection successful; 20 tools discovered.');
  const identity = await client.callTool({name:'get_current_user',arguments:{}});
  if(identity.isError) {
    console.log('Account connection pending: '+identity.content[0].text);
  } else {
    const payload=JSON.parse(identity.content[0].text);
    console.log('Authenticated as: '+payload.data.username);
    const projects = await client.callTool({name:'list_projects',arguments:{per_page:5}});
    if(projects.isError) throw new Error(projects.content[0].text);
    const page = JSON.parse(projects.content[0].text);
    console.log('Project access verified: '+page.data.length+' projects returned (page size 5).');
  }
} finally { await client.close(); }
