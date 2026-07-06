#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# =============================================================================
# Mitsumi AI Agents - Backend Deployment Script (Linux/Mac)
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

AWS_REGION="${AWS_REGION:-eu-west-3}"
ECR_REPOSITORY="${ECR_REPOSITORY:-mitsumi-ai-agents}"
ECS_CLUSTER="${ECS_CLUSTER:-mitsumi-ai-agents-cluster}"
ECS_SERVICE="${ECS_SERVICE:-mitsumi-ai-agents-backend-service}"
AWS_ACCOUNT_ID="${AWS_ACCOUNT_ID:-}"
IMAGE_TAG="${IMAGE_TAG:-}"
CONTAINER_NAME="${CONTAINER_NAME:-}"
NO_CACHE="${NO_CACHE:-false}"
PUSH_LATEST="${PUSH_LATEST:-true}"
WAIT_FOR_STABLE="${WAIT_FOR_STABLE:-true}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}============================================${NC}"
echo -e "${YELLOW}  Mitsumi AI Agents - Backend Deploy        ${NC}"
echo -e "${YELLOW}============================================${NC}"
echo ""

# --- Prerequisite checks -----------------------------------------------------
for cmd in aws docker python3; do
    if ! command -v "$cmd" >/dev/null 2>&1; then
        echo -e "${RED}Missing required command: $cmd${NC}"
        exit 1
    fi
done

# --- Step 1: Resolve AWS Account ID ------------------------------------------
if [ -z "$AWS_ACCOUNT_ID" ]; then
    echo -e "${YELLOW}[1/9] Getting AWS Account ID...${NC}"
    AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
    echo -e "${GREEN}AWS Account ID: $AWS_ACCOUNT_ID${NC}"
else
    echo -e "${YELLOW}[1/9] Using provided AWS Account ID: $AWS_ACCOUNT_ID${NC}"
fi

# --- Resolve image tag -------------------------------------------------------
if [ -z "$IMAGE_TAG" ]; then
    GIT_SHA="$(git rev-parse --short HEAD 2>/dev/null || echo 'manual')"
    UTC_TS="$(date -u +"%Y%m%d%H%M%S")"
    IMAGE_TAG="${GIT_SHA}-${UTC_TS}"
fi

ECR_IMAGE_BASE="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPOSITORY"
ECR_IMAGE_VERSIONED="$ECR_IMAGE_BASE:$IMAGE_TAG"
ECR_IMAGE_LATEST="$ECR_IMAGE_BASE:latest"

# --- Step 2: ECR login -------------------------------------------------------
echo ""
echo -e "${YELLOW}[2/9] Logging in to Amazon ECR...${NC}"
aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"
echo -e "${GREEN}ECR login successful${NC}"

# --- Step 3: Build Docker image ----------------------------------------------
echo ""
echo -e "${YELLOW}[3/9] Building Docker image ($IMAGE_TAG)...${NC}"
BUILD_ARGS=(--pull)
if [ "${NO_CACHE,,}" = "true" ]; then
    BUILD_ARGS+=(--no-cache)
fi
docker build "${BUILD_ARGS[@]}" -t "$ECR_REPOSITORY:$IMAGE_TAG" -t "$ECR_REPOSITORY:latest" -f "$SCRIPT_DIR/Dockerfile" "$SCRIPT_DIR"
echo -e "${GREEN}Docker image built successfully${NC}"

# --- Step 4: Tag image for ECR -----------------------------------------------
echo ""
echo -e "${YELLOW}[4/9] Tagging image for ECR...${NC}"
docker tag "$ECR_REPOSITORY:$IMAGE_TAG" "$ECR_IMAGE_VERSIONED"
docker tag "$ECR_REPOSITORY:latest" "$ECR_IMAGE_LATEST"
echo -e "${GREEN}Image tagged${NC}"

# --- Step 5: Push to ECR -----------------------------------------------------
echo ""
echo -e "${YELLOW}[5/9] Pushing image tags to ECR...${NC}"
docker push "$ECR_IMAGE_VERSIONED"
if [ "${PUSH_LATEST,,}" = "true" ]; then
    docker push "$ECR_IMAGE_LATEST"
fi
echo -e "${GREEN}Image pushed: $ECR_IMAGE_VERSIONED${NC}"

# --- Step 6: Read current task definition ------------------------------------
echo ""
echo -e "${YELLOW}[6/9] Reading current ECS service task definition...${NC}"
CURRENT_TASK_DEF_ARN="$(aws ecs describe-services --cluster "$ECS_CLUSTER" --services "$ECS_SERVICE" --region "$AWS_REGION" --query 'services[0].taskDefinition' --output text)"
if [ -z "$CURRENT_TASK_DEF_ARN" ] || [ "$CURRENT_TASK_DEF_ARN" = "None" ]; then
    echo -e "${RED}Could not resolve current task definition for service '$ECS_SERVICE'.${NC}"
    exit 1
fi
echo -e "${GREEN}Current task definition: $CURRENT_TASK_DEF_ARN${NC}"

TMP_DIR="$(mktemp -d)"
cleanup() {
    rm -rf "$TMP_DIR"
}
trap cleanup EXIT

aws ecs describe-task-definition --task-definition "$CURRENT_TASK_DEF_ARN" --region "$AWS_REGION" --output json > "$TMP_DIR/current-taskdef.json"

# --- Step 7: Patch task definition with new image ----------------------------
echo ""
echo -e "${YELLOW}[7/9] Creating new task definition revision with image $ECR_IMAGE_VERSIONED...${NC}"
python3 - "$ECR_IMAGE_VERSIONED" "$CONTAINER_NAME" "$TMP_DIR/current-taskdef.json" "$TMP_DIR/new-taskdef.json" <<'PY'
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
PY

if [ ! -f "$TMP_DIR/new-taskdef.json" ]; then
    echo -e "${RED}Failed to generate task definition payload: $TMP_DIR/new-taskdef.json${NC}"
    exit 1
fi

# Pass raw JSON to avoid file:// path translation issues on Git Bash / Windows.
TASK_DEF_JSON="$(cat "$TMP_DIR/new-taskdef.json")"
NEW_TASK_DEF_ARN="$(aws ecs register-task-definition --region "$AWS_REGION" --cli-input-json "$TASK_DEF_JSON" --query 'taskDefinition.taskDefinitionArn' --output text)"
echo -e "${GREEN}Registered task definition: $NEW_TASK_DEF_ARN${NC}"

# --- Step 8: Update ECS service ----------------------------------------------
echo ""
echo -e "${YELLOW}[8/9] Updating ECS service to new task definition...${NC}"
aws ecs update-service \
    --cluster "$ECS_CLUSTER" \
    --service "$ECS_SERVICE" \
    --task-definition "$NEW_TASK_DEF_ARN" \
    --region "$AWS_REGION" >/dev/null
echo -e "${GREEN}ECS service update submitted${NC}"

# --- Step 9: Wait for stability ----------------------------------------------
echo ""
if [ "${WAIT_FOR_STABLE,,}" = "true" ]; then
    echo -e "${YELLOW}[9/9] Waiting for ECS service to become stable...${NC}"
    aws ecs wait services-stable --cluster "$ECS_CLUSTER" --services "$ECS_SERVICE" --region "$AWS_REGION"
else
    echo -e "${YELLOW}[9/9] Skipping ECS stability wait (WAIT_FOR_STABLE=false)${NC}"
fi

echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}  Deployment completed successfully         ${NC}"
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}Image: $ECR_IMAGE_VERSIONED${NC}"
echo -e "${GREEN}Task Definition: $NEW_TASK_DEF_ARN${NC}"
