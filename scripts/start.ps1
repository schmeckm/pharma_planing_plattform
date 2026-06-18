# Hard Allocation Platform — unified startup
#
# Usage:
#   .\scripts\start.ps1 dev           # Backend + Cockpit (Haupt-Portal)
#   .\scripts\start.ps1 backend       # nur Node-Backend (+ OR-Tools wenn .env)
#   .\scripts\start.ps1 cockpit       # nur Vue-Cockpit (Port 3001)
#   .\scripts\start.ps1 docker        # docker compose up (build + detach)
#   .\scripts\start.ps1 docker:mvp2   # docker compose mit MVP 2.0 overlay
#   .\scripts\start.ps1 docker:mvp3   # docker compose mit MVP 3.0 (Neo4j + Kafka)
#   .\scripts\start.ps1 docker:down   # docker compose down
#   .\scripts\start.ps1 stop          # lokale Node-Prozesse beenden
#   .\scripts\start.ps1 status        # was läuft gerade
#   .\scripts\start.ps1 test          # smoke + e2e tests
#
# Optionale Parameter:
#   -BackendPort 8000      Port für das Node-Backend (Default 8000)
#   -CockpitPort 3001      Port für das Cockpit-Frontend (Default 3001)
#   -NoCockpit             Nur Backend starten (ohne UI)
#   -Detached              Lokale Dienste in separaten Fenstern statt im aktuellen Job

[CmdletBinding()]
param(
  [Parameter(Position = 0)]
  [ValidateSet('dev', 'backend', 'ortools', 'cockpit', 'docker', 'docker:mvp2', 'docker:mvp3', 'docker:down', 'stop', 'status', 'test', 'help')]
  [string]$Mode = 'help',

  [int]$BackendPort = 8000,
  [int]$CockpitPort = 3001,
  [switch]$NoCockpit,
  [switch]$Detached
)

$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectRoot

# ── helpers ────────────────────────────────────────────────────────────
function Write-Step($msg) { Write-Host "==> $msg" -ForegroundColor Cyan }
function Write-Ok($msg) { Write-Host "  $msg" -ForegroundColor Green }
function Write-Warn2($msg) { Write-Host "  $msg" -ForegroundColor Yellow }
function Write-Err($msg) { Write-Host "  $msg" -ForegroundColor Red }

function Test-Command($name) {
  return [bool](Get-Command $name -ErrorAction SilentlyContinue)
}

function Wait-Health($url, $timeoutSec = 30) {
  $sw = [Diagnostics.Stopwatch]::StartNew()
  while ($sw.Elapsed.TotalSeconds -lt $timeoutSec) {
    try {
      $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2
      if ($r.StatusCode -eq 200) { return $true }
    } catch { Start-Sleep -Milliseconds 500 }
  }
  return $false
}

function Stop-PortListener($port) {
  $found = $false
  $conns = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
  foreach ($c in $conns) {
    try {
      $p = Get-Process -Id $c.OwningProcess -ErrorAction SilentlyContinue
      if ($p) {
        Write-Warn2 "Beende $($p.ProcessName) (PID $($p.Id)) auf Port $port"
        Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
        $found = $true
      }
    } catch {}
  }
  return $found
}

function Ensure-Dependencies($dir) {
  $pkg = Join-Path $dir 'package.json'
  $nm = Join-Path $dir 'node_modules'
  if ((Test-Path $pkg) -and -not (Test-Path $nm)) {
    Write-Step "npm install in $dir"
    Push-Location $dir
    try { npm install --silent } finally { Pop-Location }
  }
}

function Get-RuntimeDir {
  $d = Join-Path $ProjectRoot '.runtime'
  if (-not (Test-Path $d)) { New-Item -ItemType Directory -Path $d -Force | Out-Null }
  $l = Join-Path $d 'logs'
  if (-not (Test-Path $l)) { New-Item -ItemType Directory -Path $l -Force | Out-Null }
  return $d
}

function ConvertTo-Hashtable($obj) {
  # PowerShell 5.x kompatibel — PSCustomObject in Hashtable umwandeln
  $h = @{}
  if ($null -eq $obj) { return $h }
  foreach ($p in $obj.PSObject.Properties) { $h[$p.Name] = $p.Value }
  return $h
}

function Save-Pid($name, $procId) {
  $d = Get-RuntimeDir
  $file = Join-Path $d 'pids.json'
  $map = @{}
  if (Test-Path $file) {
    try {
      $raw = Get-Content -Raw $file
      if ($raw) { $map = ConvertTo-Hashtable (ConvertFrom-Json $raw) }
    } catch { $map = @{} }
  }
  $map[$name] = $procId
  ($map | ConvertTo-Json) | Set-Content -Path $file -Encoding UTF8
}

