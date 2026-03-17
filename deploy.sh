#!/usr/bin/env bash
# deploy.sh — End-to-end deployment script for Cash Agent Demo
# Usage: bash deploy.sh [--project PROJECT_ID] [--region REGION]
set -euo pipefail

# ---------- Defaults ----------
REGION="${REGION:-us-central1}"
PROJECT_ID="${PROJECT_ID:-}"
DATASET_ID="${DATASET_ID:-cash_agent_demo}"
REPO_NAME="cash-agent-demo"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ---------- Colours ----------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

info()  { echo -e "${BLUE}[INFO]${NC}  $*"; }
ok()    { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
err()   { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

# ---------- Parse arguments ----------
while [[ $# -gt 0 ]]; do
  case $1 in
    --project) PROJECT_ID="$2"; shift 2 ;;
    --region)  REGION="$2";     shift 2 ;;
    *) err "Unknown argument: $1" ;;
  esac
done

# ---------- 1. Check prerequisites ----------
info "Checking prerequisites..."

for cmd in gcloud terraform python3 node npm; do
  command -v "$cmd" &>/dev/null || err "'$cmd' is required but not found in PATH."
done
ok "All prerequisites found."

# ---------- 2. Set project ----------
if [[ -z "$PROJECT_ID" ]]; then
  PROJECT_ID=$(gcloud config get-value project 2>/dev/null || true)
  if [[ -z "$PROJECT_ID" ]]; then
    read -rp "Enter your GCP Project ID: " PROJECT_ID
  fi
fi

info "Using project: $PROJECT_ID"
info "Using region:  $REGION"
gcloud config set project "$PROJECT_ID"

REGISTRY="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}"

# ---------- 3. Authenticate Docker to Artifact Registry ----------
info "Configuring Docker authentication for Artifact Registry..."
gcloud auth configure-docker "${REGION}-docker.pkg.dev" --quiet
ok "Docker auth configured."

# ---------- 4a. Terraform phase 1 — infrastructure (no Cloud Run) ----------
info "Running Terraform phase 1: APIs, Artifact Registry, BigQuery, GCS, IAM, Pub/Sub, Workflows..."
cd "$SCRIPT_DIR/terraform"

# Create terraform.tfvars if it doesn't exist
if [[ ! -f terraform.tfvars ]]; then
  cat > terraform.tfvars <<EOF
project_id      = "${PROJECT_ID}"
region          = "${REGION}"
dataset_id      = "${DATASET_ID}"
agent_engine_id = ""
EOF
  info "Created terraform/terraform.tfvars"
fi

terraform init -input=false

# Phase 1: enable APIs and create Artifact Registry repo
# (Cloud Run needs Docker images to exist, which need the AR repo first)
terraform apply -auto-approve -input=false \
  -target=google_project_service.bigquery \
  -target=google_project_service.run \
  -target=google_project_service.storage \
  -target=google_project_service.workflows \
  -target=google_project_service.aiplatform \
  -target=google_project_service.iam \
  -target=google_project_service.artifactregistry \
  -target=google_project_service.cloudbuild \
  -target=google_project_service.cloudscheduler \
  -target=google_artifact_registry_repository.docker

cd "$SCRIPT_DIR"
ok "Terraform phase 1 complete (infrastructure without Cloud Run)."

# ---------- 4b. Generate UI package-lock.json ----------
info "Generating UI package-lock.json..."
(cd "$SCRIPT_DIR/ui" && npm install --package-lock-only)
ok "UI package-lock.json generated."

# ---------- 4c. Build & push Docker images ----------
info "Building and pushing Docker images..."

# Phase 1 images: everything except cash-agent-ui (needs ui-api URL from terraform)
declare -A IMAGES=(
  ["sap-api-mock"]="mock_services/sap_api"
  ["bank-api-mock"]="mock_services/bank_api"
  ["broker-api-mock"]="mock_services/broker_api"
  ["ui-api"]="ui_api"
  ["chat-app"]="chat_app"
)

# Agent runner uses a Dockerfile that needs repo root as build context
AGENT_RUNNER_IMAGE="${REGISTRY}/agent-runner:latest"
info "  Building agent-runner from agent_runner/ (repo root context)..."
docker build -t "$AGENT_RUNNER_IMAGE" -f "$SCRIPT_DIR/agent_runner/Dockerfile" "$SCRIPT_DIR"
docker push "$AGENT_RUNNER_IMAGE"
ok "  Pushed ${AGENT_RUNNER_IMAGE}"

for IMAGE_NAME in "${!IMAGES[@]}"; do
  BUILD_DIR="${IMAGES[$IMAGE_NAME]}"
  FULL_IMAGE="${REGISTRY}/${IMAGE_NAME}:latest"
  info "  Building ${IMAGE_NAME} from ${BUILD_DIR}..."
  docker build -t "$FULL_IMAGE" "$SCRIPT_DIR/$BUILD_DIR"
  docker push "$FULL_IMAGE"
  ok "  Pushed ${FULL_IMAGE}"
done

# Build a placeholder UI image so terraform can create the Cloud Run service
UI_IMAGE="${REGISTRY}/cash-agent-ui:latest"
info "  Building cash-agent-ui (placeholder, no API URL yet)..."
docker build -t "$UI_IMAGE" "$SCRIPT_DIR/ui"
docker push "$UI_IMAGE"
ok "  Pushed ${UI_IMAGE}"

# ---------- 4d. Terraform phase 2 — full apply (Cloud Run now succeeds) ----------
info "Running Terraform phase 2: full apply including Cloud Run services..."
cd "$SCRIPT_DIR/terraform"
terraform apply -auto-approve -input=false
cd "$SCRIPT_DIR"
ok "Terraform phase 2 complete (all resources including Cloud Run)."

# ---------- 4e. Rebuild UI with ui-api URL ----------
info "Retrieving ui-api URL..."
UI_API_URL=$(gcloud run services describe ui-api --region "$REGION" --format='value(status.url)')
info "  UI API URL: ${UI_API_URL}"

info "  Rebuilding cash-agent-ui with VITE_API_URL..."
docker build --build-arg VITE_API_URL="$UI_API_URL" -t "$UI_IMAGE" "$SCRIPT_DIR/ui"
docker push "$UI_IMAGE"

info "  Updating cash-agent-ui Cloud Run service..."
gcloud run services update cash-agent-ui \
  --region "$REGION" \
  --image "$UI_IMAGE" \
  --quiet
ok "UI rebuilt with live API URL."

# ---------- 5. Load seed data into BigQuery ----------
info "Loading seed data into BigQuery..."

TABLES=(gl_accounts bank_accounts cash_journal ap_open_items ar_open_items fx_rates payment_runs)

for TABLE in "${TABLES[@]}"; do
  CSV_FILE="$SCRIPT_DIR/data/seed/${TABLE}.csv"
  if [[ -f "$CSV_FILE" ]]; then
    info "  Loading ${TABLE}..."
    bq load \
      --source_format=CSV \
      --skip_leading_rows=1 \
      --replace \
      "${PROJECT_ID}:${DATASET_ID}.${TABLE}" \
      "$CSV_FILE"
    ok "  Loaded ${TABLE}"
  else
    warn "  CSV not found: ${CSV_FILE}, skipping."
  fi
done

# ---------- 6. Create BQML forecast model ----------
info "Creating BQML ARIMA+ forecast model..."

bq query --use_legacy_sql=false --project_id="$PROJECT_ID" "
CREATE OR REPLACE MODEL \`${PROJECT_ID}.${DATASET_ID}.cash_forecast_model\`
OPTIONS(
  model_type='ARIMA_PLUS',
  time_series_timestamp_col='posting_date',
  time_series_data_col='net_cash_flow',
  time_series_id_col='currency',
  horizon=90,
  auto_arima=TRUE
) AS
SELECT
  posting_date,
  currency,
  SUM(CASE WHEN transaction_type='INFLOW' THEN amount ELSE -amount END) AS net_cash_flow
FROM \`${PROJECT_ID}.${DATASET_ID}.cash_journal\`
GROUP BY posting_date, currency
"
ok "BQML model created."

# ---------- 7. Print summary ----------
echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}   Cash Agent Demo — Deployment Complete!   ${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""

# Retrieve Cloud Run URLs
info "Service URLs:"
for SVC_NAME in sap-api-mock bank-api-mock broker-api-mock ui-api cash-agent-ui chat-app agent-runner; do
  URL=$(gcloud run services describe "$SVC_NAME" --region "$REGION" --format='value(status.url)' 2>/dev/null || echo "N/A")
  echo -e "  ${BLUE}${SVC_NAME}${NC}: ${URL}"
done

echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "  1. Deploy the agent to Vertex AI Agent Engine (see DEPLOY.md Step 9)"
echo "  2. Update terraform.tfvars with agent_engine_id and re-run terraform apply"
echo "  3. For Google Chat integration, register the Chat App URL as a Chat bot"
echo "  4. Test locally: cd agent && adk web"
echo "  5. For local UI dev: cd ui_api && uvicorn main:app --port 8085 & cd ../ui && npm run dev"
echo ""
