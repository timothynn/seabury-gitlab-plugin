$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSHOME 'Modules/Microsoft.PowerShell.Security/Microsoft.PowerShell.Security.psd1') -ErrorAction Stop
Write-Host 'Create a personal access token with api scope and an expiry at:'
Write-Host 'https://gitlab.seaburymro.com/-/profile/personal_access_tokens'
Write-Host 'The token is entered invisibly and encrypted for your Windows account.'
$secureToken = Read-Host 'GitLab personal access token' -AsSecureString
$pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureToken)
try {
    $plainToken = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
    try {
        $user = Invoke-RestMethod -Uri 'https://gitlab.seaburymro.com/api/v4/user' -Headers @{'PRIVATE-TOKEN'=$plainToken} -MaximumRedirection 0 -TimeoutSec 30
    } catch { throw 'Token verification failed. Check the token, expiry, network/VPN and GitLab access. No credential was saved.' }
    $credentialDirectory = Join-Path $env:LOCALAPPDATA 'SeaburyGitLab'
    New-Item -ItemType Directory -Path $credentialDirectory -Force | Out-Null
    $secureToken | ConvertFrom-SecureString | Set-Content -LiteralPath (Join-Path $credentialDirectory 'token.dpapi') -Encoding ASCII
    Write-Host ('Connected as ' + $user.username + '. Your token is saved encrypted. Open a new Codex chat to use Seabury GitLab.')
} finally {
    $plainToken = $null
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
}
