# Cash Agent Dashboard UI

SAP Fiori-inspired React dashboard for treasury management and cash agent monitoring.

## Features

- **Dashboard**: Overview of cash positions, forecasts, and obligations
- **Approvals**: Review and approve agent recommendations
- **Audit Trail**: Complete log of agent actions and decisions
- **Agent Chat**: Interactive chat interface with the cash agent

## Tech Stack

- React 19 with TypeScript
- Material-UI (MUI) 6 with SAP Horizon theme
- Recharts for data visualization
- React Router 7 for navigation
- TanStack Query for data fetching
- Vite for build tooling

## Development

```bash
# Install dependencies
npm install

# Start dev server (with proxy to backend on :8085)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Docker

```bash
# Build image
docker build -t cash-agent-ui .

# Run container
docker run -p 5173:5173 cash-agent-ui
```

## Configuration

The UI proxies API requests to the backend service running on `localhost:8085`. This can be configured in `vite.config.ts` (dev) and `nginx.conf` (production).

## Mock Data

Currently uses mock data matching the demo scenarios. To connect to real backend:

1. Update functions in `src/api/bigquery.ts`
2. Replace mock returns with actual fetch calls to `/api/*` endpoints
3. Backend should implement REST API for cash positions, forecasts, approvals, and audit logs

## SAP Horizon Colors

- Primary Blue: #0070F2
- Background: #F5F6F7
- Header Navy: #1D2D3E
- Success Green: #36A41D
- Warning Orange: #E76500
- Error Red: #CC1919
