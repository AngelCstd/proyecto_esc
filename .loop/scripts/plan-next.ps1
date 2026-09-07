$script = Join-Path $PSScriptRoot "loop.ps1"
& $script -MaxIterations 1 -PlanOnly
exit $LASTEXITCODE
