param(
  [Parameter(Mandatory=$true)]
  [ValidatePattern('^novlearn-admin-lot1a-(replay|backup)-[0-9]{17}$')][string]$Container,
  [ValidateSet('postgres','admin_backup_restore')][string]$Database='postgres'
)
$ErrorActionPreference='Stop'
$dockerTaskPath=Join-Path $env:LOCALAPPDATA 'Programs/DockerDesktop/resources/bin/docker.exe'
$endpointTask='npipe:////./pipe/dockerDesktopLinuxEngine'
$statusTask=& $dockerTaskPath --host $endpointTask inspect --format '{{.State.Running}}' $Container
if($LASTEXITCODE -ne 0) { throw 'Isolated fixture container is missing' }
$startedTask=$statusTask -ne 'true'
try {
  if($startedTask) {
    & $dockerTaskPath --host $endpointTask start $Container | Out-Null
    if($LASTEXITCODE -ne 0) { throw 'Cannot start isolated fixture' }
  }
  $readyTask=$false
  for($attemptTask=0;$attemptTask -lt 30;$attemptTask++) {
    & $dockerTaskPath --host $endpointTask exec $Container pg_isready -h 127.0.0.1 -U supabase_admin -d $Database *> $null
    if($LASTEXITCODE -eq 0) { $readyTask=$true;break }
    Start-Sleep -Seconds 1
  }
  if(-not $readyTask) {throw 'Isolated PostgreSQL not ready'}
  & $dockerTaskPath --host $endpointTask cp (Join-Path $PSScriptRoot 'test-catalogue-local.sql') ($Container+':/tmp/admin-catalogue-tests.sql')
  if($LASTEXITCODE -ne 0) {throw 'Cannot copy synthetic tests'}
  & $dockerTaskPath --host $endpointTask exec $Container psql -qAt -U supabase_admin -d $Database -v ON_ERROR_STOP=1 -f /tmp/admin-catalogue-tests.sql
  if($LASTEXITCODE -ne 0) {throw 'Catalogue SQL assertions failed'}
} finally {
  if($startedTask) { & $dockerTaskPath --host $endpointTask stop --timeout 15 $Container | Out-Null }
}
