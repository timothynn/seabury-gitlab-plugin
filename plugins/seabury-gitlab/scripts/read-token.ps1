$ErrorActionPreference = 'Stop'
# Node may inherit PowerShell 7's PSModulePath while launching Windows PowerShell.
Import-Module (Join-Path $PSHOME 'Modules/Microsoft.PowerShell.Security/Microsoft.PowerShell.Security.psd1') -ErrorAction Stop
$tokenPath = Join-Path $env:LOCALAPPDATA 'SeaburyGitLab/token.dpapi'
$secureToken = (Get-Content -LiteralPath $tokenPath -Raw).Trim() | ConvertTo-SecureString
$pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureToken)
try { [Console]::Out.Write([Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)) }
finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
