import { Box, Card, CardContent, Container, Grid, Paper, Typography, Chip, Divider } from '@mui/material'
import {
  TrendingUp as ForecastIcon,
  Analytics as AnalyzeIcon,
  RocketLaunch as ExecuteIcon,
  Storage as BigQueryIcon,
  SmartToy as AgentIcon,
  Api as ApiIcon,
  Cloud as CloudIcon,
  Schedule as SchedulerIcon,
  Policy as PolicyIcon,
  Chat as ChatIcon,
  AccountBalance as SapIcon,
  ShowChart as BqmlIcon,
  Hub as HubIcon,
  Security as SecurityIcon,
} from '@mui/icons-material'

const stageCardSx = {
  flex: 1,
  minWidth: 260,
  position: 'relative',
  border: '1px solid',
  borderColor: 'divider',
  borderRadius: 2,
  bgcolor: 'background.paper',
}

const arrowSx = {
  display: { xs: 'none', md: 'flex' },
  alignItems: 'center',
  px: 1,
  fontSize: '2rem',
  color: 'text.secondary',
  fontWeight: 300,
}

const flowNodeSx = {
  p: 2,
  border: '1px solid',
  borderColor: 'divider',
  borderRadius: 2,
  bgcolor: 'background.paper',
  textAlign: 'center' as const,
  position: 'relative',
}

const connectorSx = {
  display: 'flex',
  justifyContent: 'center',
  py: 1,
  color: 'text.secondary',
  fontSize: '1.5rem',
}

