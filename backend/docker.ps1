$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# =============================================================================
# Mitsumi AI Agents - Backend Deployment Script (PowerShell)
# =============================================================================
# Builds and deploys backend to AWS ECS Fargate with immutable image tags.
#
# Optional env overrides:
# - AWS_REGION, ECR_REPOSITORY, ECS_CLUSTER, ECS_SERVICE, AWS_ACCOUNT_ID
# - IMAGE_TAG (default: git sha + UTC timestamp)
# - CONTAINER_NAME (default: update all containers in task definition)
# - NO_CACHE=true (for docker build --no-cache)
# - PUSH_LATEST=false (skip pushing latest tag for faster deploy)
# - WAIT_FOR_STABLE=false (skip ECS wait for faster return)
# =============================================================================

function Get-EnvOrDefault {
    param(
        [string]$Name,
        [string]$DefaultValue = ""
    )

    $value = [System.Environment]::GetEnvironmentVariable($Name)
    if ([string]::IsNullOrWhiteSpace($value)) {
        return $DefaultValue
    }
    return $value
}

function Test-IsTrue {
    param([string]$Value)
    if ([string]::IsNullOrWhiteSpace($Value)) {
        return $false
    }
    return $Value.Trim().ToLowerInvariant() -eq "true"
}

function Write-Step {
    param([string]$Text)
    Write-Host ""
    Write-Host $Text -ForegroundColor Yellow
}

$AwsRegion = Get-EnvOrDefault -Name "AWS_REGION" -DefaultValue "eu-west-3"
$EcrRepository = Get-EnvOrDefault -Name "ECR_REPOSITORY" -DefaultValue "mitsumi-ai-agents"
$EcsCluster = Get-EnvOrDefault -Name "ECS_CLUSTER" -DefaultValue "mitsumi-ai-agents-cluster"
$EcsService = Get-EnvOrDefault -Name "ECS_SERVICE" -DefaultValue "mitsumi-ai-agents-backend-service"
$AwsAccountId = Get-EnvOrDefault -Name "AWS_ACCOUNT_ID"
$ImageTag = Get-EnvOrDefault -Name "IMAGE_TAG"
$ContainerName = Get-EnvOrDefault -Name "CONTAINER_NAME"
$NoCache = Get-EnvOrDefault -Name "NO_CACHE" -DefaultValue "false"
$PushLatest = Get-EnvOrDefault -Name "PUSH_LATEST" -DefaultValue "true"
$WaitForStable = Get-EnvOrDefault -Name "WAIT_FOR_STABLE" -DefaultValue "true"

Write-Host "============================================" -ForegroundColor Yellow
Write-Host "  Mitsumi AI Agents - Backend Deploy        " -ForegroundColor Yellow
Write-Host "============================================" -ForegroundColor Yellow
Write-Host ""

# --- Prerequisite checks -----------------------------------------------------
foreach ($cmd in @("aws", "docker", "python")) {
    if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
        Write-Host "Missing required command: $cmd" -ForegroundColor Red
        exit 1
    }
}

# --- Step 1: Resolve AWS Account ID -----------------------------------------
if ([string]::IsNullOrWhiteSpace($AwsAccountId)) {
    Write-Step "[1/9] Getting AWS Account ID..."
    $AwsAccountId = (aws sts get-caller-identity --query Account --output text).Trim()
    Write-Host "AWS Account ID: $AwsAccountId" -ForegroundColor Green
}
else {
    Write-Step "[1/9] Using provided AWS Account ID: $AwsAccountId"
}

# --- Resolve image tag -------------------------------------------------------
if ([string]::IsNullOrWhiteSpace($ImageTag)) {
    $GitSha = (git rev-parse --short HEAD 2>$null)
    if ([string]::IsNullOrWhiteSpace($GitSha)) {
        $GitSha = "manual"
    }
    $UtcTs = (Get-Date).ToUniversalTime().ToString("yyyyMMddHHmmss")
    $ImageTag = "$GitSha-$UtcTs"
}

$EcrImageBase = "$AwsAccountId.dkr.ecr.$AwsRegion.amazonaws.com/$EcrRepository"
$EcrImageVersioned = "$EcrImageBase`:$ImageTag"
$EcrImageLatest = "$EcrImageBase`:latest"

# --- Step 2: ECR login -------------------------------------------------------
Write-Step "[2/9] Logging in to Amazon ECR..."
$EcrLoginPassword = aws ecr get-login-password --region $AwsRegion
$EcrLoginPassword | docker login --username AWS --password-stdin "$AwsAccountId.dkr.ecr.$AwsRegion.amazonaws.com" | Out-Null
Write-Host "ECR login successful" -ForegroundColor Green

# --- Step 3: Build Docker image ---------------------------------------------
Write-Step "[3/9] Building Docker image ($ImageTag)..."
$BuildArgs = @("--pull")
if (Test-IsTrue -Value $NoCache) {
    $BuildArgs += "--no-cache"
}

docker build @BuildArgs `
    -t "$EcrRepository`:$ImageTag" `
    -t "$EcrRepository`:latest" `
    -f "$ScriptDir/Dockerfile" `
    "$ScriptDir"
Write-Host "Docker image built successfully" -ForegroundColor Green

