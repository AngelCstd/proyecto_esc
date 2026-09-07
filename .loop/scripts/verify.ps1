param(
  [string]$RunDir = ""
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Add-Line([string]$Text) {
  Write-Host "[verify] $Text"
  if ($script:LogPath) { Add-Content -Path $script:LogPath -Value "[verify] $Text" }
}

$root = (& git rev-parse --show-toplevel 2>$null)
if ($LASTEXITCODE -ne 0 -or -not $root) { throw "Run inside a Git repository." }
$root = $root.Trim()
Set-Location $root

$script:LogPath = $null
if ($RunDir) {
  New-Item -ItemType Directory -Force -Path $RunDir | Out-Null
  $script:LogPath = Join-Path $RunDir "verification.txt"
  Set-Content -Path $script:LogPath -Value "Noktos Auth deterministic verification" -Encoding utf8
}

$failed = $false

if (Test-Path "package.json") {
  Add-Line "Running npm run build --if-present (no tests)."
  & npm run build --if-present 2>&1 | Tee-Object -Variable buildOutput | ForEach-Object { Write-Host $_; if ($script:LogPath) { Add-Content $script:LogPath $_ } }
  if ($LASTEXITCODE -ne 0) { $failed = $true; Add-Line "BUILD FAILED" } else { Add-Line "Build check passed." }
} else {
  Add-Line "package.json not present yet; build check skipped."
}

if (Test-Path "prisma") {
  $hasPrisma = $false
  if (Test-Path "package.json") {
    $pkg = Get-Content "package.json" -Raw
    if ($pkg -match '"prisma"' -or $pkg -match '"@prisma/client"') { $hasPrisma = $true }
  }
  if ($hasPrisma) {
    Add-Line "Running npx prisma validate (no migrations)."
    & npx prisma validate 2>&1 | Tee-Object -Variable prismaOutput | ForEach-Object { Write-Host $_; if ($script:LogPath) { Add-Content $script:LogPath $_ } }
    if ($LASTEXITCODE -ne 0) { $failed = $true; Add-Line "PRISMA VALIDATE FAILED" } else { Add-Line "Prisma validate passed." }
  }
}

if ($failed) { exit 1 }
exit 0
