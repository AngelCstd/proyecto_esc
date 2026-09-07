param(
  [int]$MaxIterations = 20,
  [int]$MaxAttemptsPerTask = 2,
  [int]$ClaudeMaxTurns = 6,
  [double]$ClaudeMaxBudgetUsd = 0,
  [string]$ClaudeModel = "",
  [string]$CodexModel = "",
  [switch]$PlanOnly
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Write-Step([string]$Message) { Write-Host "[noktos-loop] $Message" }

function Require-Command([string]$Name) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) { throw "Required command '$Name' was not found in PATH." }
}

function Get-RepoRoot {
  $root = (& git rev-parse --show-toplevel 2>$null)
  if ($LASTEXITCODE -ne 0 -or -not $root) { throw "Run this script inside a Git repository." }
  return $root.Trim()
}

function Assert-SafeBranch {
  $branch = (& git branch --show-current).Trim()
  if (-not $branch) { throw "Detached HEAD is not supported." }
  if ($branch -in @("main", "master", "develop", "production")) {
    throw "Refusing to run on protected-looking branch '$branch'. Use loop/noktos-auth or another dedicated branch."
  }
}

function Assert-CleanWorktree {
  $status = (& git status --porcelain)
  if ($status) { throw "Working tree is not clean. Commit/stash before starting the next iteration." }
}

function Ensure-LocalExcludes([string]$RepoRoot) {
  $excludePath = Join-Path $RepoRoot ".git/info/exclude"
  $entries = @(".loop/runs/", ".loop/HUMAN_GATE.md")
  $existing = if (Test-Path $excludePath) { Get-Content $excludePath } else { @() }
  foreach ($entry in $entries) {
    if ($existing -notcontains $entry) { Add-Content -Path $excludePath -Value $entry }
  }
}

function Get-ChangedFiles {
  $files = New-Object System.Collections.Generic.HashSet[string]([System.StringComparer]::OrdinalIgnoreCase)
  foreach ($f in (& git diff --name-only)) { if ($f) { [void]$files.Add($f.Trim().Replace('\\','/')) } }
  foreach ($f in (& git diff --cached --name-only)) { if ($f) { [void]$files.Add($f.Trim().Replace('\\','/')) } }
  foreach ($f in (& git ls-files --others --exclude-standard)) { if ($f) { [void]$files.Add($f.Trim().Replace('\\','/')) } }
  return @($files)
}

function Path-MatchesRule([string]$File, [string]$Rule) {
  $f = $File.Replace('\\','/')
  $r = $Rule.Replace('\\','/')
  if ([string]::IsNullOrWhiteSpace($r)) { return $false }
  if ($r.EndsWith('/')) { return $f.StartsWith($r, [System.StringComparison]::OrdinalIgnoreCase) }
  if ($r.Contains('*') -or $r.Contains('?')) { return $f -like $r }
  return ($f -ieq $r) -or $f.StartsWith($r + '/', [System.StringComparison]::OrdinalIgnoreCase)
}

function Assert-TaskScope($Task) {
  $changed = Get-ChangedFiles
  if (-not $changed -or $changed.Count -eq 0) { throw "Implementer returned without working-tree changes." }

  $allowed = @($Task.allowed_paths)
  $forbidden = @($Task.forbidden_paths)
  $protected = @(
    ".loop/GOAL.md",
    ".loop/ARCHITECTURE_DECISIONS.md",
    ".loop/CONTRACTS.md",
    ".loop/PRISMA_SAFETY.md",
    ".loop/BACKLOG.yaml",
    ".loop/prompts/",
    ".loop/schemas/",
    ".loop/scripts/"
  )

  if ($allowed.Count -eq 0) { throw "Task packet has no allowed_paths." }

  $violations = @()
  foreach ($file in $changed) {
    $isAllowed = $false
    foreach ($rule in $allowed) { if (Path-MatchesRule $file $rule) { $isAllowed = $true; break } }

    $isForbidden = $false
    foreach ($rule in $forbidden) { if (Path-MatchesRule $file $rule) { $isForbidden = $true; break } }
    foreach ($rule in $protected) { if (Path-MatchesRule $file $rule) { $isForbidden = $true; break } }

    if (-not $isAllowed -or $isForbidden) { $violations += $file }
  }

  if ($violations.Count -gt 0) { throw "Task scope violation: $($violations -join ', ')" }
}

