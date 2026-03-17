# Cash Agent Demo - Deployment Guide

End-to-end instructions to deploy the Cash Agent Demo to Google Cloud.

## Prerequisites

- **GCP Project** with billing enabled
- **gcloud CLI** (`>= 450.0`) — authenticated with `gcloud auth login`
- **Terraform** (`>= 1.0`)
- **Docker** — running locally
- **Node.js** (`>= 20`) and npm
- **Python** (`>= 3.11`)
- **bq CLI** (bundled with gcloud)

### Required GCP Permissions

Your account needs at minimum:
- `roles/editor` on the project, OR the following individual roles:
  - BigQuery Admin, Cloud Run Admin, Storage Admin, Artifact Registry Admin,
    Service Account Admin, IAM Admin, AI Platform Admin, Workflows Admin, Pub/Sub Admin

## Quick Start (Automated)

```bash
# Set your project (or pass --project flag)
export PROJECT_ID="your-gcp-project-id"
export REGION="us-central1"  # optional, defaults to us-central1

bash deploy.sh --project "$PROJECT_ID" --region "$REGION"
```

The script handles steps 1-8 below. Continue with step 9 for agent deployment.

## Step-by-Step (Manual)

### Step 1: Clone and Configure

```bash
cd cashagentdemo

# Create your Terraform variables file
cp terraform/terraform.tfvars.example terraform/terraform.tfvars
# Edit terraform/terraform.tfvars with your project_id
```

### Step 2: Authenticate

```bash
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
gcloud auth configure-docker us-central1-docker.pkg.dev
```

### Step 3: Provision Infrastructure with Terraform

```bash
cd terraform
terraform init
terraform apply
cd ..
```

This creates:
- BigQuery dataset and tables
- GCS bucket with policy documents uploaded
- Cloud Run services (initially with placeholder images)
- Artifact Registry repository
- Service accounts and IAM bindings
- Pub/Sub topics and Workflows

### Step 4: Build and Push Docker Images

```bash
PROJECT_ID=$(gcloud config get-value project)
REGION="us-central1"
REGISTRY="${REGION}-docker.pkg.dev/${PROJECT_ID}/cash-agent-demo"

# Mock services
docker build -t ${REGISTRY}/sap-api-mock:latest mock_services/sap_api
docker push ${REGISTRY}/sap-api-mock:latest

docker build -t ${REGISTRY}/bank-api-mock:latest mock_services/bank_api
docker push ${REGISTRY}/bank-api-mock:latest

docker build -t ${REGISTRY}/broker-api-mock:latest mock_services/broker_api
docker push ${REGISTRY}/broker-api-mock:latest

# UI
docker build -t ${REGISTRY}/cash-agent-ui:latest ui
docker push ${REGISTRY}/cash-agent-ui:latest

# Chat App
docker build -t ${REGISTRY}/chat-app:latest chat_app
docker push ${REGISTRY}/chat-app:latest
```

### Step 5: Deploy to Cloud Run

```bash
for SERVICE in sap-api-mock bank-api-mock broker-api-mock cash-agent-ui chat-app; do
  gcloud run services update $SERVICE \
    --image ${REGISTRY}/${SERVICE}:latest \
    --region $REGION
done
```

### Step 6: Load Seed Data into BigQuery

```bash
DATASET="cash_agent_demo"

for TABLE in gl_accounts bank_accounts cash_journal ap_open_items ar_open_items fx_rates payment_runs; do
  bq load --source_format=CSV --skip_leading_rows=1 --replace \
    ${PROJECT_ID}:${DATASET}.${TABLE} \
    data/seed/${TABLE}.csv
done
```

### Step 7: Create BQML Forecast Model

```bash
bq query --use_legacy_sql=false "
CREATE OR REPLACE MODEL \`${PROJECT_ID}.${DATASET}.cash_forecast_model\`
OPTIONS(
  model_type='ARIMA_PLUS',
  time_series_timestamp_col='posting_date',
  time_series_data_col='net_cash_flow',
  time_series_id_col='currency',
  horizon=90,
  auto_arima=TRUE
) AS
SELECT posting_date, currency,
  SUM(CASE WHEN transaction_type='INFLOW' THEN amount ELSE -amount END) AS net_cash_flow
FROM \`${PROJECT_ID}.${DATASET}.cash_journal\`
GROUP BY posting_date, currency
"
```

Model training takes 3-5 minutes.

### Step 8: Test Locally with ADK

```bash
# Install ADK
pip install google-adk

# Set environment variables for the agent tools
export PROJECT_ID="your-project-id"
export REGION="us-central1"
export DATASET_ID="cash_agent_demo"

# Get Cloud Run URLs from Terraform outputs
cd terraform
export SAP_API_URL=$(terraform output -raw sap_api_mock_url)
export BANK_API_URL=$(terraform output -raw bank_api_mock_url)
export BROKER_API_URL=$(terraform output -raw broker_api_mock_url)
cd ..

# Run the agent locally
adk web
```