function Get-SavedPids {
  $d = Get-RuntimeDir
  $file = Join-Path $d 'pids.json'
  if (-not (Test-Path $file)) { return @{} }
  try {
    $raw = Get-Content -Raw $file
    if (-not $raw) { return @{} }
    return ConvertTo-Hashtable (ConvertFrom-Json $raw)
  } catch { return @{} }
}

function Clear-SavedPids {
  $file = Join-Path (Get-RuntimeDir) 'pids.json'
  if (Test-Path $file) { Remove-Item $file -Force }
}

function Start-LocalProcess($name, $workDir, $cmd, $cmdArgs, $envVars) {
  $logDir = Join-Path (Get-RuntimeDir) 'logs'
  $logFile = Join-Path $logDir "$name.log"

  if ($Detached) {
    # Sichtbares Fenster — Env via PowerShell-Wrapper setzen, dann Befehl ausführen
    $envBlock = ''
    foreach ($k in $envVars.Keys) { $envBlock += "`$env:$k = '$($envVars[$k])'; " }
    $argStr = ($cmdArgs | ForEach-Object { '"' + $_ + '"' }) -join ' '
    $shellCmd = "$envBlock Set-Location '$workDir'; Write-Host '=== $name ===' -ForegroundColor Cyan; & '$cmd' $argStr"
    $proc = Start-Process powershell.exe -ArgumentList '-NoExit', '-NoProfile', '-Command', $shellCmd -WindowStyle Normal -PassThru
    Write-Ok "$name als sichtbares Fenster gestartet (PID $($proc.Id))"
    Save-Pid $name $proc.Id
    return $proc
  }

  # Versteckter Modus: cmd /c start /B löst den Kindprozess komplett vom Eltern-Powershell.
  # Argumente quoten, damit Pfade mit Leerzeichen funktionieren.
  $quotedArgs = ($cmdArgs | ForEach-Object { '"' + $_ + '"' }) -join ' '

  # Env-Variablen als 'set KEY=VAL & ...' in den cmd.exe-Kontext schreiben
  $setEnv = ''
  foreach ($k in $envVars.Keys) {
    $setEnv += "set ""$k=$($envVars[$k])"" && "
  }

  # marker-Datei erlaubt es uns, die PID des frisch gestarteten Kindprozesses zu finden
  $markerFile = Join-Path (Get-RuntimeDir) "$name.marker"
  if (Test-Path $markerFile) { Remove-Item $markerFile -Force }

  # Vor dem eigentlichen Befehl: PID in marker schreiben, dann Befehl ausführen
  $cmdLine = "cd /d ""$workDir"" && $setEnv (echo %^^ERRORLEVEL%>nul) && (call echo %%^^PID%%>""$markerFile"" 2>nul) && ""$cmd"" $quotedArgs > ""$logFile"" 2>&1"
  # Robusterer Ansatz: wir nutzen wmic, um die PID nach dem Spawn rauszufinden.
  # Stattdessen: Start-Process mit cmd.exe als Host, kein WindowStyle Hidden weil das die TTY-Detection bei Node OK lässt.
  $proc = Start-Process -FilePath 'cmd.exe' `
    -ArgumentList @('/c', "$setEnv ""$cmd"" $quotedArgs > ""$logFile"" 2>&1") `
    -WorkingDirectory $workDir -WindowStyle Hidden -PassThru

  # Die zurückgegebene PID ist die von cmd.exe. Wir finden den echten Kindprozess (node, npm) als Child.
  Start-Sleep -Milliseconds 800
  $childPid = $proc.Id
  $child = Get-CimInstance Win32_Process -Filter "ParentProcessId=$($proc.Id)" -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($child) { $childPid = [int]$child.ProcessId }

  Write-Ok "$name gestartet (PID $childPid via cmd $($proc.Id), Log: $logFile)"
  Save-Pid $name $proc.Id   # cmd.exe-PID merken — beim Stop killen wir Eltern + Kind
  return $proc
}

# ── modes ──────────────────────────────────────────────────────────────

function Load-EnvFile {
  $envFile = Join-Path $ProjectRoot '.env'
  if (-not (Test-Path $envFile)) { return }
  foreach ($line in Get-Content $envFile) {
    if ($line -match '^\s*#' -or $line -notmatch '^\s*([^=]+)=(.*)$') { continue }
    $key = $Matches[1].Trim()
    $val = $Matches[2].Trim().Trim('"').Trim("'")
    if (-not [string]::IsNullOrWhiteSpace($key) -and -not (Get-Item -Path "env:$key" -ErrorAction SilentlyContinue)) {
      Set-Item -Path "env:$key" -Value $val
    }
  }
}