function Assert-NoForbiddenDatabaseCommandsInDiff {
  $diff = (& git diff -- .) -join "`n"
  $patterns = @(
    'prisma\s+migrate\s+reset',
    'prisma\s+db\s+push',
    'prisma\s+migrate\s+deploy',
    'DROP\s+TABLE\s+.*user_info',
    'ALTER\s+TABLE\s+.*user_info'
  )
  foreach ($pattern in $patterns) {
    if ($diff -match $pattern) {
      throw "Forbidden/destructive database command or user_info DDL found in diff: $pattern"
    }
  }
}

function Save-Json($Object, [string]$Path) { $Object | ConvertTo-Json -Depth 40 | Set-Content -Path $Path -Encoding utf8 }
function Read-State([string]$Path) { return (Get-Content $Path -Raw | ConvertFrom-Json) }

function Get-ClaudeStructuredOutput([string]$RawText) {
  $envelope = $RawText | ConvertFrom-Json
  if ($null -ne $envelope.structured_output) { return $envelope.structured_output }
  throw "Claude returned JSON but no structured_output field."
}

function Invoke-Architect([string]$PromptPath, [string]$SchemaPath, [string]$RunDir) {
  $prompt = Get-Content $PromptPath -Raw
  $schema = Get-Content $SchemaPath -Raw
  $args = @(
    "-p", $prompt,
    "--permission-mode", "plan",
    "--output-format", "json",
    "--json-schema", $schema,
    "--max-turns", "$ClaudeMaxTurns",
    "--no-session-persistence"
  )
  if ($ClaudeMaxBudgetUsd -gt 0) { $args += @("--max-budget-usd", "$ClaudeMaxBudgetUsd") }
  if (-not [string]::IsNullOrWhiteSpace($ClaudeModel)) { $args += @("--model", $ClaudeModel) }

  Write-Step "Calling Claude architect..."
  $rawLines = & claude @args
  if ($LASTEXITCODE -ne 0) { throw "Claude architect exited with code $LASTEXITCODE." }
  $raw = $rawLines -join "`n"
  Set-Content -Path (Join-Path $RunDir "architect.raw.json") -Value $raw -Encoding utf8
  $decision = Get-ClaudeStructuredOutput $raw
  Save-Json $decision (Join-Path $RunDir "architect.decision.json")
  return $decision
}

function Write-TaskPacket($Task, [string]$RunDir) {
  Save-Json $Task (Join-Path $RunDir "task.json")
  $lines = @(
    "# Task $($Task.id)", "",
    "Parent backlog: $($Task.parent_backlog_id)",
    "Risk: $($Task.risk)", "",
    "## Title", $Task.title, "",
    "## Objective", $Task.objective, "",
    "## Allowed paths"
  )
  foreach ($v in @($Task.allowed_paths)) { $lines += "- $v" }
  $lines += @("", "## Forbidden paths")
  foreach ($v in @($Task.forbidden_paths)) { $lines += "- $v" }
  $lines += @("", "## Requirements")
  foreach ($v in @($Task.requirements)) { $lines += "- $v" }
  $lines += @("", "## Acceptance")
  foreach ($v in @($Task.acceptance)) { $lines += "- $v" }
  $lines += @("", "## Notes")
  foreach ($v in @($Task.notes)) { $lines += "- $v" }

  $mdPath = Join-Path $RunDir "task.md"
  $lines | Set-Content -Path $mdPath -Encoding utf8
  return $mdPath
}

function Invoke-CodexWorker([string]$BasePromptPath, [string]$TaskPacketPath, [string]$WorkerSchema, [string]$RunDir, [int]$Attempt, [string]$ReviewFeedbackPath) {
  $base = Get-Content $BasePromptPath -Raw
  $prompt = $base + "`n`nCURRENT TASK PACKET:`n$TaskPacketPath`n`nATTEMPT:`n$Attempt`n"
  if ($ReviewFeedbackPath) { $prompt += "`nPREVIOUS REVIEW FEEDBACK:`n$ReviewFeedbackPath`nRead it and correct the current diff without broadening scope.`n" }

  $out = Join-Path $RunDir ("worker.attempt-{0}.json" -f $Attempt)
  $args = @("exec", "--ephemeral", "--sandbox", "workspace-write", "--output-schema", $WorkerSchema, "-o", $out)
  if (-not [string]::IsNullOrWhiteSpace($CodexModel)) { $args += @("--model", $CodexModel) }
  $args += "-"

  Write-Step "Calling Codex implementer (attempt $Attempt)..."
  $prompt | & codex @args
  if ($LASTEXITCODE -ne 0) { throw "Codex implementer exited with code $LASTEXITCODE." }
  if (-not (Test-Path $out)) { throw "Codex implementer did not create its structured result file." }
  return (Get-Content $out -Raw | ConvertFrom-Json)
}

