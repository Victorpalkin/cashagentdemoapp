#!/usr/bin/env python3
"""
Generate seed CSV files for Cash Agent Demo.
All dates are relative to a configurable 'today' parameter so seed data
can be regenerated daily.

Generated files:
- fx_rates.csv:       12 months of daily FX rates (7 currencies)
- cash_journal.csv:   12 months of daily transactions (7 currencies)
- ar_open_items.csv:  ~80 open AR items (due today+1 .. today+29)
- ap_open_items.csv:  ~95 open AP items (due today+2 .. today+29)
- bank_accounts.csv:  14 bank accounts (last_updated = today)
- payment_runs.csv:   10 scheduled payment runs
"""

import argparse
import csv
import random
from datetime import date, datetime, timedelta
from pathlib import Path

OUTPUT_DIR = Path(__file__).parent

# ---- Counterparties ----

COUNTERPARTIES = {
    'USD_INFLOW': [
        'TechGlobal Solutions', 'MegaCorp USA', 'American Logistics Inc',
        'Global Pharma Corp', 'TransAtlantic Shipping', 'Continental Systems',
        'Midwest Manufacturing', 'Sunrise Technologies', 'Coastal Shipping USA',
        'Sunbelt Energy Corp', 'Midwest Agribusiness', 'Pacific Trading Corp',
        'Western Digital Corp', 'Northeast Industries', 'Southern Manufacturing',
        'Central Systems Inc', 'Atlantic Corp', 'National Services LLC',
        'Apex Data Systems', 'Liberty Financial Group', 'Pinnacle Health Inc',
        'Summit Logistics Corp', 'Frontier Energy LLC', 'Columbia River Tech',
    ],
    'EUR_INFLOW': [
        'AutoMotive Industries GmbH', 'Nordic Energy AS', 'Deutsche Industrial AG',
        'EuroTech Solutions', 'FranceTech SA', 'Siemens Digital Industries',
        'Berlin Analytics GmbH', 'Rhine Logistics AG', 'Munich Automotive',
        'Hamburg Port Services', 'Stuttgart Engineering', 'ACME Corp',
        'Frankfurt Solutions', 'Vienna Tech GmbH', 'Milan Industries',
        'Barcelona Dynamics SL', 'Amsterdam Data BV', 'Zurich Instruments AG',
    ],
    'GBP_INFLOW': [
        'British Retail Group', 'London Financial Services', 'Highland Manufacturing',
        'Westminster Holdings', 'Manchester United Industries', 'Oxford Research Labs',
        'Cambridge Biotech', 'Scottish Energy Solutions', 'Cardiff Construction Ltd',
        'Bristol Aerospace', 'Metropolitan Transit', 'Edinburgh Systems',
        'Leeds Precision Engineering', 'Liverpool Maritime Services',
    ],
    'JPY_INFLOW': [
        'Toyota Motor Corp', 'SoftBank Group', 'Mitsubishi Electric',
        'Hitachi Solutions', 'Sony Interactive', 'NTT Data Corp',
        'Panasonic Holdings', 'Fujitsu Limited', 'NEC Corporation',
        'Sumitomo Chemical', 'Takeda Pharmaceutical', 'Rakuten Group',
        'Daikin Industries', 'Komatsu Ltd',
    ],
    'CHF_INFLOW': [
        'Nestle SA', 'Novartis AG', 'ABB Ltd', 'Roche Holding AG',
        'Zurich Insurance Group', 'Swiss Re AG', 'Swatch Group',
        'Lonza Group AG', 'Geberit AG', 'Schindler Holding',
    ],
    'SGD_INFLOW': [
        'Singapore Airlines', 'DBS Group Holdings', 'Singtel',
        'CapitaLand Investment', 'Keppel Corporation', 'Wilmar International',
        'Sea Limited', 'Grab Holdings', 'Mapletree Investments',
        'Sembcorp Industries', 'ComfortDelGro Corp',
    ],
    'AUD_INFLOW': [
        'BHP Group', 'Telstra Group', 'Woolworths Group', 'Rio Tinto Ltd',
        'CSL Limited', 'Commonwealth Bank', 'Wesfarmers Ltd',
        'Macquarie Group', 'Fortescue Metals', 'Woodside Energy',
        'Brambles Ltd', 'Transurban Group',
    ],
    'USD_OUTFLOW': [
        'Oracle Corp', 'Microsoft Corp', 'Cisco Systems', 'IBM Corp',
        'Amazon Web Services', 'Adobe Systems', 'Salesforce Inc', 'VMware Inc',
        'Honeywell International', 'General Electric', 'Caterpillar Inc',
        '3M Company', 'KPMG LLP', 'EY Global', 'Deloitte Consulting',
        'Accenture PLC', 'Workday Inc', 'Office Depot', 'Staples Inc',
        'AT&T Services', 'Verizon Business', 'Waste Management Inc',
        'Palo Alto Networks', 'ServiceNow Inc', 'Snowflake Inc',
    ],
    'EUR_OUTFLOW': [
        'Siemens AG', 'SAP SE', 'BASF SE', 'Volkswagen AG', 'Bayer AG',
        'Deutsche Telekom', 'Allianz SE', 'ThyssenKrupp AG', 'Bosch Group',
        'Capgemini SE', 'Airbus SE', 'Schneider Electric', "L'Oreal SA",
        'Lufthansa AG', 'Deutsche Post', 'RWE Energy',
        'Infineon Technologies', 'Continental AG',
    ],
    'GBP_OUTFLOW': [
        'Shell Energy', 'BP Energy', 'Rolls-Royce Holdings', 'Unilever PLC',
        'Vodafone Group', 'BAE Systems', 'BT Group', 'AstraZeneca PLC',
        'Tesco PLC', 'British Gas', 'Royal Mail', "Sainsbury's",
        'Aviva PLC', 'Legal & General',
    ],
    'JPY_OUTFLOW': [
        'Toyota Tsusho', 'Mitsui & Co', 'Marubeni Corp', 'ITOCHU Corp',
        'Sumitomo Corp', 'Nippon Steel', 'JFE Holdings', 'Denso Corp',
        'Murata Manufacturing', 'Keyence Corp', 'Shin-Etsu Chemical',
        'FANUC Corporation',
    ],
    'CHF_OUTFLOW': [
        'Credit Suisse Services', 'Holcim Group', 'Sika AG', 'Sonova Holding',
        'Straumann Holding', 'Temenos AG', 'Kuehne+Nagel', 'Lindt & Sprungli',
        'Swisscom AG', 'Georg Fischer AG',
    ],
    'SGD_OUTFLOW': [
        'Singapore Power', 'SMRT Corporation', 'SingPost', 'StarHub Ltd',
        'Neptune Orient Lines', 'Olam Group', 'Venture Corporation',
        'ST Engineering', 'CapitaLand Ascendas', 'Frasers Property',
    ],
    'AUD_OUTFLOW': [
        'Telstra Corp', 'AGL Energy', 'Origin Energy', 'Qantas Airways',
        'Lendlease Group', 'Downer EDI', 'CIMIC Group', 'Incitec Pivot',
        'Boral Limited', 'BlueScope Steel', 'Cleanaway Waste',
    ],
}

