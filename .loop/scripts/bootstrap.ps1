param(
  [switch]$InitializeRepo,
  [switch]$CheckOnly
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Require-Command([string]$Name) {
  $cmd = Get-Command $Name -ErrorAction SilentlyContinue
  if (-not $cmd) { throw "Missing required command: $Name" }
  Write-Host "[ok] $Name -> $($cmd.Source)"
}

Require-Command "git"
Require-Command "claude"
Require-Command "codex"
Require-Command "node"
Require-Command "npm"

if (-not (Test-Path ".loop/GOAL.md")) {
  throw "Run bootstrap from the root where the .loop package was copied."
}

$insideRepo = $false
& git rev-parse --is-inside-work-tree *> $null
if ($LASTEXITCODE -eq 0) { $insideRepo = $true }

if (-not $insideRepo) {
  if (-not $InitializeRepo) {
    throw "This folder is not a Git repo. Run again with -InitializeRepo or initialize Git manually."
  }

  Write-Host "[init] Initializing Git repository..."
  & git init -b loop/noktos-auth
  if ($LASTEXITCODE -ne 0) {
    & git init
    if ($LASTEXITCODE -ne 0) { throw "git init failed." }
    & git switch -c loop/noktos-auth
  }
}

$root = (& git rev-parse --show-toplevel).Trim()
Set-Location $root

foreach ($path in @(
  ".loop/GOAL.md",
  ".loop/ARCHITECTURE_DECISIONS.md",
  ".loop/CONTRACTS.md",
  ".loop/PRISMA_SAFETY.md",
  ".loop/BACKLOG.yaml",
  ".loop/STATE.json",
  ".loop/scripts/loop.ps1"
)) {
  if (-not (Test-Path $path)) { throw "Missing required loop file: $path" }
  Write-Host "[ok] $path"
}

$excludePath = Join-Path $root ".git/info/exclude"
if (-not $CheckOnly) {
  $entries = @(".loop/runs/", ".loop/HUMAN_GATE.md")
  $existing = if (Test-Path $excludePath) { Get-Content $excludePath } else { @() }
  foreach ($entry in $entries) {
    if ($existing -notcontains $entry) {
      Add-Content -Path $excludePath -Value $entry
      Write-Host "[ok] local git exclude added: $entry"
    }
  }
}

Write-Host ""
Write-Host "Claude auth status:"
& claude auth status
Write-Host ""
Write-Host "Codex version:"
& codex --version
Write-Host ""
Write-Host "Node/npm:"
& node --version
& npm --version
Write-Host ""
Write-Host "Bootstrap finished."
Write-Host "Important: do NOT expose production Supabase DB credentials to the autonomous loop."
