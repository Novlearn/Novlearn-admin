param()
$ErrorActionPreference='Stop'
$rootTaskPath=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$dockerTaskPath=Join-Path $env:LOCALAPPDATA 'Programs/DockerDesktop/resources/bin/docker.exe'
$artifactTaskPath=Join-Path $rootTaskPath ('.local/lot1a/creator-runtime-'+[datetime]::UtcNow.ToString('yyyyMMddHHmmssfff'))
New-Item -ItemType Directory -Path $artifactTaskPath | Out-Null
$packedTaskJson=& npm.cmd pack ./node_modules/@cortex-js/compute-engine ./node_modules/@arnog/colors ./node_modules/complex.js --ignore-scripts --cache (Join-Path $rootTaskPath '.npm-cache') --pack-destination $artifactTaskPath --json
if($LASTEXITCODE -ne 0) {throw 'Offline dependency packaging failed'}
$packedTask=$packedTaskJson -join "`n" | ConvertFrom-Json
$targetsTask=@{'@cortex-js/compute-engine'='/archives/cortex.tgz';'@arnog/colors'='/archives/colors.tgz';'complex.js'='/archives/complex.tgz'}
$archiveTaskPath=Join-Path $rootTaskPath 'vendor/novlearn-exercise-engine-0.1.0.tgz'
$hashTask=(Get-FileHash -LiteralPath $archiveTaskPath).Hash.ToLowerInvariant()
if($hashTask -ne '650128cdeb1e798b952a09e91b038d018b9e7947d0a6ee4c247695f899190290') {throw 'Engine archive differs from certified artifact'}
$mountsTask=@(@($archiveTaskPath,'/archives/engine.tgz'),@((Join-Path $PSScriptRoot 'engine-runtime-setup.mjs'),'/inputs/setup.mjs'),@((Join-Path $PSScriptRoot 'engine-runtime-test.mjs'),'/inputs/runtime-test.mjs'),@((Join-Path $rootTaskPath 'src/lib/engine-runtime.ts'),'/inputs/engine-runtime.ts'),@((Join-Path $rootTaskPath 'node_modules/server-only'),'/inputs/server-only'))
foreach($packageTask in $packedTask) {
  if(-not $targetsTask.ContainsKey($packageTask.name)) {throw 'Unexpected offline package'}
  $mountsTask+=,@((Join-Path $artifactTaskPath $packageTask.filename),$targetsTask[$packageTask.name])
}
if($packedTask.Count -ne 3) {throw 'Missing offline dependencies'}
$dockerTaskArgs=@('--host','npipe:////./pipe/dockerDesktopLinuxEngine','run','--pull','never','--rm','--init','--network','none','--memory','384m','--memory-swap','384m','--pids-limit','64','--read-only','--cap-drop','ALL','--security-opt','no-new-privileges','--user','65534:65534','--workdir','/consumer','--tmpfs','/consumer:rw,nosuid,nodev,noexec,size=192m,mode=1777')
foreach($mountTask in $mountsTask) {$dockerTaskArgs+=@('--mount',"type=bind,source=$($mountTask[0]),target=$($mountTask[1]),readonly")}
$dockerTaskArgs+=@('node:24.19.0-bookworm@sha256:4196d66a565c6f195728d9952f161f4adfe2ad753052a08b7ec7f1c5a6bda42b','node','/inputs/setup.mjs')
$outputTask=& $dockerTaskPath @dockerTaskArgs
if($LASTEXITCODE -ne 0) {throw 'Creator runtime qualification failed'}
$proofTask=$outputTask -join "`n" | ConvertFrom-Json
if($proofTask.result -ne 'PASS') {throw 'Runtime proof is incomplete'}
$proofTask | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $artifactTaskPath 'proof.json') -Encoding UTF8
Write-Output "PASS: Admin runtime adapter in bounded Linux Docker; proof=$artifactTaskPath"
