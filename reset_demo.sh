#!/usr/bin/env bash
# reset_demo.sh — Reset demo state between runs
# Usage: bash reset_demo.sh [--full] [--verify] [--project PROJECT_ID]
set -euo pipefail

# ---------- Defaults ----------
PROJECT_ID="${PROJECT_ID:-}"
DATASET_ID="${DATASET_ID:-cash_agent_demo}"
FULL_RESET=false
VERIFY_ONLY=false
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
    --full)    FULL_RESET=true; shift ;;
    --verify)  VERIFY_ONLY=true; shift ;;
    --project) PROJECT_ID="$2"; shift 2 ;;
    *) err "Unknown argument: $1. Usage: bash reset_demo.sh [--full] [--verify] [--project PROJECT_ID]" ;;
  esac
done

# ---------- Resolve project ----------
if [[ -z "$PROJECT_ID" ]]; then
  PROJECT_ID=$(gcloud config get-value project 2>/dev/null || true)
  if [[ -z "$PROJECT_ID" ]]; then
    err "No project set. Use --project PROJECT_ID or gcloud config set project."
  fi
fi

info "Project:  $PROJECT_ID"
info "Dataset:  $DATASET_ID"

# ---------- Operational tables (written during demo) ----------
OPERATIONAL_TABLES=(approval_requests agent_audit_log agent_recommendations)

# ---------- Seed tables (read-only during demo) ----------
SEED_TABLES=(gl_accounts bank_accounts cash_journal ap_open_items ar_open_items fx_rates payment_runs)

# ---------- Helper: get row count ----------
row_count() {
  local table="$1"
  bq query --use_legacy_sql=false --format=csv --quiet \
    "SELECT COUNT(*) AS cnt FROM \`${PROJECT_ID}.${DATASET_ID}.${table}\`" 2>/dev/null \
    | tail -1 || echo "ERROR"
}

# ---------- Verify mode ----------
if $VERIFY_ONLY; then
  echo ""
  info "Row counts for ${PROJECT_ID}.${DATASET_ID}:"
  echo ""
  echo -e "  ${YELLOW}Operational tables (reset during demo):${NC}"
  for TABLE in "${OPERATIONAL_TABLES[@]}"; do
    COUNT=$(row_count "$TABLE")
    echo -e "    ${TABLE}: ${COUNT} rows"
  done
  echo ""
  echo -e "  ${BLUE}Seed tables (read-only during demo):${NC}"
  for TABLE in "${SEED_TABLES[@]}"; do
    COUNT=$(row_count "$TABLE")
    echo -e "    ${TABLE}: ${COUNT} rows"
  done
  echo ""
  exit 0
fi

# ---------- Confirmation ----------
if $FULL_RESET; then
  echo ""
  warn "FULL RESET: This will truncate operational tables AND reload all 7 seed CSVs."
else
  echo ""
  info "QUICK RESET: This will truncate 3 operational tables (approval_requests, agent_audit_log, agent_recommendations)."
fi

read -rp "Continue? [y/N] " CONFIRM
if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
  info "Cancelled."
  exit 0
fi

# ---------- Truncate operational tables ----------
echo ""
info "Truncating operational tables..."

for TABLE in "${OPERATIONAL_TABLES[@]}"; do
  info "  Truncating ${TABLE}..."
  bq query --use_legacy_sql=false --quiet \
    "TRUNCATE TABLE \`${PROJECT_ID}.${DATASET_ID}.${TABLE}\`" 2>/dev/null \
    && ok "  Truncated ${TABLE}" \
    || warn "  ${TABLE} — table may not exist yet (this is OK for first run)"
done

# ---------- Verify truncation ----------
info "Verifying truncation..."
ALL_CLEAR=true
for TABLE in "${OPERATIONAL_TABLES[@]}"; do
  COUNT=$(row_count "$TABLE")
  if [[ "$COUNT" == "0" ]]; then
    ok "  ${TABLE}: 0 rows"
  elif [[ "$COUNT" == "ERROR" ]]; then
    warn "  ${TABLE}: table does not exist (OK for first run)"
  else
    err "  ${TABLE}: expected 0 rows, got ${COUNT}"
    ALL_CLEAR=false
  fi
done

# ---------- Full reset: reload seed data ----------
if $FULL_RESET; then
  echo ""
  info "Reloading seed data..."

  for TABLE in "${SEED_TABLES[@]}"; do
    CSV_FILE="$SCRIPT_DIR/data/seed/${TABLE}.csv"
    if [[ -f "$CSV_FILE" ]]; then
      info "  Loading ${TABLE}..."
      bq load \
        --source_format=CSV \
        --skip_leading_rows=1 \
        --replace \
        "${PROJECT_ID}:${DATASET_ID}.${TABLE}" \
        "$CSV_FILE"
      COUNT=$(row_count "$TABLE")
      ok "  Loaded ${TABLE} (${COUNT} rows)"
    else
      warn "  CSV not found: ${CSV_FILE}, skipping."
    fi
  done
fi

# ---------- Summary ----------
echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}   Demo Reset Complete!                     ${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
if $FULL_RESET; then
  ok "Operational tables truncated + seed data reloaded."
else
  ok "Operational tables truncated. Seed data unchanged."
fi
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "  1. Start the agent:  cd agent && adk web"
echo "  2. Follow the demo script:  see DEMO_SCRIPT.md"
echo ""
