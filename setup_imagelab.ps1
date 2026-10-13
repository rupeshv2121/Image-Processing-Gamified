<#
  ImageLab one-click setup (called by setup_imagelab.bat).

  1. finds your MATLAB installation and its release (R2023b ... R2026a)
  2. finds a Python version that this MATLAB release supports
  3. creates .venv and installs the matching MATLAB Engine API for Python
     (from PyPI, or from the MATLAB folder if PyPI fails)
  4. checks Node.js and builds the user interface
  5. verifies that Python can import matlab.engine

  Options:  -CheckOnly   only report what is installed, change nothing
            -SkipUI      do not (re)build the user interface
            -MatlabRoot "C:\Program Files\MATLAB\R2025b"   use this MATLAB
#>
param(
    [switch]$CheckOnly,
    [switch]$SkipUI,
    [string]$MatlabRoot = ''
)
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$problems = New-Object System.Collections.Generic.List[string]

function Step($n, $text) { Write-Host ""; Write-Host "[$n/5] $text" -ForegroundColor Cyan }
function Ok($text)   { Write-Host "  OK    $text" -ForegroundColor Green }
function Warn($text) { Write-Host "  WARN  $text" -ForegroundColor Yellow }
function Fail($text, $fix) {
    Write-Host "  ERROR $text" -ForegroundColor Red
    if ($fix) { Write-Host "        -> $fix" -ForegroundColor Red }
    $problems.Add($text)
}

# MATLAB release -> MATLAB Engine for Python version and supported Python versions
$engines = [ordered]@{
    'R2026a' = @{ Engine = '26.1'; Python = @('3.12', '3.11', '3.10', '3.13') }
    'R2025b' = @{ Engine = '25.2'; Python = @('3.12', '3.11', '3.10', '3.9') }
    'R2025a' = @{ Engine = '25.1'; Python = @('3.12', '3.11', '3.10', '3.9') }
    'R2024b' = @{ Engine = '24.2'; Python = @('3.12', '3.11', '3.10', '3.9') }
    'R2024a' = @{ Engine = '24.1'; Python = @('3.11', '3.10', '3.9') }
    'R2023b' = @{ Engine = '23.2'; Python = @('3.11', '3.10', '3.9') }
}

# ------------------------------------------------------------------ MATLAB
Step 1 'Looking for MATLAB'
$candidates = @()
if ($MatlabRoot) { $candidates += $MatlabRoot }
foreach ($base in @("$env:ProgramFiles\MATLAB", "${env:ProgramFiles(x86)}\MATLAB")) {
    if (Test-Path $base) { $candidates += (Get-ChildItem $base -Directory | Sort-Object Name -Descending | ForEach-Object FullName) }
}
try {
    Get-ChildItem 'HKLM:\SOFTWARE\MathWorks\MATLAB' -ErrorAction Stop | ForEach-Object {
        $r = (Get-ItemProperty $_.PSPath -ErrorAction SilentlyContinue).MATLABROOT
        if ($r) { $candidates += $r }
    }
} catch { }
$onPath = Get-Command matlab -ErrorAction SilentlyContinue
if ($onPath) { $candidates += (Split-Path (Split-Path $onPath.Source)) }

$matlab = $null
foreach ($c in ($candidates | Select-Object -Unique)) {
    if (Test-Path (Join-Path $c 'bin\matlab.exe')) {
        $release = Split-Path $c -Leaf
        $info = Join-Path $c 'VersionInfo.xml'
        if (Test-Path $info) {
            $xml = [xml](Get-Content $info)
            if ($xml.MathWorks_version_info.release) { $release = $xml.MathWorks_version_info.release }
        }
        $matlab = @{ Root = $c; Release = $release }
        break
    }
}
if (-not $matlab) {
    Fail 'MATLAB was not found.' 'Install MATLAB R2023b or newer, or run: setup_imagelab.bat -MatlabRoot "C:\Program Files\MATLAB\R20xxx"'
} else {
    Ok "MATLAB $($matlab.Release) in $($matlab.Root)"
    if (-not $engines.Contains($matlab.Release)) {
        Warn "Release $($matlab.Release) is not in the known list; the engine will be installed from the MATLAB folder."
    }
}
$spec = if ($matlab -and $engines.Contains($matlab.Release)) { $engines[$matlab.Release] } else { @{ Engine = ''; Python = @('3.12', '3.11', '3.10') } }

