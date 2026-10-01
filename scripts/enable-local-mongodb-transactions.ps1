#Requires -RunAsAdministrator
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$mongoConfigPath = 'C:\Program Files\MongoDB\Server\8.3\bin\mongod.cfg'
$projectPath = Split-Path -Parent $PSScriptRoot
$configText = [System.IO.File]::ReadAllText($mongoConfigPath)

if ($configText -match '(?m)^replication\s*:') {
  if ($configText -notmatch '(?m)^\s+replSetName:\s*swiftdu-rs\s*$') {
    throw 'A different replication configuration already exists. Review it before continuing.'
  }
} else {
  $backupPath = $mongoConfigPath + '.before-replica-set-' + (Get-Date -Format 'yyyyMMdd-HHmmss')
  Copy-Item -LiteralPath $mongoConfigPath -Destination $backupPath
  $updatedConfig = $configText.TrimEnd() + "`r`n`r`nreplication:`r`n  replSetName: swiftdu-rs`r`n"
  [System.IO.File]::WriteAllText($mongoConfigPath, $updatedConfig)
  Write-Output "Configuration backup: $backupPath"
}

Restart-Service -Name MongoDB
(Get-Service -Name MongoDB).WaitForStatus('Running', [TimeSpan]::FromSeconds(30))

Push-Location -LiteralPath $projectPath
try {
  & node scripts/initialize-local-mongodb-replica.mjs
  if ($LASTEXITCODE -ne 0) { throw 'Replica set initialization or transaction verification failed.' }
} finally {
  Pop-Location
}