# --- Step 4: Tag image for ECR ----------------------------------------------
Write-Step "[4/9] Tagging image for ECR..."
docker tag "$EcrRepository`:$ImageTag" "$EcrImageVersioned"
docker tag "$EcrRepository`:latest" "$EcrImageLatest"
Write-Host "Image tagged" -ForegroundColor Green

# --- Step 5: Push to ECR -----------------------------------------------------
Write-Step "[5/9] Pushing image tags to ECR..."
docker push "$EcrImageVersioned"
if (Test-IsTrue -Value $PushLatest) {
    docker push "$EcrImageLatest"
}
Write-Host "Image pushed: $EcrImageVersioned" -ForegroundColor Green

# --- Step 6: Read current task definition -----------------------------------
Write-Step "[6/9] Reading current ECS service task definition..."
$CurrentTaskDefArn = (aws ecs describe-services --cluster $EcsCluster --services $EcsService --region $AwsRegion --query "services[0].taskDefinition" --output text).Trim()
if ([string]::IsNullOrWhiteSpace($CurrentTaskDefArn) -or $CurrentTaskDefArn -eq "None") {
    Write-Host "Could not resolve current task definition for service '$EcsService'." -ForegroundColor Red
    exit 1
}
Write-Host "Current task definition: $CurrentTaskDefArn" -ForegroundColor Green

$TempDir = Join-Path $env:TEMP ("mitsumi-ai-agents-deploy-" + [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $TempDir | Out-Null
$CurrentTaskDefPath = Join-Path $TempDir "current-taskdef.json"
$NewTaskDefPath = Join-Path $TempDir "new-taskdef.json"
$PatchScriptPath = Join-Path $TempDir "patch-taskdef.py"

try {
    aws ecs describe-task-definition --task-definition $CurrentTaskDefArn --region $AwsRegion --output json | Out-File -Encoding utf8 -FilePath $CurrentTaskDefPath

    # --- Step 7: Patch task definition with new image -----------------------
    Write-Step "[7/9] Creating new task definition revision with image $EcrImageVersioned..."
    @'
import json
import sys

new_image = sys.argv[1]
container_name = sys.argv[2]
input_path = sys.argv[3]
output_path = sys.argv[4]

with open(input_path, "r", encoding="utf-8") as f:
    source = json.load(f)["taskDefinition"]

allowed = [
    "family",
    "taskRoleArn",
    "executionRoleArn",
    "networkMode",
    "containerDefinitions",
    "volumes",
    "placementConstraints",
    "requiresCompatibilities",
    "cpu",
    "memory",
    "runtimePlatform",
    "pidMode",
    "ipcMode",
    "proxyConfiguration",
    "inferenceAccelerators",
    "ephemeralStorage",
]

task_payload = {k: source[k] for k in allowed if k in source}
containers = task_payload.get("containerDefinitions", [])
if not containers:
    raise SystemExit("Task definition has no container definitions.")

if container_name:
    matched = False
    for container in containers:
        if container.get("name") == container_name:
            container["image"] = new_image
            matched = True
            break
    if not matched:
        raise SystemExit(f"Container '{container_name}' not found in task definition.")
else:
    for container in containers:
        container["image"] = new_image

with open(output_path, "w", encoding="utf-8") as f:
    json.dump(task_payload, f)
'@ | Out-File -Encoding utf8 -FilePath $PatchScriptPath

    python $PatchScriptPath $EcrImageVersioned $ContainerName $CurrentTaskDefPath $NewTaskDefPath

    if (-not (Test-Path -Path $NewTaskDefPath)) {
        Write-Host "Failed to generate task definition payload: $NewTaskDefPath" -ForegroundColor Red
        exit 1
    }

    $TaskDefJson = Get-Content -Raw -Path $NewTaskDefPath
    $NewTaskDefArn = (aws ecs register-task-definition --region $AwsRegion --cli-input-json $TaskDefJson --query "taskDefinition.taskDefinitionArn" --output text).Trim()
    Write-Host "Registered task definition: $NewTaskDefArn" -ForegroundColor Green

    # --- Step 8: Update ECS service -----------------------------------------
    Write-Step "[8/9] Updating ECS service to new task definition..."
    aws ecs update-service `
        --cluster $EcsCluster `
        --service $EcsService `
        --task-definition $NewTaskDefArn `
        --region $AwsRegion | Out-Null
    Write-Host "ECS service update submitted" -ForegroundColor Green

    # --- Step 9: Wait for stability -----------------------------------------
    Write-Host ""
    if (Test-IsTrue -Value $WaitForStable) {
        Write-Host "[9/9] Waiting for ECS service to become stable..." -ForegroundColor Yellow
        aws ecs wait services-stable --cluster $EcsCluster --services $EcsService --region $AwsRegion
    }
    else {
        Write-Host "[9/9] Skipping ECS stability wait (WAIT_FOR_STABLE=false)" -ForegroundColor Yellow
    }

    Write-Host ""
    Write-Host "============================================" -ForegroundColor Green
    Write-Host "  Deployment completed successfully         " -ForegroundColor Green
    Write-Host "============================================" -ForegroundColor Green
    Write-Host "Image: $EcrImageVersioned" -ForegroundColor Green
    Write-Host "Task Definition: $NewTaskDefArn" -ForegroundColor Green
}
finally {
    if (Test-Path -Path $TempDir) {
        Remove-Item -Path $TempDir -Recurse -Force
    }
}
