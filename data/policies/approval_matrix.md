# Treasury Approval Matrix

## 1. Purpose

This matrix defines the approval authority levels for treasury transactions. All amounts are in USD equivalent.

## 2. Transaction Approval Thresholds

### 2.1 Cash Investments (Term Deposits, Money Market, T-Bills)

| Amount (USD Equivalent) | Required Approval |
|------------------------|-------------------|
| Up to $100,000 | Treasury Analyst |
| $100,001 - $500,000 | Treasury Manager |
| $500,001 - $2,000,000 | VP Treasury |
| $2,000,001 - $5,000,000 | CFO |
| Above $5,000,000 | CFO + Board Finance Committee |

### 2.2 FX Transactions (Spot and Forward)

| Amount (USD Equivalent) | Required Approval |
|------------------------|-------------------|
| Up to $250,000 | Treasury Analyst |
| $250,001 - $1,000,000 | Treasury Manager |
| $1,000,001 - $3,000,000 | VP Treasury |
| Above $3,000,000 | CFO |

### 2.3 Interbank Transfers

| Amount (USD Equivalent) | Required Approval |
|------------------------|-------------------|
| Up to $500,000 | Treasury Analyst |
| $500,001 - $2,000,000 | Treasury Manager |
| Above $2,000,000 | VP Treasury |

### 2.4 Vendor Payments (Ad-hoc, outside regular payment runs)

| Amount (USD Equivalent) | Required Approval |
|------------------------|-------------------|
| Up to $50,000 | AP Clerk |
| $50,001 - $250,000 | AP Manager |
| $250,001 - $1,000,000 | Treasury Manager |
| Above $1,000,000 | VP Treasury |

## 3. Agent Automation Rules

### 3.1 Automated Execution (No Human Approval)
The Cash Agent may execute transactions automatically when:
- Amount is below $100,000 USD equivalent AND
- Transaction type is routine (scheduled payment run, standard FX hedge) AND
- Transaction complies with all policy limits

### 3.2 User Confirmation Required
The Cash Agent must request explicit user confirmation when:
- Amount is between $100,000 and $500,000 USD equivalent
- Action involves a new counterparty
- Action deviates from standard parameters

### 3.3 Formal Approval Workflow Required
The Cash Agent must create a formal approval request when:
- Amount exceeds $500,000 USD equivalent
- Transaction type requires VP or higher approval per sections 2.1-2.4
- Action involves an exception to policy limits

## 4. Approval Process

### 4.1 Request Submission
- All approval requests must include: action type, amount, currency, rationale, policy reference
- Requests are logged in the approval_requests table with status PENDING

### 4.2 Response Time
- Requests under $2M: response expected within 4 business hours
- Requests over $2M: response expected within 1 business day

### 4.3 Escalation
- If no response within SLA, escalate to the next approval level
- Emergency transactions may be executed with post-facto approval (must be documented)
