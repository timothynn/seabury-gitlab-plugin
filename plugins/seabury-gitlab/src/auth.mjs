import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
const execute = promisify(execFile);
export async function getToken() {
  if (process.env.SEABURY_GITLAB_TOKEN?.trim()) return process.env.SEABURY_GITLAB_TOKEN.trim();
  if (process.platform === 'win32') {
    try {
      const { stdout } = await execute('powershell.exe', ['-NoProfile', '-NonInteractive', '-File', fileURLToPath(new URL('../scripts/read-token.ps1', import.meta.url))], { windowsHide: true, timeout: 10000 });
      if (stdout.trim()) return stdout.trim();
    } catch { /* Never expose subprocess output, which can contain credentials. */ }
  }
  throw new Error('GitLab is not authenticated. Run scripts/connect.ps1 locally to save your token. Never paste the token into chat.');
}
