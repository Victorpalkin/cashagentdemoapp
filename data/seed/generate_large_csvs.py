#!/usr/bin/env python3
"""
Generate large seed CSV files for Cash Agent Demo
- cash_journal.csv: 12 months of daily transactions (~5000 rows)
- fx_rates.csv: 12 months of daily FX rates (~1098 rows)
"""

import csv
import random
from datetime import datetime, timedelta
from pathlib import Path

# Configuration
START_DATE = datetime(2025, 3, 16)
END_DATE = datetime(2026, 3, 15)
TODAY = datetime(2026, 3, 16)
OUTPUT_DIR = Path(__file__).parent

# Transaction data
COUNTERPARTIES = {
    'USD_INFLOW': [
        'TechGlobal Solutions', 'MegaCorp USA', 'American Logistics Inc',
        'Global Pharma Corp', 'TransAtlantic Shipping', 'Continental Systems',
        'Midwest Manufacturing', 'Sunrise Technologies', 'Coastal Shipping USA',
        'Sunbelt Energy Corp', 'Midwest Agribusiness', 'Pacific Trading Corp',
        'Western Digital Corp', 'Northeast Industries', 'Southern Manufacturing',
        'Central Systems Inc', 'Atlantic Corp', 'National Services LLC'
    ],
    'EUR_INFLOW': [
        'AutoMotive Industries GmbH', 'Nordic Energy AS', 'Deutsche Industrial AG',
        'EuroTech Solutions', 'FranceTech SA', 'Siemens Digital Industries',
        'Berlin Analytics GmbH', 'Rhine Logistics AG', 'Munich Automotive',
        'Hamburg Port Services', 'Stuttgart Engineering', 'ACME Corp',
        'Frankfurt Solutions', 'Vienna Tech GmbH', 'Milan Industries'
    ],
    'GBP_INFLOW': [
        'British Retail Group', 'London Financial Services', 'Highland Manufacturing',
        'Westminster Holdings', 'Manchester United Industries', 'Oxford Research Labs',
        'Cambridge Biotech', 'Scottish Energy Solutions', 'Cardiff Construction Ltd',
        'Bristol Aerospace', 'Metropolitan Transit', 'Edinburgh Systems'
    ],
    'USD_OUTFLOW': [
        'Oracle Corp', 'Microsoft Corp', 'Cisco Systems', 'IBM Corp',
        'Amazon Web Services', 'Adobe Systems', 'Salesforce Inc', 'VMware Inc',
        'Honeywell International', 'General Electric', 'Caterpillar Inc',
        '3M Company', 'KPMG LLP', 'EY Global', 'Deloitte Consulting',
        'Accenture PLC', 'Workday Inc', 'Office Depot', 'Staples Inc',
        'AT&T Services', 'Verizon Business', 'Waste Management Inc'
    ],
    'EUR_OUTFLOW': [
        'Siemens AG', 'SAP SE', 'BASF SE', 'Volkswagen AG', 'Bayer AG',
        'Deutsche Telekom', 'Allianz SE', 'ThyssenKrupp AG', 'Bosch Group',
        'Capgemini SE', 'Airbus SE', 'Schneider Electric', 'L\'Oréal SA',
        'Lufthansa AG', 'Deutsche Post', 'RWE Energy'
    ],
    'GBP_OUTFLOW': [
        'Shell Energy', 'BP Energy', 'Rolls-Royce Holdings', 'Unilever PLC',
        'Vodafone Group', 'BAE Systems', 'BT Group', 'AstraZeneca PLC',
        'Tesco PLC', 'British Gas', 'Royal Mail', 'Sainsbury\'s'
    ]
}

GL_ACCOUNTS = {
    'USD_INFLOW': ['1200', '4000', '4010'],
    'EUR_INFLOW': ['1210', '4020', '4030'],
    'GBP_INFLOW': ['1220', '4040'],
    'USD_OUTFLOW': ['2000', '5000', '6000', '6100', '6200', '6300', '6400'],
    'EUR_OUTFLOW': ['2010', '5010', '6300'],
    'GBP_OUTFLOW': ['2020', '6200']
}

BANK_ACCOUNTS = {
    'USD': ['BA001', 'BA002', 'BA003'],
    'EUR': ['BA004', 'BA005'],
    'GBP': ['BA006', 'BA007']
}