GL_ACCOUNTS = {
    'USD_INFLOW': ['1200', '4000', '4010'],
    'EUR_INFLOW': ['1210', '4020', '4030'],
    'GBP_INFLOW': ['1220', '4040'],
    'USD_OUTFLOW': ['2000', '5000', '6000', '6100', '6200', '6300', '6400'],
    'EUR_OUTFLOW': ['2010', '5010', '6300'],
    'GBP_OUTFLOW': ['2020', '6200'],
    'JPY_INFLOW': ['1230', '4050', '4060'],
    'JPY_OUTFLOW': ['2030', '5020'],
    'CHF_INFLOW': ['1240', '4070'],
    'CHF_OUTFLOW': ['2040', '5030'],
    'SGD_INFLOW': ['1250', '4080', '4090'],
    'SGD_OUTFLOW': ['2050', '5040'],
    'AUD_INFLOW': ['1260', '4100', '4110'],
    'AUD_OUTFLOW': ['2060', '5050'],
}

BANK_ACCOUNTS = {
    'USD': ['BA001', 'BA002', 'BA003'],
    'EUR': ['BA004', 'BA005'],
    'GBP': ['BA006', 'BA007'],
    'JPY': ['BA008', 'BA009'],
    'CHF': ['BA010'],
    'SGD': ['BA011', 'BA012'],
    'AUD': ['BA013', 'BA014'],
}

# Transaction descriptions per flow type
INFLOW_DESCRIPTIONS = [
    'Customer payment received', 'Product sales revenue',
    'Service fee payment', 'License renewal payment',
    'Consulting services payment', 'Project milestone payment',
    'Subscription revenue', 'Maintenance contract payment',
]

OUTFLOW_DESCRIPTIONS = [
    'Vendor payment', 'Service provider payment',
    'Material procurement', 'Utilities payment',
    'Professional services', 'Maintenance services',
    'Equipment lease payment', 'Software subscription',
]


def is_weekday(d):
    """Check if date is a weekday (Monday=0, Sunday=6)"""
    return d.weekday() < 5


def is_payroll_day(d):
    """Check if date is a payroll day (15th or last day of month)"""
    if d.day == 15:
        return True
    next_day = d + timedelta(days=1)
    return next_day.month != d.month


def _to_date(today):
    """Convert today to a date object if it's a datetime."""
    if isinstance(today, datetime):
        return today.date()
    return today


