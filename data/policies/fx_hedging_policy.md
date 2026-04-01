---
thresholds:
  hedge_thresholds:
    EUR: 750000
    GBP: 500000
    JPY: 50000000
    CHF: 500000
    SGD: 500000
    AUD: 500000
  hedge_ratio_min: 0.8
  hedge_ratio_max: 1.0
  max_hedge_tenor_days: 90
  favorable_rate_move_pct: 0.5
---
# Foreign Exchange Hedging Policy

## 1. Purpose

This policy establishes guidelines for managing foreign exchange risk across the company's multi-currency operations (USD, EUR, GBP, JPY, CHF, SGD, AUD).

## 2. Hedging Requirements

### 2.1 Mandatory Hedging Thresholds
FX exposures must be hedged when:
- USD exposure exceeds $1,000,000
- EUR exposure exceeds EUR 750,000
- GBP exposure exceeds GBP 500,000
- JPY exposure exceeds JPY 50,000,000
- CHF exposure exceeds CHF 500,000
- SGD exposure exceeds SGD 500,000
- AUD exposure exceeds AUD 500,000

An "exposure" is defined as a net currency obligation (payables minus receivables) in a foreign currency with no natural offset within 30 days.

### 2.2 Hedge Ratio
Required hedge ratio: 80-100% of identified exposure.

### 2.3 Approved Hedge Instruments
- FX forward contracts (preferred)
- FX spot transactions (for immediate needs)
- FX options (requires CFO pre-approval)

### 2.4 Maximum Tenor
Hedges should not exceed 90 days tenor. Longer tenors require CFO approval.

## 3. Execution Guidelines

### 3.1 Counterparty Requirements
FX trades must be executed through approved broker counterparties:
- GlobalFX Brokers (primary)
- InterBank FX (secondary)
- MUFG FX Desk (Asia-Pacific)
- UBS FX (Europe/CHF)

### 3.2 Rate Monitoring
Treasury must monitor FX rates daily and execute hedges when:
- An exposure threshold is breached, OR
- Rates move favorably by more than 0.5% from the budgeted rate

### 3.3 Documentation
All FX trades must be:
- Confirmed in writing within 24 hours
- Posted to SAP on trade date
- Reported in the weekly treasury summary

## 4. Exposure Reporting

### 4.1 Daily Monitoring
Net FX exposure by currency must be calculated daily using:
- Open AP items in foreign currency
- Open AR items in foreign currency (probability-weighted)
- Existing hedge positions

### 4.2 Weekly Reporting
A weekly FX exposure report must be submitted to the CFO showing:
- Net exposure by currency
- Hedge coverage ratio
- Mark-to-market on existing hedges
- Recommended actions
