# Seabury GitLab

Custom local Codex plugin for **https://gitlab.seaburymro.com**. Requires Node.js with `--use-system-ca` support (verified on Node.js 26.1.0) and Windows PowerShell for encrypted credential storage. Uses the Windows trusted certificate store with TLS verification enabled. No public server is deployed.

## Connect your account

1. Create a GitLab personal access token with **api** scope and an expiry at https://gitlab.seaburymro.com/-/user_settings/personal_access_tokens (older GitLab versions may use `/-/profile/personal_access_tokens`). This scope is needed for issue and merge request writes. Your existing project permissions still apply.
2. Double-click `plugins/seabury-gitlab/Connect-GitLab.cmd`, or run its `scripts/connect.ps1` in PowerShell. Paste the token into the invisible local prompt, never into chat.
3. The script verifies your account, then saves the token using Windows DPAPI at `%LOCALAPPDATA%/SeaburyGitLab/token.dpapi`. Open a new Codex chat and try: **Use Seabury GitLab to list my projects.**

The token remains outside this package. DPAPI encrypts it for this Windows user and computer; software running as the same user can decrypt it. To disconnect, revoke the token in GitLab and remove the encrypted token file. To rotate it, run the connection script again. `SEABURY_GITLAB_TOKEN` is also supported for managed environments and takes precedence over the saved token.

## Capabilities

- Browse projects, branches, repository trees and files at a specified ref.
- Read merge requests, diffs, issues and comments.
- Inspect pipelines and jobs.
- Create/update issues and merge requests; close/reopen them; post requested comments.
- New merge requests are drafts unless explicitly requested otherwise.

This version does not merge/approve requests, delete resources, push code or trigger pipelines. It supports 20 tools: 15 reads and 5 writes. Network traffic is restricted to the named GitLab HTTPS origin, redirects are refused, TLS verification stays enabled, requests time out after 30 seconds, and responses are limited to 2 MB. Lists expose `next_page`. GitLab's diff endpoint can truncate results; check `overflow`.

## Install on another Windows machine

Run `npm.cmd ci --ignore-scripts` inside `plugins/seabury-gitlab`, then from the marketplace folder:

```powershell
codex plugin marketplace add .
codex plugin add seabury-gitlab@seabury-local
```

Keep the marketplace folder available. Run the connection script on that computer. Installation registers the local plugin; a new chat or app restart may be needed to load tools. This local package is not a hosted ChatGPT web connector.

## Development and verification

Run `npm.cmd test` inside `plugins/seabury-gitlab`. All four test groups passed: request security/pagination, error handling, response limits, and MCP validation/write routing. Tests use an in-memory MCP client and mocked GitLab responses; they do not alter your work server. Codex confirmed the plugin installed and enabled, and the installed server started successfully with all 20 tools discoverable over stdio. On 3 October 2026, the installed plugin authenticated as `tnduati` and successfully listed five accessible projects. Live writes have not been tested against the work server.

Sources: [OpenAI plugin packaging](https://developers.openai.com/plugins/build/plugins), [GitLab authentication](https://docs.gitlab.com/api/rest/authentication/), [merge requests](https://docs.gitlab.com/api/merge_requests/), [issues](https://docs.gitlab.com/api/issues/).
