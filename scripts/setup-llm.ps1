# LLM API-Key in .env eintragen (OpenAI oder Azure)
# Usage: .\scripts\setup-llm.ps1

$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectRoot

$envFile = Join-Path $ProjectRoot '.env'
if (-not (Test-Path $envFile)) {
  Copy-Item (Join-Path $ProjectRoot '.env.example') $envFile
  Write-Host "Created .env from .env.example" -ForegroundColor Green
}

Write-Host ""
Write-Host "LLM Setup — Hard Allocation Platform" -ForegroundColor Cyan
Write-Host "1) OpenAI (sk-...)"
Write-Host "2) Azure OpenAI"
Write-Host "3) Key entfernen (nur Regel-Agenten)"
$choice = Read-Host "Auswahl [1]"

function Set-EnvLine($name, $value) {
  $lines = Get-Content $envFile -Encoding UTF8
  $found = $false
  $out = foreach ($line in $lines) {
    if ($line -match "^\s*$([regex]::Escape($name))=") {
      $found = $true
      "$name=$value"
    } else {
      $line
    }
  }
  if (-not $found) { $out += "$name=$value" }
  $out | Set-Content $envFile -Encoding UTF8
}

switch ($choice) {
  '2' {
    $endpoint = Read-Host "AZURE_OPENAI_ENDPOINT (https://....openai.azure.com)"
    $key = Read-Host "AZURE_OPENAI_API_KEY" -AsSecureString
    $deployment = Read-Host "AZURE_OPENAI_DEPLOYMENT [gpt-4o]"
    if (-not $deployment) { $deployment = 'gpt-4o' }
    $plain = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
      [Runtime.InteropServices.Marshal]::SecureStringToBSTR($key)
    )
    Set-EnvLine 'LLM_PROVIDER' 'azure-openai'
    Set-EnvLine 'AZURE_OPENAI_ENDPOINT' $endpoint
    Set-EnvLine 'AZURE_OPENAI_API_KEY' $plain
    Set-EnvLine 'AZURE_OPENAI_DEPLOYMENT' $deployment
    Set-EnvLine 'AGENT_LLM_ENABLED' 'true'
    Set-EnvLine 'COPILOT_MODE' 'hybrid'
    Set-EnvLine 'RAG_ENABLED' 'true'
  }
  '3' {
    Set-EnvLine 'OPENAI_API_KEY' ''
    Set-EnvLine 'AGENT_LLM_ENABLED' 'false'
    Write-Host "LLM deaktiviert — nur Regel-Agenten." -ForegroundColor Yellow
    exit 0
  }
  default {
    $key = Read-Host "OPENAI_API_KEY (sk-...)" -AsSecureString
    $plain = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
      [Runtime.InteropServices.Marshal]::SecureStringToBSTR($key)
    )
    if (-not $plain) {
      Write-Host "Kein Key eingegeben — Abbruch." -ForegroundColor Red
      exit 1
    }
    Set-EnvLine 'LLM_PROVIDER' 'openai'
    Set-EnvLine 'OPENAI_API_KEY' $plain
    Set-EnvLine 'AGENT_LLM_ENABLED' 'true'
    Set-EnvLine 'COPILOT_MODE' 'hybrid'
    Set-EnvLine 'RAG_ENABLED' 'true'
  }
}

Write-Host ""
Write-Host "Gespeichert in .env — Backend neu starten:" -ForegroundColor Green
Write-Host "  npm start   oder   .\scripts\start.ps1 dev"
Write-Host ""
Write-Host "Danach Lernindex aufbauen (Agent Console oder):" -ForegroundColor Cyan
Write-Host '  curl -X POST http://localhost:8000/api/v3/llm/reindex -H "X-User-Role: PLANNER" -H "X-User-Id: USR-PLANNER01"'