Open the ADK web UI and try:
- "What's our current cash position?"
- "Compare the ML forecast with the agent-enriched forecast" (tests the enriched forecast showing ML-only vs agent-adjusted side-by-side)

### Step 9: Deploy Agent to Vertex AI Agent Engine

```bash
python3 -c "
import vertexai
from vertexai import agent_engines

vertexai.init(project='${PROJECT_ID}', location='${REGION}')

# Deploy the agent
agent_engine = agent_engines.create(
    agent_engine='agent.agent:root_agent',
    requirements=[
        'google-adk',
        'google-cloud-bigquery',
        'google-cloud-storage',
        'requests',
    ],
    display_name='Cash Agent Demo',
    description='AI-powered Treasury Cash Agent',
)
print(f'Agent Engine ID: {agent_engine.resource_name}')
print(f'Extract the ID from the resource name above.')
"
```

Copy the Agent Engine ID (the last part of the resource name).

### Step 10: Update Chat App with Agent Engine ID

```bash
# Update terraform.tfvars
cd terraform
# Set agent_engine_id = "YOUR_AGENT_ENGINE_ID" in terraform.tfvars
terraform apply
cd ..

# Or update Cloud Run directly:
AGENT_ENGINE_ID="your-agent-engine-id"
gcloud run services update chat-app \
  --region $REGION \
  --set-env-vars "AGENT_ENGINE_ID=${AGENT_ENGINE_ID}"
```

### Step 11: (Optional) Google Chat Integration

1. Go to [Google Cloud Console > APIs & Services > Google Chat API](https://console.cloud.google.com/apis/api/chat.googleapis.com)
2. Enable the Google Chat API
3. Go to **Configuration** tab
4. Set:
   - **App name**: Cash Agent
   - **Avatar URL**: (any icon URL)
   - **Description**: AI Treasury Assistant
   - **Functionality**: Spaces and direct messages
   - **Connection settings**: HTTP endpoint URL
   - **HTTP endpoint URL**: `<chat-app Cloud Run URL>`
   - **Visibility**: Specific people or your domain

## Verification

After deployment, verify each service:

```bash
# Check mock services
curl $(gcloud run services describe sap-api-mock --region $REGION --format='value(status.url)')/health
curl $(gcloud run services describe bank-api-mock --region $REGION --format='value(status.url)')/health
curl $(gcloud run services describe broker-api-mock --region $REGION --format='value(status.url)')/health

# Check chat app
curl $(gcloud run services describe chat-app --region $REGION --format='value(status.url)')/health

# Check UI (should return HTML)
curl -s $(gcloud run services describe cash-agent-ui --region $REGION --format='value(status.url)') | head -5

# Check BigQuery data
bq query --use_legacy_sql=false "SELECT COUNT(*) as cnt FROM ${PROJECT_ID}.cash_agent_demo.bank_accounts"
```

## Troubleshooting

### "Permission denied" on Terraform apply
Ensure your account has the required IAM roles. Run:
```bash
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="user:$(gcloud config get-value account)" \
  --role="roles/editor"
```

### Cloud Run service fails to start
Check logs:
```bash
gcloud run services logs read SERVICE_NAME --region $REGION --limit 50
```

### BQML model training fails
Ensure the `cash_journal` table has data:
```bash
bq query --use_legacy_sql=false "SELECT COUNT(*) FROM ${PROJECT_ID}.cash_agent_demo.cash_journal"
```

### Docker push fails with "denied"
Re-authenticate:
```bash
gcloud auth configure-docker ${REGION}-docker.pkg.dev
```

### Agent Engine deployment fails
Ensure the AI Platform API is enabled and you have `roles/aiplatform.user`:
```bash
gcloud services enable aiplatform.googleapis.com
```

## Teardown

To remove all deployed resources:

```bash
# Delete Cloud Run services
for SERVICE in sap-api-mock bank-api-mock broker-api-mock cash-agent-ui chat-app; do
  gcloud run services delete $SERVICE --region $REGION --quiet
done

# Delete Artifact Registry images
gcloud artifacts repositories delete cash-agent-demo --location $REGION --quiet

# Destroy Terraform-managed resources
cd terraform
terraform destroy
cd ..

# (Optional) Delete the Agent Engine
python3 -c "
import vertexai
from vertexai import agent_engines
vertexai.init(project='${PROJECT_ID}', location='${REGION}')
agent_engines.delete('projects/${PROJECT_ID}/locations/${REGION}/reasoningEngines/AGENT_ENGINE_ID')
"
```
