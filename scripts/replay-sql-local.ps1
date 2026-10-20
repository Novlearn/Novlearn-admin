# Reuse the canonical local replay workflow with a pinned, bounded fixture.
# Only a NEW network-isolated container is mutated; all existing services remain.
param(
  [ValidatePattern('^[A-Za-z0-9_-]+$')][string]$SourceAuthContainer = 'novlearn-admin-local-1792143739689-auth'
)
$ErrorActionPreference = 'Stop'
$repoTaskPath = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../Novlearn'))
$dockerTaskCommand = Get-Command docker -ErrorAction SilentlyContinue
$dockerTaskPath = if ($dockerTaskCommand) { $dockerTaskCommand.Source } else {
  Join-Path $env:LOCALAPPDATA 'Programs/DockerDesktop/resources/bin/docker.exe'
}
if (-not (Test-Path -LiteralPath $dockerTaskPath)) { throw 'Docker executable unavailable' }
$containerTaskName = 'novlearn-admin-lot1a-replay-' + [DateTime]::UtcNow.ToString('yyyyMMddHHmmssfff')
# No command may target a remote Docker daemon, even through CLI environment.
$dockerTaskContext = & $dockerTaskPath context show
if ($LASTEXITCODE -ne 0) { throw 'Docker context unavailable' }
$dockerTaskEndpoint = if ($env:DOCKER_HOST -and -not $env:DOCKER_CONTEXT) { $env:DOCKER_HOST } else {
  & $dockerTaskPath context inspect $dockerTaskContext --format '{{.Endpoints.docker.Host}}'
}
if ($LASTEXITCODE -ne 0 -or $dockerTaskEndpoint -notmatch '^npipe:/{2,}[.]/pipe/[a-zA-Z0-9_-]+$') {
  throw 'Local certification accepts only a local Windows Docker named-pipe endpoint'
}
$artifactTaskPath = Join-Path $repoTaskPath ".local/admin-sql-replay/$containerTaskName"
New-Item -ItemType Directory -Path $artifactTaskPath -Force | Out-Null
$logTaskPath = Join-Path $artifactTaskPath 'replay.log'
$authBinaryTaskPath = Join-Path $artifactTaskPath 'auth-fixture'
$migrationsTaskPath = Join-Path $repoTaskPath 'supabase/migrations'
$files = Get-ChildItem -LiteralPath $migrationsTaskPath -Filter '*.sql' | Sort-Object Name
$manifest = @($files | ForEach-Object { @{ name=$_.Name; sha256=(Get-FileHash -LiteralPath $_.FullName).Hash.ToLowerInvariant() } })
$manifest | ConvertTo-Json -Depth 3 | Set-Content -LiteralPath (Join-Path $artifactTaskPath 'manifest.json') -Encoding UTF8
function Invoke-DockerChecked([string[]]$DockerArguments) {
  $savedPreference = $ErrorActionPreference
  try {
    $ErrorActionPreference = 'Continue'
    & $dockerTaskPath @DockerArguments *>> $logTaskPath
    $nativeCode = $LASTEXITCODE
  } finally { $ErrorActionPreference = $savedPreference }
  if ($nativeCode -ne 0) { throw "Docker/psql failed with code $nativeCode; see $logTaskPath" }
}
$created = $false
try {
  # Read only the installed official Auth executable, never service credentials.
  $authImage = & $dockerTaskPath inspect --format '{{.Config.Image}}' $SourceAuthContainer
  if ($LASTEXITCODE -ne 0 -or $authImage -ne 'public.ecr.aws/supabase/gotrue@sha256:1736a63078f5922b198c4cbe50f80ab9a2d3b54fe8b7b6cfb2e9dc5dbbc12c6b') {
    throw 'This local certification requires the exact installed official Auth image digest'
  }
  Invoke-DockerChecked @('cp',($SourceAuthContainer + ':/usr/local/bin/auth'),$authBinaryTaskPath)
  @{ image=$authImage; binarySha256=(Get-FileHash -LiteralPath $authBinaryTaskPath).Hash.ToLowerInvariant();
    command='auth migrate'; transport='Unix socket'; sqlRole='supabase_auth_admin'; network='none' } |
    ConvertTo-Json | Set-Content -LiteralPath (Join-Path $artifactTaskPath 'auth-bootstrap.json') -Encoding UTF8
  Invoke-DockerChecked @('run','--detach','--pull','never','--name',$containerTaskName,
    '--network','none','--cpus','2','--memory','1g','--memory-swap','1g','--pids-limit','256','--env','POSTGRES_PASSWORD=local-fixture-only','--env','POSTGRES_DB=postgres',
    '--mount',"type=bind,source=$migrationsTaskPath,target=/fixture-migrations,readonly",
    '--mount',"type=bind,source=$artifactTaskPath,target=/fixture-bootstrap,readonly",
    'public.ecr.aws/supabase/postgres@sha256:7374d196da7e301512cc5329e18040e0f7bb856287b323777cdadecccbc6c7e4')
  $created = $true
  $ready = $false
  for ($attempt = 0; $attempt -lt 30; $attempt++) {
    # The image starts a temporary Unix-only server during initialization.
    # Wait for the final TCP listener, otherwise init can restart mid-migration.
    & $dockerTaskPath exec $containerTaskName pg_isready -h 127.0.0.1 -U supabase_admin -d postgres *>> $logTaskPath
    if ($LASTEXITCODE -eq 0) { $ready = $true; break }
    Start-Sleep -Seconds 1
  }
  if (-not $ready) { throw 'Fresh PostgreSQL did not become ready' }
  Invoke-DockerChecked @('cp',$authBinaryTaskPath,($containerTaskName + ':/tmp/auth-fixture'))
  Invoke-DockerChecked @('exec',$containerTaskName,'chmod','700','/tmp/auth-fixture')
  Invoke-DockerChecked @('exec','-e','GOTRUE_DB_DRIVER=postgres',
    '-e','GOTRUE_DB_DATABASE_URL=postgres://supabase_admin@localhost/postgres?host=/run/postgresql&sslmode=disable&options=-crole%3Dsupabase_auth_admin',
    '-e','GOTRUE_DB_NAMESPACE=auth','-e','API_EXTERNAL_URL=http://127.0.0.1:9999',
    '-e','GOTRUE_SITE_URL=http://127.0.0.1:3000',
    '-e','GOTRUE_JWT_SECRET=local-fixture-only-at-least-32-characters-long',
    $containerTaskName,'/tmp/auth-fixture','migrate')
  foreach ($file in $files) {
    Invoke-DockerChecked @('exec',$containerTaskName,'psql','-U','supabase_admin','-d','postgres',
      '-v','ON_ERROR_STOP=1','-f',"/fixture-migrations/$($file.Name)")
  }
  foreach ($entry in $manifest) {
    if ((Get-FileHash -LiteralPath (Join-Path $migrationsTaskPath $entry.name)).Hash.ToLowerInvariant() -ne $entry.sha256) {
      throw "Concurrent migration edit: $($entry.name)"
    }
  }
  Write-Output "PASS: $($files.Count) migrations; fresh network-isolated PostgreSQL; hashes stable. Artifacts: $artifactTaskPath"
} finally {
  # Stop only this new container. Preserve its volume; never reset the source DB.
  if ($created) { Invoke-DockerChecked @('stop','--timeout','15',$containerTaskName) }
}