def generate_fx_rates(today):
    """Generate daily FX rates for 12 months + today, 7 currencies."""
    today = _to_date(today)
    start_date = today - timedelta(days=365)

    print("Generating fx_rates.csv...")

    rates_file = OUTPUT_DIR / 'fx_rates.csv'

    # Base rates and fluctuation bands
    fx_config = {
        # (from, to): (base_rate, fluctuation, today_fixed)
        ('EUR', 'USD'): (1.08, 0.02, 1.08),
        ('GBP', 'USD'): (1.27, 0.02, 1.27),
        ('EUR', 'GBP'): (0.85, 0.01, 0.8504),
        ('JPY', 'USD'): (0.0067, 0.0003, 0.0067),
        ('CHF', 'USD'): (1.12, 0.02, 1.12),
        ('SGD', 'USD'): (0.75, 0.01, 0.75),
        ('AUD', 'USD'): (0.66, 0.02, 0.66),
        # Cross rates
        ('JPY', 'EUR'): (0.0062, 0.0003, 0.0062),
        ('CHF', 'EUR'): (1.037, 0.015, 1.037),
        ('SGD', 'GBP'): (0.59, 0.01, 0.59),
        ('AUD', 'GBP'): (0.52, 0.01, 0.52),
    }

    with open(rates_file, 'w', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(['rate_date', 'from_currency', 'to_currency', 'exchange_rate'])

        current_date = start_date
        while current_date <= today:
            date_str = current_date.strftime('%Y-%m-%d')

            for (from_cur, to_cur), (base, fluct, today_fixed) in fx_config.items():
                if current_date == today:
                    rate = today_fixed
                else:
                    rate = round(base + random.uniform(-fluct, fluct), 4)
                writer.writerow([date_str, from_cur, to_cur, rate])

            current_date += timedelta(days=1)

    print(f"  Created {rates_file}")


def _day_seasonality(d):
    """Return multipliers for (inflow_amount, outflow_amount, inflow_count, outflow_count).

    Creates weekly and monthly patterns that TimesFM can detect:
    - Monday: heavy outflow day (vendor batch payments)
    - Tuesday-Wednesday: peak inflow days (customer payments settle)
    - Thursday: moderate
    - Friday: light (end of week)
    - Month-end (last 3 days): heavy outflows (settlements, rent, subscriptions)
    - Month-start (first 3 days): heavy inflows (monthly contracts pay)
    """
    dow = d.weekday()  # 0=Mon, 4=Fri
    dom = d.day
    next_day = d + timedelta(days=1)
    is_month_end = next_day.month != d.month or (next_day + timedelta(days=1)).month != d.month or (next_day + timedelta(days=2)).month != d.month
    is_month_start = dom <= 3

    # Base weekly pattern: (inflow_amt_mult, outflow_amt_mult, inflow_count_adj, outflow_count_adj)
    weekly = {
        0: (0.85, 1.35, 0, 2),    # Monday: heavy outflows
        1: (1.25, 0.90, 2, 0),    # Tuesday: peak inflows
        2: (1.20, 0.85, 1, 0),    # Wednesday: strong inflows
        3: (1.00, 1.05, 0, 0),    # Thursday: moderate
        4: (0.75, 0.80, -1, -1),  # Friday: light
    }
    in_amt, out_amt, in_cnt, out_cnt = weekly[dow]

    # Monthly overlay
    if is_month_end:
        out_amt *= 1.4
        out_cnt += 2
    if is_month_start:
        in_amt *= 1.3
        in_cnt += 2

    # Quarter-end bump (Mar, Jun, Sep, Dec last week)
    if d.month in (3, 6, 9, 12) and dom >= 25:
        in_amt *= 1.15   # quarterly contract payments arrive
        out_amt *= 1.25  # quarterly settlements go out

    # Gradual growth trend: ~0.5% per month over the year
    months_from_start = (d.year - 2025) * 12 + d.month - 3
    trend = 1.0 + 0.005 * max(0, months_from_start)
    in_amt *= trend
    out_amt *= trend

    return in_amt, out_amt, in_cnt, out_cnt


def _is_anomaly_spike_day(d, today):
    """Check if this date should have an anomaly-engineered spike."""
    days_ago = (today - d).days
    # EUR outflow spike on today-5
    if days_ago == 5:
        return 'EUR_OUTFLOW_SPIKE'
    # Missing JPY inflows on today-8
    if days_ago == 8:
        return 'JPY_INFLOW_SKIP'
    # Double USD inflows on today-3
    if days_ago == 3:
        return 'USD_INFLOW_DOUBLE'
    return None


def generate_cash_journal(today):
    """Generate 12 months of cash journal entries with weekly/monthly seasonality."""
    today = _to_date(today)
    start_date = today - timedelta(days=365)
    end_date = today - timedelta(days=1)

    print("Generating cash_journal.csv...")

    journal_file = OUTPUT_DIR / 'cash_journal.csv'
    journal_id = 1

    with open(journal_file, 'w', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(['journal_id', 'posting_date', 'amount', 'currency',
                         'transaction_type', 'counterparty', 'gl_account',
                         'description', 'bank_account_id'])

        current_date = start_date
        acme_late_count = 0

        while current_date <= end_date:
            if not is_weekday(current_date):
                current_date += timedelta(days=1)
                continue

            date_str = current_date.strftime('%Y-%m-%d')
            in_amt_mult, out_amt_mult, in_cnt_adj, out_cnt_adj = _day_seasonality(current_date)
            anomaly = _is_anomaly_spike_day(current_date, today)

            # --- Payroll (USD) ---
            if is_payroll_day(current_date):
                payroll = int(random.randint(1450000, 1550000) * out_amt_mult)
                writer.writerow([
                    f'CJ-{journal_id:06d}', date_str, payroll, 'USD',
                    'OUTFLOW', 'ADP Payroll Services', '6000',
                    'Monthly payroll processing',
                    random.choice(BANK_ACCOUNTS['USD'])
                ])
                journal_id += 1

            # --- Intercompany transfers (monthly, on the 10th) ---
            if current_date.day == 10:
                # USD -> EUR intercompany
                writer.writerow([
                    f'CJ-{journal_id:06d}', date_str,
                    int(random.randint(200000, 400000) * out_amt_mult),
                    'USD', 'OUTFLOW', 'Intercompany - EUR Entity', '6500',
                    'Monthly intercompany funding transfer',
                    random.choice(BANK_ACCOUNTS['USD'])
                ])
                journal_id += 1
                # EUR intercompany receipt
                writer.writerow([
                    f'CJ-{journal_id:06d}', date_str,
                    int(random.randint(180000, 360000) * in_amt_mult),
                    'EUR', 'INFLOW', 'Intercompany - USD Entity', '4030',
                    'Monthly intercompany funding received',
                    random.choice(BANK_ACCOUNTS['EUR'])
                ])
                journal_id += 1

            # --- Recurring subscriptions (1st of month) ---
            if current_date.day == 1:
                for sub_name, sub_amount, sub_cur in [
                    ('Salesforce Inc', 45000, 'USD'),
                    ('SAP SE', 38000, 'EUR'),
                    ('Microsoft Corp', 62000, 'USD'),
                ]:
                    writer.writerow([
                        f'CJ-{journal_id:06d}', date_str,
                        int(sub_amount * out_amt_mult), sub_cur,
                        'OUTFLOW', sub_name,
                        random.choice(GL_ACCOUNTS[f'{sub_cur}_OUTFLOW']),
                        'Monthly SaaS subscription',
                        random.choice(BANK_ACCOUNTS[sub_cur])
                    ])
                    journal_id += 1

            # --- Quarterly rent (1st of quarter months) ---
            if current_date.day == 1 and current_date.month in (1, 4, 7, 10):
                for rent_desc, rent_amt, rent_cur in [
                    ('CBRE Group - HQ Lease', 285000, 'USD'),
                    ('JLL Property - Frankfurt Office', 125000, 'EUR'),
                    ('Knight Frank - London Office', 95000, 'GBP'),
                    ('Mitsui Fudosan - Tokyo Office', 18000000, 'JPY'),
                ]:
                    writer.writerow([
                        f'CJ-{journal_id:06d}', date_str,
                        int(rent_amt * out_amt_mult), rent_cur,
                        'OUTFLOW', rent_desc.split(' - ')[0],
                        random.choice(GL_ACCOUNTS[f'{rent_cur}_OUTFLOW']),
                        rent_desc,
                        random.choice(BANK_ACCOUNTS[rent_cur])
                    ])
                    journal_id += 1

            # ============ USD ============
            usd_inflow_count = max(1, random.randint(3, 6) + in_cnt_adj)
            if anomaly == 'USD_INFLOW_DOUBLE':
                usd_inflow_count *= 2  # Double the inflows for anomaly
            for _ in range(usd_inflow_count):
                amount = int(random.randint(80000, 150000) * in_amt_mult)
                if anomaly == 'USD_INFLOW_DOUBLE':
                    amount = int(amount * 1.5)  # Also increase amounts
                writer.writerow([
                    f'CJ-{journal_id:06d}', date_str, amount, 'USD', 'INFLOW',
                    random.choice(COUNTERPARTIES['USD_INFLOW']),
                    random.choice(GL_ACCOUNTS['USD_INFLOW']),
                    'Accelerated contract payments' if anomaly == 'USD_INFLOW_DOUBLE'
                    else random.choice(INFLOW_DESCRIPTIONS),
                    random.choice(BANK_ACCOUNTS['USD'])
                ])
                journal_id += 1

            usd_outflows = max(1, random.randint(3, 6) + out_cnt_adj)
            for _ in range(usd_outflows):
                amount = int(random.randint(60000, 120000) * out_amt_mult)
                writer.writerow([
                    f'CJ-{journal_id:06d}', date_str, amount, 'USD', 'OUTFLOW',
                    random.choice(COUNTERPARTIES['USD_OUTFLOW']),
                    random.choice(GL_ACCOUNTS['USD_OUTFLOW']),
                    random.choice(OUTFLOW_DESCRIPTIONS),
                    random.choice(BANK_ACCOUNTS['USD'])
                ])
                journal_id += 1

            # ============ EUR ============
            eur_inflows = max(1, random.randint(2, 4) + in_cnt_adj)
            for _ in range(eur_inflows):
                amount = int(random.randint(30000, 80000) * in_amt_mult)
                counterparty = random.choice(COUNTERPARTIES['EUR_INFLOW'])

                if counterparty == 'ACME Corp' and random.random() < 0.3:
                    acme_late_count += 1
                    desc = random.choice([
                        'Customer payment - received late',
                        'Project milestone payment - delayed',
                    ])
                else:
                    desc = random.choice(INFLOW_DESCRIPTIONS)

                writer.writerow([
                    f'CJ-{journal_id:06d}', date_str, amount, 'EUR', 'INFLOW',
                    counterparty, random.choice(GL_ACCOUNTS['EUR_INFLOW']),
                    desc, random.choice(BANK_ACCOUNTS['EUR'])
                ])
                journal_id += 1

            eur_outflows = max(1, random.randint(2, 4) + out_cnt_adj)
            # EUR outflow spike anomaly
            if anomaly == 'EUR_OUTFLOW_SPIKE':
                writer.writerow([
                    f'CJ-{journal_id:06d}', date_str, 800000, 'EUR', 'OUTFLOW',
                    'Siemens AG', '5010',
                    'Emergency equipment replacement - unplanned capital expenditure',
                    random.choice(BANK_ACCOUNTS['EUR'])
                ])
                journal_id += 1
            for _ in range(eur_outflows):
                amount = int(random.randint(20000, 60000) * out_amt_mult)
                writer.writerow([
                    f'CJ-{journal_id:06d}', date_str, amount, 'EUR', 'OUTFLOW',
                    random.choice(COUNTERPARTIES['EUR_OUTFLOW']),
                    random.choice(GL_ACCOUNTS['EUR_OUTFLOW']),
                    random.choice(OUTFLOW_DESCRIPTIONS),
                    random.choice(BANK_ACCOUNTS['EUR'])
                ])
                journal_id += 1

            # ============ GBP ============
            gbp_inflows = max(1, random.randint(1, 3) + in_cnt_adj)
            for _ in range(gbp_inflows):
                amount = int(random.randint(10000, 40000) * in_amt_mult)
                writer.writerow([
                    f'CJ-{journal_id:06d}', date_str, amount, 'GBP', 'INFLOW',
                    random.choice(COUNTERPARTIES['GBP_INFLOW']),
                    random.choice(GL_ACCOUNTS['GBP_INFLOW']),
                    random.choice(INFLOW_DESCRIPTIONS),
                    random.choice(BANK_ACCOUNTS['GBP'])
                ])
                journal_id += 1

            gbp_outflows = max(1, random.randint(1, 3) + out_cnt_adj)
            for _ in range(gbp_outflows):
                amount = int(random.randint(8000, 30000) * out_amt_mult)
                writer.writerow([
                    f'CJ-{journal_id:06d}', date_str, amount, 'GBP', 'OUTFLOW',
                    random.choice(COUNTERPARTIES['GBP_OUTFLOW']),
                    random.choice(GL_ACCOUNTS['GBP_OUTFLOW']),
                    random.choice(OUTFLOW_DESCRIPTIONS),
                    random.choice(BANK_ACCOUNTS['GBP'])
                ])
                journal_id += 1

            # ============ JPY ============
            if anomaly != 'JPY_INFLOW_SKIP':
                jpy_inflows = max(1, random.randint(2, 4) + in_cnt_adj)
                for _ in range(jpy_inflows):
                    amount = int(random.randint(5000000, 20000000) * in_amt_mult)
                    writer.writerow([
                        f'CJ-{journal_id:06d}', date_str, amount, 'JPY', 'INFLOW',
                        random.choice(COUNTERPARTIES['JPY_INFLOW']),
                        random.choice(GL_ACCOUNTS['JPY_INFLOW']),
                        random.choice(INFLOW_DESCRIPTIONS),
                        random.choice(BANK_ACCOUNTS['JPY'])
                    ])
                    journal_id += 1

            jpy_outflows = max(1, random.randint(2, 4) + out_cnt_adj)
            for _ in range(jpy_outflows):
                amount = int(random.randint(3000000, 15000000) * out_amt_mult)
                writer.writerow([
                    f'CJ-{journal_id:06d}', date_str, amount, 'JPY', 'OUTFLOW',
                    random.choice(COUNTERPARTIES['JPY_OUTFLOW']),
                    random.choice(GL_ACCOUNTS['JPY_OUTFLOW']),
                    random.choice(OUTFLOW_DESCRIPTIONS),
                    random.choice(BANK_ACCOUNTS['JPY'])
                ])
                journal_id += 1

            # ============ CHF ============
            chf_inflows = max(1, random.randint(1, 3) + in_cnt_adj)
            for _ in range(chf_inflows):
                amount = int(random.randint(20000, 80000) * in_amt_mult)
                writer.writerow([
                    f'CJ-{journal_id:06d}', date_str, amount, 'CHF', 'INFLOW',
                    random.choice(COUNTERPARTIES['CHF_INFLOW']),
                    random.choice(GL_ACCOUNTS['CHF_INFLOW']),
                    random.choice(INFLOW_DESCRIPTIONS),
                    random.choice(BANK_ACCOUNTS['CHF'])
                ])
                journal_id += 1

            chf_outflows = max(1, random.randint(1, 3) + out_cnt_adj)
            for _ in range(chf_outflows):
                amount = int(random.randint(15000, 60000) * out_amt_mult)
                writer.writerow([
                    f'CJ-{journal_id:06d}', date_str, amount, 'CHF', 'OUTFLOW',
                    random.choice(COUNTERPARTIES['CHF_OUTFLOW']),
                    random.choice(GL_ACCOUNTS['CHF_OUTFLOW']),
                    random.choice(OUTFLOW_DESCRIPTIONS),
                    random.choice(BANK_ACCOUNTS['CHF'])
                ])
                journal_id += 1

            # ============ SGD ============
            sgd_inflows = max(1, random.randint(1, 3) + in_cnt_adj)
            for _ in range(sgd_inflows):
                amount = int(random.randint(15000, 60000) * in_amt_mult)
                writer.writerow([
                    f'CJ-{journal_id:06d}', date_str, amount, 'SGD', 'INFLOW',
                    random.choice(COUNTERPARTIES['SGD_INFLOW']),
                    random.choice(GL_ACCOUNTS['SGD_INFLOW']),
                    random.choice(INFLOW_DESCRIPTIONS),
                    random.choice(BANK_ACCOUNTS['SGD'])
                ])
                journal_id += 1

            sgd_outflows = max(1, random.randint(1, 3) + out_cnt_adj)
            for _ in range(sgd_outflows):
                amount = int(random.randint(10000, 50000) * out_amt_mult)
                writer.writerow([
                    f'CJ-{journal_id:06d}', date_str, amount, 'SGD', 'OUTFLOW',
                    random.choice(COUNTERPARTIES['SGD_OUTFLOW']),
                    random.choice(GL_ACCOUNTS['SGD_OUTFLOW']),
                    random.choice(OUTFLOW_DESCRIPTIONS),
                    random.choice(BANK_ACCOUNTS['SGD'])
                ])
                journal_id += 1

            # ============ AUD ============
            aud_inflows = max(1, random.randint(1, 3) + in_cnt_adj)
            for _ in range(aud_inflows):
                amount = int(random.randint(20000, 70000) * in_amt_mult)
                writer.writerow([
                    f'CJ-{journal_id:06d}', date_str, amount, 'AUD', 'INFLOW',
                    random.choice(COUNTERPARTIES['AUD_INFLOW']),
                    random.choice(GL_ACCOUNTS['AUD_INFLOW']),
                    random.choice(INFLOW_DESCRIPTIONS),
                    random.choice(BANK_ACCOUNTS['AUD'])
                ])
                journal_id += 1

            aud_outflows = max(1, random.randint(1, 3) + out_cnt_adj)
            for _ in range(aud_outflows):
                amount = int(random.randint(15000, 55000) * out_amt_mult)
                writer.writerow([
                    f'CJ-{journal_id:06d}', date_str, amount, 'AUD', 'OUTFLOW',
                    random.choice(COUNTERPARTIES['AUD_OUTFLOW']),
                    random.choice(GL_ACCOUNTS['AUD_OUTFLOW']),
                    random.choice(OUTFLOW_DESCRIPTIONS),
                    random.choice(BANK_ACCOUNTS['AUD'])
                ])
                journal_id += 1

            current_date += timedelta(days=1)

    print(f"  Created {journal_file}")
    print(f"  Total journal entries: {journal_id - 1}")
    print(f"  ACME Corp late payment entries: {acme_late_count}")


def generate_ar_items(today):
    """Generate ~80 open AR items with due dates from today+1 to today+29."""
    today = _to_date(today)
    print("Generating ar_open_items.csv...")

    ar_file = OUTPUT_DIR / 'ar_open_items.csv'

    # (customer_id, customer_name, amount, currency, day_offset, probability, description)
    # First 35 items preserved exactly from original
    items = [
        ('C-001', 'TechGlobal Solutions',        450000,  'USD', 2,  0.95, 'Q1 software implementation project'),
        ('C-002', 'AutoMotive Industries GmbH',   380000,  'EUR', 4,  0.92, 'Manufacturing equipment delivery'),
        ('C-003', 'British Retail Group',           95000,  'GBP', 3,  0.88, 'Retail POS system integration'),
        ('C-004', 'Pacific Trading Corp',          520000,  'USD', 6,  0.94, 'International shipping services'),
        ('C-005', 'Nordic Energy AS',              420000,  'EUR', 8,  0.90, 'Energy management consulting'),
        ('C-006', 'London Financial Services',     125000,  'GBP', 9,  0.91, 'Financial software licensing'),
        ('C-007', 'MegaCorp USA',                  680000,  'USD', 11, 0.96, 'Enterprise cloud migration'),
        ('C-008', 'Deutsche Industrial AG',        195000,  'EUR', 12, 0.89, 'Industrial automation project'),
        ('C-009', 'Highland Manufacturing',         78000,  'GBP', 13, 0.85, 'Equipment calibration services'),
        ('C-010', 'American Logistics Inc',        425000,  'USD', 15, 0.93, 'Supply chain optimization'),
        ('C-011', 'EuroTech Solutions',            480000,  'EUR', 16, 0.91, 'IT infrastructure upgrade'),
        ('C-012', 'Westminster Holdings',           42000,  'GBP', 17, 0.87, 'Business consulting services'),
        ('C-013', 'Continental Systems',           575000,  'USD', 18, 0.95, 'Software licensing annual renewal'),
        ('C-014', 'FranceTech SA',                 265000,  'EUR', 19, 0.90, 'Digital transformation services'),
        ('C-015', 'Manchester United Industries',   35000,  'GBP', 20, 0.86, 'Maintenance contract quarterly'),
        ('C-016', 'Global Pharma Corp',            890000,  'USD', 21, 0.97, 'Pharmaceutical data analytics platform'),
        ('C-017', 'Siemens Digital Industries',    560000,  'EUR', 22, 0.92, 'IoT platform deployment'),
        ('C-018', 'Oxford Research Labs',           52000,  'GBP', 23, 0.88, 'Research data management system'),
        ('C-019', 'TransAtlantic Shipping',        755000,  'USD', 24, 0.96, 'Fleet management software'),
        ('C-020', 'ACME Corp',                    2300000,  'EUR', 1,  0.45, 'Major enterprise solution delivery - Phase 3'),
        ('C-021', 'Cambridge Biotech',              68000,  'GBP', 25, 0.89, 'Laboratory information system'),
        ('C-022', 'Midwest Manufacturing',         385000,  'USD', 26, 0.94, 'Production monitoring system'),
        ('C-023', 'Berlin Analytics GmbH',         215000,  'EUR', 27, 0.90, 'Business intelligence platform'),
        ('C-024', 'Scottish Energy Solutions',      28000,  'GBP', 28, 0.85, 'Energy audit services'),
        ('C-025', 'Sunrise Technologies',          495000,  'USD', 29, 0.93, 'Mobile application development'),
        ('C-026', 'Rhine Logistics AG',            175000,  'EUR', 29, 0.91, 'Warehouse management system'),
        ('C-027', 'Cardiff Construction Ltd',       45000,  'GBP', 5,  0.87, 'Project management software'),
        ('C-028', 'Coastal Shipping USA',          620000,  'USD', 7,  0.95, 'Port operations management'),
        ('C-029', 'Munich Automotive',             155000,  'EUR', 10, 0.89, 'Quality control system'),
        ('C-030', 'Bristol Aerospace',              38000,  'GBP', 14, 0.86, 'Engineering documentation system'),
        ('C-031', 'Sunbelt Energy Corp',           725000,  'USD', 17, 0.96, 'Smart grid analytics platform'),
        ('C-032', 'Hamburg Port Services',          95000,  'EUR', 20, 0.88, 'Terminal management system'),
        ('C-033', 'Metropolitan Transit',           22000,  'GBP', 22, 0.85, 'Ticketing system maintenance'),
        ('C-034', 'Midwest Agribusiness',          340000,  'USD', 23, 0.92, 'Agricultural IoT platform'),
        ('C-035', 'Stuttgart Engineering',         125000,  'EUR', 26, 0.90, 'CAD/CAM system licensing'),

        # --- New USD AR items ---
        ('C-036', 'Apex Data Systems',             320000,  'USD', 3,  0.93, 'Data warehouse migration'),
        ('C-037', 'Liberty Financial Group',        185000,  'USD', 7,  0.91, 'Compliance platform licensing'),
        ('C-038', 'Pinnacle Health Inc',            72000,  'USD', 10, 0.88, 'Healthcare analytics module'),
        ('C-039', 'Summit Logistics Corp',         445000,  'USD', 14, 0.94, 'Route optimization software'),
        ('C-040', 'Frontier Energy LLC',            95000,  'USD', 18, 0.90, 'Energy monitoring dashboard'),
        ('C-041', 'Columbia River Tech',            38000,  'USD', 22, 0.86, 'IT support contract quarterly'),
        ('C-042', 'National Services LLC',         560000,  'USD', 25, 0.95, 'Government contract milestone'),
        ('C-043', 'Western Digital Corp',           67000,  'USD', 28, 0.87, 'Storage solution maintenance'),
        ('C-044', 'Northeast Industries',          290000,  'USD', 5,  0.92, 'Manufacturing execution system'),
        ('C-045', 'Southern Manufacturing',         48000,  'USD', 12, 0.85, 'Quality assurance tools'),
        ('C-046', 'Central Systems Inc',           155000,  'USD', 16, 0.89, 'Network monitoring platform'),
        ('C-047', 'Atlantic Corp',                 410000,  'USD', 20, 0.93, 'ERP integration services'),

        # --- New EUR AR items (clustered due dates for anomaly) ---
        ('C-048', 'Barcelona Dynamics SL',         195000,  'EUR', 8,  0.91, 'Robotics integration project'),
        ('C-049', 'Amsterdam Data BV',             280000,  'EUR', 9,  0.90, 'Data center migration'),
        ('C-050', 'Zurich Instruments AG',         165000,  'EUR', 10, 0.88, 'Precision instruments calibration'),
        ('C-051', 'Vienna Tech GmbH',              220000,  'EUR', 11, 0.92, 'Smart building platform'),
        ('C-052', 'Milan Industries',              310000,  'EUR', 12, 0.89, 'Industrial IoT deployment'),
        ('C-053', 'Frankfurt Solutions',            85000,  'EUR', 15, 0.87, 'Consulting engagement Phase 2'),
        ('C-054', 'Deutsche Industrial AG',        145000,  'EUR', 23, 0.90, 'Automation system upgrade'),
        ('C-055', 'Nordic Energy AS',               92000,  'EUR', 25, 0.88, 'Wind farm monitoring system'),
        ('C-076', 'AutoMotive Industries GmbH',   475000,  'EUR', 3,  0.93, 'Connected vehicle platform Phase 2'),
        ('C-077', 'FranceTech SA',                345000,  'EUR', 13, 0.91, 'AI consulting engagement Q2'),
        ('C-078', 'Munich Automotive',            290000,  'EUR', 21, 0.92, 'Production analytics expansion'),

        # --- New GBP AR items ---
        ('C-056', 'Leeds Precision Engineering',    65000,  'GBP', 6,  0.87, 'CNC programming services'),
        ('C-057', 'Liverpool Maritime Services',   115000,  'GBP', 11, 0.89, 'Port logistics software'),
        ('C-058', 'Edinburgh Systems',              45000,  'GBP', 18, 0.86, 'Municipal IT services'),
        ('C-059', 'Highland Manufacturing',         82000,  'GBP', 24, 0.88, 'Production line optimization'),

        # --- JPY AR items (includes anomaly trigger) ---
        ('C-060', 'Toyota Motor Corp',         85000000,  'JPY', 5,  0.94, 'Connected vehicle platform'),
        ('C-061', 'Takeda Pharmaceutical',    180000000,  'JPY', 8,  0.40, 'Clinical data analytics - Phase 2 (payment dispute)'),
        ('C-062', 'Sony Interactive',          42000000,  'JPY', 15, 0.91, 'Gaming analytics platform'),
        ('C-063', 'NTT Data Corp',             65000000,  'JPY', 22, 0.93, 'Telecom infrastructure project'),
        ('C-064', 'Panasonic Holdings',        28000000,  'JPY', 27, 0.88, 'Smart factory monitoring'),

        # --- CHF AR items ---
        ('C-065', 'Nestle SA',                    185000,  'CHF', 7,  0.92, 'Supply chain analytics'),
        ('C-066', 'ABB Ltd',                      120000,  'CHF', 16, 0.90, 'Power grid monitoring system'),
        ('C-067', 'Roche Holding AG',              95000,  'CHF', 24, 0.88, 'Lab data management'),
        ('C-079', 'Zurich Insurance Group',      225000,  'CHF', 10, 0.91, 'Risk analytics platform'),
        ('C-080', 'Lonza Group AG',              180000,  'CHF', 18, 0.90, 'Biotech process monitoring'),

        # --- SGD AR items ---
        ('C-068', 'Singapore Airlines',           145000,  'SGD', 4,  0.91, 'Flight operations analytics'),
        ('C-069', 'DBS Group Holdings',            85000,  'SGD', 12, 0.89, 'Banking platform integration'),
        ('C-070', 'Keppel Corporation',            210000,  'SGD', 19, 0.93, 'Marine engineering platform'),
        ('C-071', 'Sea Limited',                    55000,  'SGD', 26, 0.87, 'E-commerce analytics module'),

        # --- AUD AR items (includes anomaly trigger) ---
        ('C-072', 'BHP Group',                    320000,  'AUD', 6,  0.94, 'Mining operations dashboard'),
        ('C-073', 'BHP Mining Services',          450000,  'AUD', 14, 0.35, 'Exploration data platform (contract under review)'),
        ('C-074', 'Rio Tinto Ltd',                260000,  'AUD', 20, 0.91, 'Logistics optimization system'),
        ('C-075', 'CSL Limited',                   95000,  'AUD', 27, 0.88, 'Biotech research data system'),
    ]

    with open(ar_file, 'w', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(['ar_item_id', 'customer_id', 'customer_name', 'invoice_number',
                         'amount', 'currency', 'due_date', 'status', 'probability', 'description'])

        for i, (cust_id, cust_name, amount, currency, day_offset, prob, desc) in enumerate(items, 1):
            ar_id = f'AR-{i:03d}'
            # AR-020 keeps special invoice number INV-AR-035
            if ar_id == 'AR-020':
                inv_num = 'INV-AR-035'
            elif ar_id == 'AR-035':
                inv_num = 'INV-AR-036'
            else:
                inv_num = f'INV-AR-{i:03d}'
            due = today + timedelta(days=day_offset)
            writer.writerow([ar_id, cust_id, cust_name, inv_num, amount, currency,
                             due.strftime('%Y-%m-%d'), 'OPEN', prob, desc])

    print(f"  Created {ar_file} ({len(items)} items)")


def generate_ap_items(today):
    """Generate ~95 open AP items with due dates from today+2 to today+29."""
    today = _to_date(today)
    print("Generating ap_open_items.csv...")

    ap_file = OUTPUT_DIR / 'ap_open_items.csv'

    # (vendor_id, vendor_name, invoice_number, amount, currency, day_offset, payment_method, description)
    # First 40 items preserved exactly from original
    items = [
        ('V-001', 'Oracle Corp',             'INV-ORC-2401', 450000,  'USD', 2,  'WIRE', 'Software license renewal'),
        ('V-002', 'Siemens AG',              'INV-SIE-8821', 350000,  'EUR', 4,  'WIRE', 'Industrial equipment purchase'),
        ('V-003', 'SAP SE',                  'INV-SAP-1923', 280000,  'EUR', 6,  'WIRE', 'ERP system maintenance'),
        ('V-004', 'Shell Energy',            'INV-SHL-4429', 185000,  'GBP', 3,  'ACH',  'Quarterly energy costs'),
        ('V-005', 'Microsoft Corp',          'INV-MSF-7712', 520000,  'USD', 5,  'WIRE', 'Azure cloud services Q1'),
        ('V-006', 'Deloitte Consulting',     'INV-DLT-3384', 380000,  'USD', 7,  'WIRE', 'Q1 advisory services'),
        ('V-007', 'BASF SE',                 'INV-BAS-5591', 320000,  'EUR', 9,  'WIRE', 'Raw materials supply'),
        ('V-008', 'BP Energy',               'INV-BPE-2214', 220000,  'GBP', 8,  'ACH',  'Fuel and energy costs'),
        ('V-009', 'Cisco Systems',           'INV-CSC-9905', 310000,  'USD', 10, 'WIRE', 'Network infrastructure upgrade'),
        ('V-010', 'Accenture PLC',           'INV-ACC-4472', 295000,  'USD', 11, 'WIRE', 'IT consulting services'),
        ('V-011', 'Volkswagen AG',           'INV-VWG-7783', 175000,  'EUR', 12, 'WIRE', 'Fleet vehicle lease payment'),
        ('V-012', 'Rolls-Royce Holdings',    'INV-RRH-6638', 125000,  'GBP', 13, 'WIRE', 'Equipment maintenance'),
        ('V-013', 'IBM Corp',                'INV-IBM-3321', 1200000, 'USD', 14, 'WIRE', 'Mainframe systems and support'),
        ('V-014', 'Bayer AG',                'INV-BAY-8847', 195000,  'EUR', 15, 'WIRE', 'Chemical supplies'),
        ('V-015', 'Unilever PLC',            'INV-UNL-2259', 95000,   'GBP', 16, 'ACH',  'Office supplies and catering'),
        ('V-016', 'Amazon Web Services',     'INV-AWS-5514', 680000,  'USD', 17, 'WIRE', 'Cloud infrastructure Q1'),
        ('V-017', 'Deutsche Telekom',        'INV-DTK-9926', 165000,  'EUR', 18, 'WIRE', 'Telecommunications services'),
        ('V-018', 'Vodafone Group',          'INV-VDF-7741', 88000,   'GBP', 19, 'ACH',  'Mobile services corporate plan'),
        ('V-019', 'Adobe Systems',           'INV-ADB-4453', 240000,  'USD', 20, 'WIRE', 'Creative Cloud enterprise license'),
        ('V-020', 'Allianz SE',              'INV-ALZ-1176', 145000,  'EUR', 21, 'WIRE', 'Corporate insurance premium'),
        ('V-021', 'Salesforce Inc',          'INV-SFC-8882', 1800000, 'USD', 9,  'WIRE', 'CRM platform annual contract'),
        ('V-022', 'ThyssenKrupp AG',         'INV-TKA-3347', 255000,  'EUR', 11, 'WIRE', 'Steel materials procurement'),
        ('V-023', 'BAE Systems',             'INV-BAE-6659', 800000,  'GBP', 16, 'WIRE', 'Defense systems components'),
        ('V-024', 'Workday Inc',             'INV-WKD-2283', 425000,  'USD', 13, 'WIRE', 'HR software subscription'),
        ('V-025', 'Bosch Group',             'INV-BSH-5574', 210000,  'EUR', 17, 'WIRE', 'Automation equipment'),
        ('V-026', 'Capgemini SE',            'INV-CPG-9918', 265000,  'EUR', 19, 'WIRE', 'Digital transformation services'),
        ('V-027', 'BT Group',                'INV-BTG-7726', 155000,  'GBP', 21, 'ACH',  'Enterprise connectivity services'),
        ('V-028', 'VMware Inc',              'INV-VMW-4441', 290000,  'USD', 23, 'WIRE', 'Virtualization platform license'),
        ('V-029', 'Airbus SE',               'INV-AIR-1195', 380000,  'EUR', 22, 'WIRE', 'Aviation parts and maintenance'),
        ('V-030', 'Honeywell International', 'INV-HON-8863', 335000,  'USD', 24, 'WIRE', 'Building automation systems'),
        ('V-031', 'General Electric',        'INV-GEL-3372', 475000,  'USD', 25, 'WIRE', 'Power generation equipment'),
        ('V-032', 'Schneider Electric',      'INV-SCH-6684', 185000,  'EUR', 23, 'WIRE', 'Electrical distribution systems'),
        ('V-033', 'Caterpillar Inc',         'INV-CAT-2297', 550000,  'USD', 26, 'WIRE', 'Heavy machinery purchase'),
        ('V-034', 'AstraZeneca PLC',         'INV-AZN-5519', 195000,  'GBP', 27, 'WIRE', 'Pharmaceutical supplies'),
        ('V-035', '3M Company',              'INV-3MC-9941', 385000,  'USD', 28, 'WIRE', 'Industrial materials and supplies'),
        ('V-036', "L'Oreal SA",              'INV-LOR-7758', 125000,  'EUR', 27, 'WIRE', 'Marketing and promotional materials'),
        ('V-037', 'KPMG LLP',               'INV-KPM-4465', 420000,  'USD', 29, 'WIRE', 'Annual audit services'),
        ('V-038', 'Lufthansa AG',            'INV-LHA-1183', 95000,   'EUR', 28, 'ACH',  'Corporate travel services'),
        ('V-039', 'EY Global',               'INV-EYG-8896', 355000,  'USD', 29, 'WIRE', 'Tax advisory services'),
        ('V-040', 'Tesco PLC',               'INV-TSC-3374', 65000,   'GBP', 29, 'ACH',  'Corporate catering services'),

        # --- New USD AP items (includes spike week: days 9-11) ---
        ('V-041', 'Palo Alto Networks',      'INV-PAN-5501', 680000,  'USD', 9,  'WIRE', 'Cybersecurity platform renewal'),
        ('V-042', 'ServiceNow Inc',          'INV-SNW-5502', 520000,  'USD', 10, 'WIRE', 'ITSM platform annual license'),
        ('V-043', 'Snowflake Inc',           'INV-SNF-5503', 445000,  'USD', 10, 'WIRE', 'Data cloud services Q1'),
        ('V-044', 'Palo Alto Networks',      'INV-PAN-5504', 390000,  'USD', 11, 'WIRE', 'Security operations center setup'),
        ('V-045', 'ServiceNow Inc',          'INV-SNW-5505', 285000,  'USD', 11, 'WIRE', 'IT workflow automation module'),
        ('V-046', 'Waste Management Inc',    'INV-WMI-5506', 42000,   'USD', 15, 'ACH',  'Quarterly waste services (2/10 net 30 discount available)'),
        ('V-047', 'Office Depot',            'INV-OFD-5507', 28000,   'USD', 18, 'ACH',  'Office supplies bulk order (2/10 net 30 discount available)'),
        ('V-048', 'Staples Inc',             'INV-STP-5508', 35000,   'USD', 22, 'ACH',  'Printer supplies and paper (2/10 net 30 discount available)'),
        ('V-049', 'AT&T Services',           'INV-ATT-5509', 155000,  'USD', 25, 'WIRE', 'Enterprise communications Q1'),
        ('V-050', 'Verizon Business',        'INV-VZB-5510', 195000,  'USD', 27, 'WIRE', '5G infrastructure services'),

        # --- New EUR AP items ---
        ('V-051', 'Infineon Technologies',   'INV-IFX-5511', 285000,  'EUR', 5,  'WIRE', 'Semiconductor components'),
        ('V-052', 'Continental AG',          'INV-CON-5512', 195000,  'EUR', 8,  'WIRE', 'Automotive parts supply'),
        ('V-053', 'RWE Energy',              'INV-RWE-5513', 145000,  'EUR', 14, 'WIRE', 'Renewable energy procurement'),
        ('V-054', 'Deutsche Post',           'INV-DPO-5514', 55000,   'EUR', 20, 'ACH',  'Logistics and shipping services'),
        ('V-055', 'Bosch Group',             'INV-BSH-5515', 82000,   'EUR', 24, 'WIRE', 'IoT sensor equipment'),

        # --- New GBP AP items ---
        ('V-056', 'Aviva PLC',               'INV-AVI-5516', 175000,  'GBP', 7,  'WIRE', 'Employee benefits insurance'),
        ('V-057', 'Legal & General',         'INV-LGL-5517', 95000,   'GBP', 15, 'WIRE', 'Pension fund management'),
        ('V-058', 'Royal Mail',              'INV-RML-5518', 32000,   'GBP', 22, 'ACH',  'Postal and courier services (2/10 net 30)'),
        ('V-059', 'British Gas',             'INV-BGS-5519', 48000,   'GBP', 26, 'ACH',  'Energy costs Q1'),

        # --- JPY AP items (concentration: days 9-11 for anomaly) ---
        ('V-060', 'Toyota Tsusho',           'INV-TTS-5520', 120000000, 'JPY', 9,  'WIRE', 'Automotive components bulk order'),
        ('V-061', 'Mitsui & Co',             'INV-MIT-5521', 135000000, 'JPY', 10, 'WIRE', 'Industrial materials procurement'),
        ('V-062', 'Marubeni Corp',           'INV-MRB-5522', 95000000,  'JPY', 11, 'WIRE', 'Infrastructure project materials'),
        ('V-063', 'Denso Corp',              'INV-DNS-5523', 45000000,  'JPY', 17, 'WIRE', 'Electronic components supply'),
        ('V-064', 'Nippon Steel',            'INV-NST-5524', 68000000,  'JPY', 23, 'WIRE', 'Steel materials for construction'),
        ('V-065', 'FANUC Corporation',       'INV-FNC-5525', 22000000,  'JPY', 27, 'LOCAL', 'Robotics maintenance contract'),
        ('V-066', 'Keyence Corp',            'INV-KEY-5526', 18000000,  'JPY', 29, 'LOCAL', 'Sensor equipment (2/10 net 30)'),
        ('V-067', 'Murata Manufacturing',    'INV-MUR-5527', 12000000,  'JPY', 14, 'LOCAL', 'Capacitor components order'),

        # --- CHF AP items ---
        ('V-068', 'Holcim Group',            'INV-HLC-5528', 120000,  'CHF', 6,  'WIRE', 'Construction materials'),
        ('V-069', 'Kuehne+Nagel',            'INV-KNL-5529', 125000,  'CHF', 13, 'WIRE', 'International freight services'),
        ('V-070', 'Swisscom AG',             'INV-SWC-5530', 85000,   'CHF', 19, 'WIRE', 'Telecom infrastructure'),
        ('V-071', 'Sika AG',                 'INV-SKA-5531', 65000,   'CHF', 25, 'WIRE', 'Chemical construction products'),
        ('V-072', 'Georg Fischer AG',        'INV-GFA-5532', 42000,   'CHF', 28, 'LOCAL', 'Piping systems (2/10 net 30)'),

        # --- SGD AP items ---
        ('V-073', 'Singapore Power',         'INV-SPW-5533', 165000,  'SGD', 5,  'WIRE', 'Electricity and utilities Q1'),
        ('V-074', 'ST Engineering',          'INV-STE-5534', 220000,  'SGD', 12, 'WIRE', 'Engineering services contract'),
        ('V-075', 'StarHub Ltd',             'INV-STH-5535', 45000,   'SGD', 18, 'LOCAL', 'Telecom services'),
        ('V-076', 'Olam Group',              'INV-OLM-5536', 85000,   'SGD', 23, 'WIRE', 'Agricultural commodity supply'),
        ('V-077', 'SMRT Corporation',        'INV-SMR-5537', 35000,   'SGD', 27, 'LOCAL', 'Transport services (2/10 net 30)'),
        ('V-078', 'Frasers Property',        'INV-FRP-5538', 95000,   'SGD', 29, 'WIRE', 'Office space lease Q1'),

        # --- AUD AP items ---
        ('V-079', 'AGL Energy',              'INV-AGL-5539', 185000,  'AUD', 4,  'WIRE', 'Energy procurement Q1'),
        ('V-080', 'Qantas Airways',          'INV-QAN-5540', 125000,  'AUD', 10, 'WIRE', 'Corporate travel program'),
        ('V-081', 'Telstra Corp',            'INV-TLS-5541', 95000,   'AUD', 16, 'WIRE', 'Telecommunications services'),
        ('V-082', 'Lendlease Group',         'INV-LDL-5542', 220000,  'AUD', 20, 'WIRE', 'Construction project milestone'),
        ('V-083', 'Origin Energy',           'INV-ORG-5543', 65000,   'AUD', 24, 'ACH',  'Natural gas supply'),
        ('V-084', 'Boral Limited',           'INV-BRL-5544', 38000,   'AUD', 28, 'LOCAL', 'Building materials (2/10 net 30)'),
    ]

    with open(ap_file, 'w', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(['ap_item_id', 'vendor_id', 'vendor_name', 'invoice_number',
                         'amount', 'currency', 'due_date', 'status', 'payment_method', 'description'])

        for i, (vid, vname, inv, amount, currency, day_offset, method, desc) in enumerate(items, 1):
            ap_id = f'AP-{i:03d}'
            due = today + timedelta(days=day_offset)
            writer.writerow([ap_id, vid, vname, inv, amount, currency,
                             due.strftime('%Y-%m-%d'), 'OPEN', method, desc])

    print(f"  Created {ap_file} ({len(items)} items)")


def generate_bank_accounts(today):
    """Generate bank_accounts.csv with last_updated = today."""
    today = _to_date(today)
    print("Generating bank_accounts.csv...")

    ba_file = OUTPUT_DIR / 'bank_accounts.csv'
    today_str = today.strftime('%Y-%m-%d')

    accounts = [
        # Original 7 accounts — unchanged
        ('BA001', 'Chase',           'checking',      'USD', 5200000,    '1010'),
        ('BA002', 'Chase',           'savings',       'USD', 2100000,    '1020'),
        ('BA003', 'Bank of America', 'checking',      'USD', 3800000,    '1030'),
        ('BA004', 'Deutsche Bank',   'checking',      'EUR', 4500000,    '1040'),
        ('BA005', 'BNP Paribas',     'checking',      'EUR', 2300000,    '1050'),
        ('BA006', 'Barclays',        'checking',      'GBP', 1900000,    '1060'),
        ('BA007', 'Barclays',        'money_market',  'GBP', 1200000,    '1070'),
        # New accounts
        ('BA008', 'MUFG',            'checking',      'JPY', 450000000,  '1080'),
        ('BA009', 'Mizuho',          'savings',       'JPY', 200000000,  '1090'),
        ('BA010', 'UBS',             'checking',      'CHF', 1800000,    '1100'),
        ('BA011', 'DBS',             'checking',      'SGD', 2700000,    '1110'),
        ('BA012', 'OCBC',            'money_market',  'SGD', 1200000,    '1120'),
        ('BA013', 'ANZ',             'checking',      'AUD', 2400000,    '1130'),
        ('BA014', 'Westpac',         'savings',       'AUD', 1100000,    '1140'),
    ]

    with open(ba_file, 'w', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(['bank_account_id', 'bank_name', 'account_type',
                         'currency', 'current_balance', 'gl_account', 'last_updated'])

        for acct_id, bank, acct_type, currency, balance, gl in accounts:
            writer.writerow([acct_id, bank, acct_type, currency, balance, gl, today_str])

    print(f"  Created {ba_file} ({len(accounts)} accounts)")


def generate_payment_runs(today):
    """Generate 10 scheduled payment runs with dates relative to today."""
    today = _to_date(today)
    print("Generating payment_runs.csv...")

    pr_file = OUTPUT_DIR / 'payment_runs.csv'

    # (day_offset, total_amount, currency, item_count, description)
    runs = [
        (2,   450000,   'USD', 3,  'Payroll withholding tax remittance'),
        (4,   180000,   'EUR', 2,  'VAT quarterly payment - DE entity'),
        (9,   850000,   'USD', 4,  'Employee benefits and insurance premiums'),
        (12,  250000,   'GBP', 2,  'HMRC corporation tax installment'),
        (16, 1500000,   'USD', 6,  'Monthly payroll run'),
        (20,  220000,   'EUR', 3,  'Social security contributions - EU entities'),
        (7,  85000000,  'JPY', 3,  'Japanese consumption tax quarterly'),
        (14,   75000,   'CHF', 2,  'Swiss pension fund contribution'),
        (18,   55000,   'SGD', 2,  'CPF employer contribution - SG'),
        (22,   45000,   'AUD', 2,  'Superannuation guarantee payment'),
    ]

    with open(pr_file, 'w', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(['payment_run_id', 'scheduled_date', 'total_amount',
                         'currency', 'item_count', 'status', 'description'])

        for i, (day_offset, amount, currency, count, desc) in enumerate(runs, 1):
            pr_id = f'PR-{i:03d}'
            sched = today + timedelta(days=day_offset)
            writer.writerow([pr_id, sched.strftime('%Y-%m-%d'), amount,
                             currency, count, 'SCHEDULED', desc])

    print(f"  Created {pr_file} ({len(runs)} runs)")


def main():
    parser = argparse.ArgumentParser(description='Generate seed CSV files for Cash Agent Demo')
    parser.add_argument('--today', type=str, default=None,
                        help='Reference date in YYYY-MM-DD format (default: today)')
    args = parser.parse_args()

    if args.today:
        today = date.fromisoformat(args.today)
    else:
        today = date.today()

    # Deterministic seeding for reproducibility
    random.seed(today.toordinal())

    print("=" * 60)
    print("Cash Agent Demo - Seed CSV Generator")
    print(f"  Reference date (today): {today}")
    print("=" * 60)
    print()

    generate_fx_rates(today)
    print()
    generate_cash_journal(today)
    print()
    generate_ar_items(today)
    print()
    generate_ap_items(today)
    print()
    generate_bank_accounts(today)
    print()
    generate_payment_runs(today)
    print()

    print("=" * 60)
    print("All files generated successfully!")
    print("=" * 60)


if __name__ == '__main__':
    main()