function Invoke-CodexReviewer([string]$BasePromptPath, [string]$TaskPacketPath, [string]$ReviewSchema, [string]$RunDir, [int]$Attempt) {
  $base = Get-Content $BasePromptPath -Raw
  $verification = Join-Path $RunDir "verification.txt"
  $prompt = $base + "`n`nCURRENT TASK PACKET:`n$TaskPacketPath`n`nReview the current uncommitted/staged diff. Verification output, if present:`n$verification`n"
  $out = Join-Path $RunDir ("review.attempt-{0}.json" -f $Attempt)
  $args = @("exec", "--ephemeral", "--sandbox", "read-only", "--output-schema", $ReviewSchema, "-o", $out)
  if (-not [string]::IsNullOrWhiteSpace($CodexModel)) { $args += @("--model", $CodexModel) }
  $args += "-"

  Write-Step "Calling independent Codex reviewer..."
  $prompt | & codex @args
  if ($LASTEXITCODE -ne 0) { throw "Codex reviewer exited with code $LASTEXITCODE." }
  return (Get-Content $out -Raw | ConvertFrom-Json)
}

function Write-HumanGate([string]$RepoRoot, [string]$Reason, $Questions, [string]$RunDir) {
  $path = Join-Path $RepoRoot ".loop/HUMAN_GATE.md"
  $lines = @("# HUMAN GATE", "", "The loop stopped instead of guessing.", "", "## Reason", $Reason, "", "## Questions")
  foreach ($q in @($Questions)) { $lines += "- $q" }
  $lines += @("", "## Continue", "1. Record the approved decision in .loop/ARCHITECTURE_DECISIONS.md.", "2. Review/revert any unapproved diff.", "3. Commit the human decision/worktree.", "4. Delete .loop/HUMAN_GATE.md.", "5. Run the loop again.", "", "Run artifacts: $RunDir")
  $lines | Set-Content -Path $path -Encoding utf8
  Write-Step "HUMAN_GATE: $Reason"
  Write-Step "Questions written to $path"
}

function Approve-And-Commit($Task, [string]$StatePath, $Review) {
  $state = Read-State $StatePath
  $state.status = "RUNNING"
  $state.iteration = [int]$state.iteration + 1
  $state.current_task = $null
  $state.last_review = [pscustomobject]@{ task_id = $Task.id; verdict = $Review.verdict; summary = $Review.summary; reviewed_at = (Get-Date).ToString("o") }
  $completed = @($state.completed_tasks)
  if ($completed -notcontains $Task.id) { $completed += $Task.id }
  $state.completed_tasks = $completed
  Save-Json $state $StatePath

  & git add -A
  if ($LASTEXITCODE -ne 0) { throw "git add failed." }
  & git commit -m "loop($($Task.id)): $($Task.title)"
  if ($LASTEXITCODE -ne 0) { throw "git commit failed. Configure Git user.name/user.email." }
  Write-Step "Approved and committed $($Task.id)."
}

Require-Command "git"
Require-Command "claude"
Require-Command "codex"

$repoRoot = Get-RepoRoot
Set-Location $repoRoot
Ensure-LocalExcludes $repoRoot
Assert-SafeBranch
Assert-CleanWorktree

$loopRoot = Join-Path $repoRoot ".loop"
$statePath = Join-Path $loopRoot "STATE.json"
$architectPrompt = Join-Path $loopRoot "prompts/architect.md"
$workerPrompt = Join-Path $loopRoot "prompts/implementer.md"
$reviewPrompt = Join-Path $loopRoot "prompts/reviewer.md"
$architectSchema = Join-Path $loopRoot "schemas/architect.schema.json"
$workerSchema = Join-Path $loopRoot "schemas/worker.schema.json"
$reviewSchema = Join-Path $loopRoot "schemas/reviewer.schema.json"
$verifyScript = Join-Path $loopRoot "scripts/verify.ps1"
$runsRoot = Join-Path $loopRoot "runs"