function Ensure-OrtoolsIfConfigured {
  if ($env:SCHEDULING_OPTIMIZER -ne 'ortools') { return $false }
  if (Wait-Health "http://127.0.0.1:8010/health" 2) {
    if (-not $env:ORTOOLS_URL) { $env:ORTOOLS_URL = 'http://127.0.0.1:8010' }
    return $true
  }
  $ok = Mode-Ortools
  if ($ok) {
    $env:SCHEDULING_OPTIMIZER = 'ortools'
    if (-not $env:ORTOOLS_URL) { $env:ORTOOLS_URL = 'http://127.0.0.1:8010' }
  } else {
    Write-Warn2 "SCHEDULING_OPTIMIZER=ortools, aber Sidecar nicht erreichbar — Backend nutzt Heuristik-Fallback"
  }
  return $ok
}

function Mode-Help {
  Get-Content -Path $PSCommandPath -TotalCount 25 | ForEach-Object { $_ -replace '^# ?', '' }
}

function Mode-Ortools {
  param([int]$Port = 8010)
  if (-not (Test-Command 'python')) {
    Write-Warn2 "Python nicht gefunden — OR-Tools Sidecar übersprungen (SCHEDULING_OPTIMIZER=heuristic)"
    return $false
  }
  Write-Step "OR-Tools Sidecar starten auf Port $Port"
  Stop-PortListener $Port | Out-Null
  $ortoolsDir = Join-Path $ProjectRoot 'scripts\ortools'
  $reqFile = Join-Path $ortoolsDir 'requirements.txt'
  if (Test-Path $reqFile) {
    Write-Ok "Prüfe Python-Abhängigkeiten (ortools, fastapi, uvicorn)..."
    Push-Location $ortoolsDir
    try {
      python -m pip install -q -r requirements.txt 2>$null
    } catch {
      Write-Warn2 "pip install fehlgeschlagen — Sidecar evtl. nicht verfügbar"
    } finally { Pop-Location }
  }
  $logDir = Join-Path (Get-RuntimeDir) 'logs'
  $logFile = Join-Path $logDir 'ortools.log'
  $errFile = Join-Path $logDir 'ortools.err.log'
  $proc = Start-Process -FilePath 'python' `
    -ArgumentList @('-m', 'uvicorn', 'app:app', '--host', '127.0.0.1', '--port', "$Port") `
    -WorkingDirectory $ortoolsDir -WindowStyle Hidden `
    -RedirectStandardOutput $logFile -RedirectStandardError $errFile -PassThru
  Write-Ok "ortools gestartet (PID $($proc.Id), Log: $logFile)"
  Save-Pid 'ortools' $proc.Id
  if (Wait-Health "http://127.0.0.1:$Port/health" 45) {
    Write-Ok "OR-Tools live: http://127.0.0.1:$Port/health"
    return $true
  }
  Write-Warn2 "OR-Tools Sidecar nicht erreichbar — Backend nutzt Heuristik-Fallback"
  return $false
}

function Mode-Backend {
  Ensure-OrtoolsIfConfigured | Out-Null

  Write-Step "Backend starten auf Port $BackendPort"
  Stop-PortListener $BackendPort | Out-Null
  Ensure-Dependencies $ProjectRoot
  $logDir = Join-Path (Get-RuntimeDir) 'logs'
  $logFile = Join-Path $logDir 'backend.log'
  $errFile = Join-Path $logDir 'backend.err.log'
  $env:PORT = "$BackendPort"
  $env:HOST = '127.0.0.1'
  if (-not $env:SCHEDULING_OPTIMIZER) { $env:SCHEDULING_OPTIMIZER = 'heuristic' }
  $proc = Start-Process -FilePath 'node' `
    -ArgumentList @('server.js') `
    -WorkingDirectory $ProjectRoot -WindowStyle Hidden `
    -RedirectStandardOutput $logFile -RedirectStandardError $errFile -PassThru
  Write-Ok "backend gestartet (PID $($proc.Id), Log: $logFile)"
  Save-Pid 'backend' $proc.Id
  if (Wait-Health "http://127.0.0.1:$BackendPort/health" 30) {
    Write-Ok "Backend live: http://127.0.0.1:$BackendPort/health"
    Write-Ok "Docs:         http://127.0.0.1:$BackendPort/docs"
    return $true
  }
  Write-Err "Backend-Healthcheck nach 30s nicht erreichbar — check $logFile und $errFile"
  return $false
}

