$ErrorActionPreference = 'Stop'
$pluginDirectory = Join-Path $PSScriptRoot 'plugins/seabury-gitlab'
foreach ($requiredCommand in @('node', 'npm.cmd', 'codex')) {
    if (-not (Get-Command $requiredCommand -ErrorAction SilentlyContinue)) {
        throw "Required command missing: $requiredCommand. Install Node.js and the Codex CLI, then reopen PowerShell."
    }
}
& node --use-system-ca -e 'process.exit(0)'
if ($LASTEXITCODE -ne 0) { throw 'Your Node.js version does not support --use-system-ca. Install Node.js 24 or newer.' }
Push-Location $pluginDirectory
try {
    & npm.cmd ci --ignore-scripts
    if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed.' }
    & npm.cmd test
    if ($LASTEXITCODE -ne 0) { throw 'Plugin verification failed.' }
} finally { Pop-Location }
& codex plugin marketplace add $PSScriptRoot
if ($LASTEXITCODE -ne 0) { throw 'Marketplace registration failed.' }
& codex plugin add 'seabury-gitlab@seabury-local'
if ($LASTEXITCODE -ne 0) { throw 'Plugin installation failed.' }
Write-Host 'Installed Seabury GitLab. Run plugins/seabury-gitlab/Connect-GitLab.cmd to connect your account, then open a new Codex chat.'