# ------------------------------------------------------------------ Python
Step 2 'Looking for a supported Python'
$venvPy = Join-Path $PSScriptRoot '.venv\Scripts\python.exe'
$python = $null
if (Test-Path $venvPy) {
    $v = (& $venvPy -c "import sys; print('%d.%d' % sys.version_info[:2])").Trim()
    if ($spec.Python -contains $v) { Ok "existing .venv uses Python $v"; $python = @{ Exe = $venvPy; Version = $v; Venv = $true } }
    else { Warn ".venv uses Python $v, which MATLAB $($matlab.Release) does not support - it will be recreated." }
}
if (-not $python) {
    $launcher = Get-Command py -ErrorAction SilentlyContinue
    foreach ($v in $spec.Python) {
        $exe = $null
        if ($launcher) { try { $exe = (& py "-$v" -c "import sys; print(sys.executable)" 2>$null) } catch { } }
        if (-not $exe) {
            $cmd = Get-Command python -ErrorAction SilentlyContinue
            if ($cmd) {
                $pv = (& $cmd.Source -c "import sys; print('%d.%d' % sys.version_info[:2])" 2>$null)
                if ($pv -eq $v) { $exe = $cmd.Source }
            }
        }
        if ($exe) { $python = @{ Exe = "$exe".Trim(); Version = $v; Venv = $false }; break }
    }
    if ($python) { Ok "Python $($python.Version) at $($python.Exe)" }
    else { Fail "No supported Python found (MATLAB $($matlab.Release) needs Python $($spec.Python -join ', '))." 'Install Python 3.12 from https://www.python.org (tick "Add python.exe to PATH") and run setup again.' }
}

# ------------------------------------------------------------------ engine
Step 3 'MATLAB Engine API for Python'
if ($python -and $matlab) {
    if (-not $python.Venv) {
        if ($CheckOnly) { Warn 'would create .venv' }
        else {
            if (Test-Path '.venv') { Remove-Item '.venv' -Recurse -Force }
            & $python.Exe -m venv .venv
            if (-not (Test-Path $venvPy)) { Fail 'Could not create the virtual environment .venv' 'Check that the Python installation is complete (python -m venv must work).' }
        }
    }
    if (Test-Path $venvPy) {
        $have = (& $venvPy -c "import importlib.metadata as m; print(m.version('matlabengine'))" 2>$null)
        $wanted = $spec.Engine
        if ($have -and (-not $wanted -or "$have".StartsWith("$wanted."))) { Ok "matlabengine $have already installed" }
        elseif ($CheckOnly) { Warn "would install matlabengine $wanted.* (installed: $(if ($have) { $have } else { 'none' }))" }
        else {
            & $venvPy -m pip install --upgrade pip --quiet
            $installed = $false
            if ($wanted) {
                Write-Host "  installing matlabengine==$wanted.* from PyPI ..."
                & $venvPy -m pip install "matlabengine==$wanted.*" --quiet
                $installed = ($LASTEXITCODE -eq 0)
            }
            if (-not $installed) {
                $src = Join-Path $matlab.Root 'extern\engines\python'
                Write-Host "  installing from $src ..."
                & $venvPy -m pip install $src --quiet
                $installed = ($LASTEXITCODE -eq 0)
            }
            if ($installed) { Ok 'matlabengine installed' }
            else { Fail 'matlabengine could not be installed.' "Open a terminal as administrator in `"$($matlab.Root)\extern\engines\python`" and run: `"$venvPy`" -m pip install ." }
        }
    }
} else { Warn 'skipped (MATLAB or Python missing)' }

# ------------------------------------------------------------------ UI
Step 4 'User interface (Node.js)'
$node = Get-Command node -ErrorAction SilentlyContinue
$dist = Test-Path 'frontend\dist\index.html'
if (-not $node) {
    if ($dist) { Warn 'Node.js not found, but a built UI (frontend\dist) exists - it will be used.' }
    else { Fail 'Node.js not found and the UI is not built.' 'Install Node.js 18 or newer from https://nodejs.org and run setup again.' }
} else {
    $nv = (& node --version).TrimStart('v')
    if ([int]($nv.Split('.')[0]) -lt 18) { Fail "Node.js $nv is too old." 'Install Node.js 18 or newer from https://nodejs.org.' }
    elseif ($SkipUI) { Ok "Node.js $nv (UI build skipped)" }
    elseif ($CheckOnly) { if ($dist) { Ok "Node.js $nv, UI already built" } else { Warn "Node.js $nv, UI would be built" } }
    else {
        Push-Location frontend
        try {
            Write-Host '  installing UI packages (npm ci) ...'
            & npm ci --no-audit --no-fund --loglevel=error
            if ($LASTEXITCODE -ne 0) { & npm install --no-audit --no-fund --loglevel=error }
            Write-Host '  building the UI (npm run build) ...'
            & npm run build --silent
            if ($LASTEXITCODE -eq 0) { Ok "UI built with Node.js $nv" } else { Fail 'The UI build failed.' 'Run "npm run build" in the frontend folder to see the error.' }
        } finally { Pop-Location }
    }
}

# ------------------------------------------------------------------ verify
Step 5 'Checking the installation'
if (Test-Path $venvPy) {
    $ok = (& $venvPy -c "import matlab.engine; print('ok')" 2>$null)
    if ($ok -eq 'ok') { Ok 'Python can import matlab.engine' }
    else { Fail 'Python cannot import matlab.engine.' 'Run setup again; if it keeps failing, install the engine from the MATLAB folder (see step 3).' }
} else { Fail '.venv is missing.' 'Run setup_imagelab.bat without -CheckOnly.' }

Write-Host ''
if ($problems.Count -eq 0) {
    Write-Host 'Setup complete. Start ImageLab with start_imagelab.bat, or type  ImageLab  in MATLAB.' -ForegroundColor Green
    exit 0
}
Write-Host "Setup found $($problems.Count) problem(s):" -ForegroundColor Red
$problems | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
exit 1