function Mode-Cockpit {
  param(
    [int]$Port = $CockpitPort,
    [int]$ApiPort = $BackendPort
  )
  Write-Step "Cockpit (Vue) starten auf Port $Port"
  Stop-PortListener $Port | Out-Null
  $cockpitDir = Join-Path $ProjectRoot 'cockpit'
  Ensure-Dependencies $cockpitDir
  $viteBin = Join-Path $cockpitDir 'node_modules\vite\bin\vite.js'
  if (-not (Test-Path $viteBin)) {
    Write-Err "Cockpit: vite fehlt — cd cockpit && npm install"
    return $false
  }
  $logDir = Join-Path (Get-RuntimeDir) 'logs'
  $logFile = Join-Path $logDir 'cockpit.log'
  $errFile = Join-Path $logDir 'cockpit.err.log'
  $env:VITE_API_PROXY = "http://127.0.0.1:$ApiPort"
  $env:VITE_DEV_PORT = "$Port"
  # Relativer Pfad — Start-Process zerlegt absolute Pfade mit Leerzeichen (OneDrive)
  $proc = Start-Process -FilePath 'node' `
    -ArgumentList @('node_modules\vite\bin\vite.js', '--port', "$Port", '--host', '0.0.0.0') `
    -WorkingDirectory $cockpitDir -WindowStyle Hidden `
    -RedirectStandardOutput $logFile -RedirectStandardError $errFile -PassThru
  Write-Ok "cockpit gestartet (PID $($proc.Id), Log: $logFile)"
  Save-Pid 'cockpit' $proc.Id
  if (Wait-Health "http://127.0.0.1:$Port/" 30) {
    Write-Ok "Cockpit live: http://127.0.0.1:$Port/wizard"
    return $true
  }
  Write-Err "Cockpit nicht erreichbar — check $logFile und $errFile"
  return $false
}

function Mode-Dev {
  Write-Step "Hard Allocation Platform — Dev-Mode"

  if ($env:SCHEDULING_OPTIMIZER -eq 'ortools') {
    Ensure-OrtoolsIfConfigured | Out-Null
  } else {
    $ortoolsOk = Mode-Ortools
    if ($ortoolsOk) {
      $env:SCHEDULING_OPTIMIZER = 'ortools'
      $env:ORTOOLS_URL = 'http://127.0.0.1:8010'
    }
  }

  Mode-Backend | Out-Null

  # Cockpit (Vue)
  if (-not $NoCockpit -and (Test-Path 'cockpit\package.json')) {
    Mode-Cockpit -Port $CockpitPort -ApiPort $BackendPort | Out-Null
  }

  Write-Host ""
  Write-Step "Status:"
  Write-Ok "Backend:  http://127.0.0.1:$BackendPort"
  if ($env:SCHEDULING_OPTIMIZER -eq 'ortools' -and (Wait-Health "http://127.0.0.1:8010/health" 2)) {
    Write-Ok "OR-Tools: http://127.0.0.1:8010/health"
  }
  if (-not $NoCockpit) {
    Write-Host "  >>> Cockpit: http://127.0.0.1:$CockpitPort/wizard" -ForegroundColor Green
  }
  Write-Host ""
  if (-not $Detached) {
    Write-Warn2 "Prozesse laufen im Hintergrund weiter. Stoppen mit: .\scripts\start.ps1 stop"
    Write-Warn2 "Logs: .runtime\logs\*.log     |    PIDs: .runtime\pids.json"
  }
}

function Mode-Docker($composeArgs) {
  if (-not (Test-Command 'docker')) {
    Write-Err "Docker ist nicht installiert oder nicht im PATH"
    exit 1
  }
  $null = docker info --format '{{.ServerVersion}}' 2>$null
  if ($LASTEXITCODE -ne 0) {
    Write-Err "Docker-Daemon nicht erreichbar — starte Docker Desktop"
    exit 1
  }
  Write-Step "docker compose $composeArgs"
  $cmd = "docker compose $composeArgs"
  Invoke-Expression $cmd
  if ($LASTEXITCODE -eq 0 -and $composeArgs -notlike '*down*') {
    Write-Ok "Container laufen. Stoppen mit: .\scripts\start.ps1 docker:down"
    Write-Ok "Backend:  http://localhost:8000   (BACKEND_PORT env override möglich)"
    Write-Host "  >>> Cockpit: http://localhost:3001/wizard" -ForegroundColor Green
  }
}

function Mode-Stop {
  Write-Step "Lokale Dienste beenden"
  $stopped = 0

  # 1) getrackte PIDs aus pids.json
  $pids = Get-SavedPids
  foreach ($name in $pids.Keys) {
    $procId = [int]$pids[$name]
    $p = Get-Process -Id $procId -ErrorAction SilentlyContinue
    if ($p) {
      # Kind-Prozesse (z.B. npm -> node) zuerst beenden
      Get-CimInstance Win32_Process -Filter "ParentProcessId=$procId" -ErrorAction SilentlyContinue |
        ForEach-Object {
          Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
        }
      Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
      Write-Ok "$name (PID $procId) beendet"
      $stopped++
    }
  }
  Clear-SavedPids

  # 2) Fallback: alles auf den bekannten Ports töten
  foreach ($p in @($BackendPort, $CockpitPort, 8010)) {
    if (Stop-PortListener $p) { $stopped++ }
  }

  if ($stopped -eq 0) {
    Write-Ok "Nichts zu stoppen"
  }
}

function Mode-Status {
  Write-Step "Getrackte Prozesse"
  $pids = Get-SavedPids
  if ($pids.Count -gt 0) {
    foreach ($name in $pids.Keys) {
      $procId = [int]$pids[$name]
      $p = Get-Process -Id $procId -ErrorAction SilentlyContinue
      if ($p) {
        Write-Ok "$name  PID $procId  ($($p.ProcessName))"
      } else {
        Write-Warn2 "$name  PID $procId  (nicht mehr aktiv)"
      }
    }
  } else {
    Write-Warn2 "Keine getrackten Prozesse (.runtime\pids.json fehlt)"
  }

  Write-Step "Ports"
  foreach ($p in @($BackendPort, $CockpitPort, 8010)) {
    $c = Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue
    if ($c) {
      $proc = Get-Process -Id ($c[0].OwningProcess) -ErrorAction SilentlyContinue
      Write-Ok "Port $p  belegt von $($proc.ProcessName) (PID $($proc.Id))"
    } else {
      Write-Warn2 "Port $p  frei"
    }
  }

  if (Wait-Health "http://127.0.0.1:8010/health" 2) {
    Write-Ok "OR-Tools Sidecar: http://127.0.0.1:8010/health"
  } elseif ($env:SCHEDULING_OPTIMIZER -eq 'ortools') {
    Write-Warn2 "OR-Tools Sidecar nicht erreichbar (SCHEDULING_OPTIMIZER=ortools)"
  }

  if (Test-Command 'docker') {
    Write-Step "Docker"
    try {
      $info = docker info --format '{{.ServerVersion}}' 2>$null
      if ($LASTEXITCODE -eq 0 -and $info) {
        docker compose ps 2>$null
      } else {
        Write-Warn2 "Docker-Daemon nicht erreichbar (Desktop läuft nicht?)"
      }
    } catch {
      Write-Warn2 "Docker-Daemon nicht erreichbar"
    }
  }
}

function Mode-Test {
  Write-Step "Smoke-Test"
  node scripts/smoke-mvp2.js
  $smokeExit = $LASTEXITCODE

  Write-Step "Server für E2E hochfahren"
  Mode-Backend | Out-Null

  Write-Step "E2E-Test"
  node scripts/e2e-platform.js "http://127.0.0.1:$BackendPort"
  $e2eExit = $LASTEXITCODE

  Mode-Stop

  if ($smokeExit -eq 0 -and $e2eExit -eq 0) {
    Write-Ok "Alle Tests grün"
  } else {
    Write-Err "Tests fehlgeschlagen (smoke=$smokeExit, e2e=$e2eExit)"
    exit 1
  }
}

Load-EnvFile

# ── dispatch ──────────────────────────────────────────────────────────
switch ($Mode) {
  'help'        { Mode-Help }
  'dev'         { Mode-Dev }
  'backend'     { Mode-Backend | Out-Null }
  'ortools'     { Mode-Ortools | Out-Null }
  'cockpit'     { Mode-Cockpit | Out-Null }
  'docker'      { Mode-Docker 'up -d --build' }
  'docker:mvp2' { Mode-Docker '-f docker-compose.yml -f docker-compose.mvp2.yml up -d --build' }
  'docker:mvp3' { Mode-Docker '-f docker-compose.yml -f docker-compose.mvp3.yml up -d --build' }
  'docker:down' { Mode-Docker 'down' }
  'stop'        { Mode-Stop }
  'status'      { Mode-Status }
  'test'        { Mode-Test }
}