const Architecture = () => {
  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Section 1: Agentic Flow */}
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
        Agentic Flow
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        The cash agent operates as a three-stage pipeline, each powered by specialized sub-agents.
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: { xs: 2, md: 0 }, mb: 6 }}>
        {/* Stage 1: Forecast */}
        <Card sx={stageCardSx} elevation={0}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
              <ForecastIcon color="primary" />
              <Typography variant="h6" sx={{ fontWeight: 600 }}>Forecast</Typography>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              BQML ARIMA+ model generates 30/60/90-day cash flow predictions across all currencies and accounts.
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              <Chip label="CashPositionAgent" size="small" variant="outlined" />
              <Chip label="CashForecastAgent" size="small" variant="outlined" />
              <Chip label="AnomalyDetectionAgent" size="small" variant="outlined" />
            </Box>
          </CardContent>
        </Card>

        <Box sx={arrowSx}>&rarr;</Box>

        {/* Stage 2: Evaluate */}
        <Card sx={stageCardSx} elevation={0}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
              <AnalyzeIcon color="primary" />
              <Typography variant="h6" sx={{ fontWeight: 600 }}>Evaluate & Recommend</Typography>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Agent analyzes forecasts, treasury policies, and detected anomalies to generate prioritized recommendations.
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              <Chip label="RecommendationAgent" size="small" variant="outlined" />
              <Chip label="ScenarioSimulationAgent" size="small" variant="outlined" />
            </Box>
          </CardContent>
        </Card>

        <Box sx={arrowSx}>&rarr;</Box>

        {/* Stage 3: Execute */}
        <Card sx={stageCardSx} elevation={0}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
              <ExecuteIcon color="primary" />
              <Typography variant="h6" sx={{ fontWeight: 600 }}>Deploy & Execute</Typography>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Approved actions executed via API calls — transfers, FX trades, SAP postings.
            </Typography>
            <Box sx={{ mb: 1.5 }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                Three-tier authorization:
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25, mt: 0.5 }}>
                <Typography variant="caption">Auto-approve: &lt; $100K</Typography>
                <Typography variant="caption">Confirm: $100K &ndash; $500K</Typography>
                <Typography variant="caption">Formal approval: &gt; $500K</Typography>
              </Box>
            </Box>
            <Chip label="ExecutionAgent" size="small" variant="outlined" />
          </CardContent>
        </Card>
      </Box>

      <Divider sx={{ mb: 4 }} />

      {/* Section 2: Technical Architecture */}
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
        Technical Architecture
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        End-to-end data flow from source systems through AI-powered analysis to execution.
      </Typography>

      <Grid container spacing={3}>
        {/* Main pipeline (left/center) */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3, border: '1px solid', borderColor: 'divider' }} elevation={0}>
            {/* SAP ERP */}
            <Box sx={flowNodeSx}>
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 1 }}>
                <SapIcon color="primary" />
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>SAP ERP</Typography>
              </Box>
              <Typography variant="caption" color="text.secondary">Source of Truth</Typography>
              <Typography variant="caption" display="block" color="text.secondary">
                AR/AP invoices, bank balances, payment runs
              </Typography>
            </Box>

            <Box sx={connectorSx}>&darr;</Box>

            {/* BigQuery */}
            <Box sx={flowNodeSx}>
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 1 }}>
                <BigQueryIcon color="primary" />
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>BigQuery</Typography>
              </Box>
              <Typography variant="caption" color="text.secondary">Data Warehouse</Typography>
              <Typography variant="caption" display="block" color="text.secondary">
                9 tables: cash_positions, ar_invoices, ap_invoices, fx_rates, bank_accounts, payment_runs, forecasts, anomalies, recommendations
              </Typography>
            </Box>

            <Box sx={connectorSx}>&darr;</Box>

            {/* BQML */}
            <Box sx={flowNodeSx}>
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 1 }}>
                <BqmlIcon color="primary" />
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>BQML ARIMA+</Typography>
              </Box>
              <Typography variant="caption" color="text.secondary">Cash Flow Forecasting</Typography>
              <Typography variant="caption" display="block" color="text.secondary">
                Time-series model trained on historical cash positions, generates 30/60/90-day forecasts
              </Typography>
            </Box>

            <Box sx={connectorSx}>&darr;</Box>

            {/* Vertex AI Agent Engine */}
            <Box sx={{ ...flowNodeSx, borderColor: 'primary.main', borderWidth: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 1 }}>
                <AgentIcon color="primary" />
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Vertex AI Agent Engine</Typography>
              </Box>
              <Typography variant="caption" color="text.secondary">Agent Runtime</Typography>
              <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 0.5 }}>
                <Chip label="ADK Root Agent" size="small" color="primary" variant="outlined" />
                <Chip label="6 Sub-Agents" size="small" variant="outlined" />
                <Chip label="Gemini 2.5 Flash" size="small" variant="outlined" />
              </Box>
              <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 1 }}>
                Policy-grounded recommendations
              </Typography>
            </Box>

            <Box sx={connectorSx}>&darr;</Box>

            {/* Apigee */}
            <Box sx={flowNodeSx}>
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 1 }}>
                <SecurityIcon color="primary" />
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Apigee</Typography>
              </Box>
              <Typography variant="caption" color="text.secondary">API Gateway</Typography>
            </Box>

            <Box sx={connectorSx}>&darr;</Box>

            {/* Execution targets */}
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 1.5 }}>
              {[
                { label: 'SAP ERP', desc: 'Journal postings' },
                { label: 'Bank APIs', desc: 'Transfers & deposits' },
                { label: 'Broker APIs', desc: 'FX trades' },
              ].map((target) => (
                <Box key={target.label} sx={{ ...flowNodeSx, flex: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 0.5 }}>
                    <ApiIcon fontSize="small" color="primary" />
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>{target.label}</Typography>
                  </Box>
                  <Typography variant="caption" color="text.secondary">{target.desc}</Typography>
                </Box>
              ))}
            </Box>
          </Paper>
        </Grid>

        {/* Side components (right) */}
        <Grid item xs={12} md={4}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <ChatIcon color="primary" />
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Gemini Enterprise</Typography>
                </Box>
                <Typography variant="caption" color="text.secondary">
                  User-facing conversational interface to the ADK agent. Natural language queries for cash positions, forecasts, and ad-hoc analysis.
                </Typography>
              </CardContent>
            </Card>

            <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <HubIcon color="primary" />
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Agent Engine</Typography>
                </Box>
                <Typography variant="caption" color="text.secondary">
                  Vertex AI managed runtime hosting the ADK agent. Handles session management, tool orchestration, and sub-agent delegation.
                </Typography>
              </CardContent>
            </Card>

            <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <CloudIcon color="primary" />
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Cloud Run</Typography>
                </Box>
                <Typography variant="caption" color="text.secondary">
                  Hosts the React UI, REST API, agent runner, and three mock services (SAP, Bank, Broker) as serverless containers.
                </Typography>
              </CardContent>
            </Card>

            <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <SchedulerIcon color="primary" />
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Cloud Scheduler</Typography>
                </Box>
                <Typography variant="caption" color="text.secondary">
                  Autonomous agent operations: data refresh (2 AM), daily review (4x/day), anomaly scan (every 2h).
                </Typography>
              </CardContent>
            </Card>

            <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <PolicyIcon color="primary" />
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Treasury Policies</Typography>
                </Box>
                <Typography variant="caption" color="text.secondary">
                  Policy documents grounding agent recommendations: investment, FX hedging, and liquidity policies enforced at inference time.
                </Typography>
              </CardContent>
            </Card>
          </Box>
        </Grid>
      </Grid>
    </Container>
  )
}

export default Architecture