foreach ($required in @($statePath, $architectPrompt, $workerPrompt, $reviewPrompt, $architectSchema, $workerSchema, $reviewSchema, $verifyScript)) {
  if (-not (Test-Path $required)) { throw "Missing loop file: $required" }
}
New-Item -ItemType Directory -Force -Path $runsRoot | Out-Null

for ($iteration = 1; $iteration -le $MaxIterations; $iteration++) {
  Assert-CleanWorktree
  $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
  $runDir = Join-Path $runsRoot ("{0}-{1:D3}" -f $stamp, $iteration)
  New-Item -ItemType Directory -Force -Path $runDir | Out-Null

  Write-Step "Iteration $iteration/$MaxIterations"
  $decision = Invoke-Architect $architectPrompt $architectSchema $runDir

  switch ($decision.action) {
    "complete" {
      $state = Read-State $statePath
      $state.status = "READY_FOR_HUMAN_REVIEW"
      Save-Json $state $statePath
      & git add $statePath
      & git commit -m "chore(loop): mark Noktos Auth ready for human review"
      if ($LASTEXITCODE -ne 0) { throw "Failed to commit final loop state." }
      Write-Step "READY_FOR_HUMAN_REVIEW. Human review and real-DB migration review are still required."
      exit 0
    }
    "human_gate" { Write-HumanGate $repoRoot $decision.reason $decision.questions $runDir; exit 2 }
    "blocked" { Write-HumanGate $repoRoot ("BLOCKED: " + $decision.reason) $decision.questions $runDir; exit 3 }
    "dispatch" { if ($null -eq $decision.task) { throw "Architect returned dispatch without task." } }
    default { throw "Unknown architect action: $($decision.action)" }
  }

  $task = $decision.task
  $taskPacket = Write-TaskPacket $task $runDir
  Write-Step "Task: $($task.id) - $($task.title)"

  if ($PlanOnly) { Write-Step "PlanOnly: no code executed. Task packet: $taskPacket"; exit 0 }

  $baseHead = (& git rev-parse HEAD).Trim()
  $reviewFeedbackPath = ""
  $approved = $false

  for ($attempt = 1; $attempt -le $MaxAttemptsPerTask; $attempt++) {
    $worker = Invoke-CodexWorker $workerPrompt $taskPacket $workerSchema $runDir $attempt $reviewFeedbackPath

    $headAfterWorker = (& git rev-parse HEAD).Trim()
    if ($headAfterWorker -ne $baseHead) {
      Write-HumanGate $repoRoot "Implementer created commit(s), which is forbidden." @("Inspect git history and decide whether to keep or revert them.") $runDir
      exit 4
    }

    if ($worker.status -eq "human_gate" -or $worker.status -eq "blocked") {
      Write-HumanGate $repoRoot $worker.summary $worker.questions $runDir
      exit 5
    }

    try {
      Assert-TaskScope $task
      Assert-NoForbiddenDatabaseCommandsInDiff
    } catch {
      Write-HumanGate $repoRoot $_.Exception.Message @("Inspect the current diff. The loop will not auto-revert security/database-sensitive work.") $runDir
      exit 6
    }

    Write-Step "Running deterministic no-test verification..."
    & $verifyScript -RunDir $runDir
    $verificationExit = $LASTEXITCODE

    $review = Invoke-CodexReviewer $reviewPrompt $taskPacket $reviewSchema $runDir $attempt

    if ($review.verdict -eq "approve" -and $verificationExit -eq 0) {
      Approve-And-Commit $task $statePath $review
      $approved = $true
      break
    }

    if ($review.verdict -eq "human_gate") {
      Write-HumanGate $repoRoot $review.summary $review.questions $runDir
      exit 7
    }

    $reviewFeedbackPath = Join-Path $runDir ("review.attempt-{0}.json" -f $attempt)
    if ($verificationExit -ne 0) {
      Add-Content -Path $reviewFeedbackPath -Value "`nDETERMINISTIC VERIFICATION FAILED. Read verification.txt and fix build/prisma validation issues."
    }
    Write-Step "Changes requested or deterministic verification failed."
  }

  if (-not $approved) {
    Write-HumanGate $repoRoot "Task $($task.id) did not pass after $MaxAttemptsPerTask attempts." @("Inspect diff, verification.txt and reviewer findings; fix manually or revise task/architecture.") $runDir
    exit 8
  }

  Assert-CleanWorktree
}

Write-HumanGate $repoRoot "Loop reached MaxIterations=$MaxIterations without completion." @("Review progress/cost before increasing the budget.") $runsRoot
exit 9
