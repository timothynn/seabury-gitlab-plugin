import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createGitLab } from './client.mjs';
import { getToken } from './auth.mjs';
import { createServer } from './tools.mjs';
await createServer(createGitLab({tokenProvider:getToken})).connect(new StdioServerTransport());