def is_weekday(date):
    """Check if date is a weekday (Monday=0, Sunday=6)"""
    return date.weekday() < 5

def is_payroll_day(date):
    """Check if date is a payroll day (15th or last day of month)"""
    if date.day == 15:
        return True
    # Check if it's the last day of the month
    next_day = date + timedelta(days=1)
    return next_day.month != date.month

def generate_fx_rates():
    """Generate daily FX rates for 12 months + today"""
    print("Generating fx_rates.csv...")

    rates_file = OUTPUT_DIR / 'fx_rates.csv'

    with open(rates_file, 'w', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(['rate_date', 'from_currency', 'to_currency', 'exchange_rate'])

        # Base rates with daily fluctuations
        current_date = START_DATE

        while current_date <= TODAY:
            date_str = current_date.strftime('%Y-%m-%d')

            # EUR/USD: base ~1.08, fluctuation ±0.02
            eur_usd = round(1.08 + random.uniform(-0.02, 0.02), 4)

            # GBP/USD: base ~1.27, fluctuation ±0.02
            gbp_usd = round(1.27 + random.uniform(-0.02, 0.02), 4)

            # EUR/GBP: derived but with slight adjustment, base ~0.85
            eur_gbp = round(0.85 + random.uniform(-0.01, 0.01), 4)

            # Special handling for today to match exact values
            if current_date == TODAY:
                eur_usd = 1.08
                gbp_usd = 1.27
                eur_gbp = 0.8504

            writer.writerow([date_str, 'EUR', 'USD', eur_usd])
            writer.writerow([date_str, 'GBP', 'USD', gbp_usd])
            writer.writerow([date_str, 'EUR', 'GBP', eur_gbp])

            current_date += timedelta(days=1)

    print(f"✓ Created {rates_file}")

def generate_cash_journal():
    """Generate 12 months of cash journal entries"""
    print("Generating cash_journal.csv...")

    journal_file = OUTPUT_DIR / 'cash_journal.csv'
    journal_id = 1

    with open(journal_file, 'w', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(['journal_id', 'posting_date', 'amount', 'currency',
                        'transaction_type', 'counterparty', 'gl_account',
                        'description', 'bank_account_id'])

        current_date = START_DATE
        acme_late_count = 0  # Track ACME late payments

        while current_date <= END_DATE:
            if not is_weekday(current_date):
                current_date += timedelta(days=1)
                continue

            date_str = current_date.strftime('%Y-%m-%d')

            # Determine number of transactions for this day
            base_transactions = random.randint(15, 25)

            # USD transactions
            usd_inflows = random.randint(3, 6)
            usd_outflows = random.randint(3, 6)

            # Check for payroll day
            if is_payroll_day(current_date):
                # Add payroll transaction
                writer.writerow([
                    f'CJ-{journal_id:06d}',
                    date_str,
                    random.randint(1450000, 1550000),
                    'USD',
                    'OUTFLOW',
                    'ADP Payroll Services',
                    '6000',
                    'Monthly payroll processing',
                    random.choice(BANK_ACCOUNTS['USD'])
                ])
                journal_id += 1

            # USD inflows
            for _ in range(usd_inflows):
                amount = random.randint(80000, 150000)
                counterparty = random.choice(COUNTERPARTIES['USD_INFLOW'])
                gl_account = random.choice(GL_ACCOUNTS['USD_INFLOW'])

                descriptions = [
                    'Customer payment received',
                    'Product sales revenue',
                    'Service fee payment',
                    'License renewal payment',
                    'Consulting services payment'
                ]

                writer.writerow([
                    f'CJ-{journal_id:06d}',
                    date_str,
                    amount,
                    'USD',
                    'INFLOW',
                    counterparty,
                    gl_account,
                    random.choice(descriptions),
                    random.choice(BANK_ACCOUNTS['USD'])
                ])
                journal_id += 1

            # USD outflows
            for _ in range(usd_outflows):
                amount = random.randint(60000, 120000)
                counterparty = random.choice(COUNTERPARTIES['USD_OUTFLOW'])
                gl_account = random.choice(GL_ACCOUNTS['USD_OUTFLOW'])

                descriptions = [
                    'Vendor payment',
                    'Service provider payment',
                    'Material procurement',
                    'Utilities payment',
                    'Professional services',
                    'Maintenance services'
                ]

                writer.writerow([
                    f'CJ-{journal_id:06d}',
                    date_str,
                    amount,
                    'USD',
                    'OUTFLOW',
                    counterparty,
                    gl_account,
                    random.choice(descriptions),
                    random.choice(BANK_ACCOUNTS['USD'])
                ])
                journal_id += 1

            # EUR transactions
            eur_inflows = random.randint(2, 4)
            eur_outflows = random.randint(2, 4)

            for _ in range(eur_inflows):
                amount = random.randint(30000, 80000)
                counterparty = random.choice(COUNTERPARTIES['EUR_INFLOW'])
                gl_account = random.choice(GL_ACCOUNTS['EUR_INFLOW'])

                # Add some ACME Corp payments that arrive late
                if counterparty == 'ACME Corp' and random.random() < 0.3:
                    acme_late_count += 1
                    descriptions = ['Customer payment - received late', 'Project milestone payment - delayed']
                else:
                    descriptions = [
                        'Customer payment received',
                        'Product sales revenue',
                        'Service fee payment',
                        'Consulting revenue'
                    ]

                writer.writerow([
                    f'CJ-{journal_id:06d}',
                    date_str,
                    amount,
                    'EUR',
                    'INFLOW',
                    counterparty,
                    gl_account,
                    random.choice(descriptions),
                    random.choice(BANK_ACCOUNTS['EUR'])
                ])
                journal_id += 1

            for _ in range(eur_outflows):
                amount = random.randint(20000, 60000)
                counterparty = random.choice(COUNTERPARTIES['EUR_OUTFLOW'])
                gl_account = random.choice(GL_ACCOUNTS['EUR_OUTFLOW'])

                descriptions = [
                    'Vendor payment',
                    'Service provider payment',
                    'Material procurement',
                    'Equipment rental'
                ]

                writer.writerow([
                    f'CJ-{journal_id:06d}',
                    date_str,
                    amount,
                    'EUR',
                    'OUTFLOW',
                    counterparty,
                    gl_account,
                    random.choice(descriptions),
                    random.choice(BANK_ACCOUNTS['EUR'])
                ])
                journal_id += 1

            # GBP transactions
            gbp_inflows = random.randint(1, 3)
            gbp_outflows = random.randint(1, 3)

            for _ in range(gbp_inflows):
                amount = random.randint(10000, 40000)
                counterparty = random.choice(COUNTERPARTIES['GBP_INFLOW'])
                gl_account = random.choice(GL_ACCOUNTS['GBP_INFLOW'])

                descriptions = [
                    'Customer payment received',
                    'Service fee payment',
                    'Product sales revenue'
                ]

                writer.writerow([
                    f'CJ-{journal_id:06d}',
                    date_str,
                    amount,
                    'GBP',
                    'INFLOW',
                    counterparty,
                    gl_account,
                    random.choice(descriptions),
                    random.choice(BANK_ACCOUNTS['GBP'])
                ])
                journal_id += 1

            for _ in range(gbp_outflows):
                amount = random.randint(8000, 30000)
                counterparty = random.choice(COUNTERPARTIES['GBP_OUTFLOW'])
                gl_account = random.choice(GL_ACCOUNTS['GBP_OUTFLOW'])

                descriptions = [
                    'Vendor payment',
                    'Service provider payment',
                    'Utilities payment'
                ]

                writer.writerow([
                    f'CJ-{journal_id:06d}',
                    date_str,
                    amount,
                    'GBP',
                    'OUTFLOW',
                    counterparty,
                    gl_account,
                    random.choice(descriptions),
                    random.choice(BANK_ACCOUNTS['GBP'])
                ])
                journal_id += 1

            current_date += timedelta(days=1)

    print(f"✓ Created {journal_file}")
    print(f"  Total journal entries: {journal_id - 1}")
    print(f"  ACME Corp late payment entries: {acme_late_count}")

def main():
    print("=" * 60)
    print("Cash Agent Demo - Large CSV Generator")
    print("=" * 60)
    print()

    generate_fx_rates()
    print()
    generate_cash_journal()
    print()
    print("=" * 60)
    print("All files generated successfully!")
    print("=" * 60)

if __name__ == '__main__':
    main()
