param()
$ErrorActionPreference='Stop'
$rootTaskPath=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$standaloneTaskPath=Join-Path $rootTaskPath '.next/standalone'
if(-not (Test-Path -LiteralPath (Join-Path $standaloneTaskPath 'server.js'))) {throw 'Build the standalone first'}
$dockerTaskPath=Join-Path $env:LOCALAPPDATA 'Programs/DockerDesktop/resources/bin/docker.exe'
$artifactTaskPath=Join-Path $rootTaskPath ('.local/lot1a/creator-standalone-'+[datetime]::UtcNow.ToString('yyyyMMddHHmmssfff'))
New-Item -ItemType Directory -Path $artifactTaskPath | Out-Null
$dockerTaskArgs=@('--host','npipe:////./pipe/dockerDesktopLinuxEngine','run','--pull','never','--rm','--init','--network','none','--memory','384m','--memory-swap','384m','--pids-limit','64','--read-only','--cap-drop','ALL','--security-opt','no-new-privileges','--user','65534:65534','--workdir','/app','--tmpfs','/tmp:rw,nosuid,nodev,noexec,size=64m,mode=1777','--mount',"type=bind,source=$standaloneTaskPath,target=/app,readonly",'--mount',"type=bind,source=$PSScriptRoot,target=/inputs,readonly",'node:24.19.0-bookworm@sha256:4196d66a565c6f195728d9952f161f4adfe2ad753052a08b7ec7f1c5a6bda42b','node','/inputs/engine-standalone-test.mjs')
$outputTask=& $dockerTaskPath @dockerTaskArgs
if($LASTEXITCODE -ne 0) {throw 'Standalone Engine worker qualification failed'}
$proofTask=$outputTask -join "`n" | ConvertFrom-Json
if($proofTask.result -ne 'PASS') {throw 'Invalid standalone qualification evidence'}
$proofTask | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $artifactTaskPath 'proof.json') -Encoding UTF8
Write-Output "PASS: actual standalone worker and dependencies; proof=$artifactTaskPath"
