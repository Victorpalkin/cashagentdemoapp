#!/usr/bin/env python3
"""
Generate seed CSV files for Cash Agent Demo.
All dates are relative to a configurable 'today' parameter so seed data
can be regenerated daily.

Generated files:
- fx_rates.csv:       12 months of daily FX rates
- cash_journal.csv:   12 months of daily transactions
- ar_open_items.csv:  35 open AR items (due today+1 .. today+29)
- ap_open_items.csv:  40 open AP items (due today+2 .. today+29)
- bank_accounts.csv:  7 bank accounts (last_updated = today)
- payment_runs.csv:   6 scheduled payment runs
"""

import argparse
import csv
import random
from datetime import date, datetime, timedelta
from pathlib import Path

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
        'Capgemini SE', 'Airbus SE', 'Schneider Electric', 'L\'Oreal SA',
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
    """Generate daily FX rates for 12 months + today."""
    today = _to_date(today)
    start_date = today - timedelta(days=365)

    print("Generating fx_rates.csv...")

    rates_file = OUTPUT_DIR / 'fx_rates.csv'

    with open(rates_file, 'w', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(['rate_date', 'from_currency', 'to_currency', 'exchange_rate'])

        current_date = start_date

        while current_date <= today:
            date_str = current_date.strftime('%Y-%m-%d')

            # EUR/USD: base ~1.08, fluctuation +/-0.02
            eur_usd = round(1.08 + random.uniform(-0.02, 0.02), 4)

            # GBP/USD: base ~1.27, fluctuation +/-0.02
            gbp_usd = round(1.27 + random.uniform(-0.02, 0.02), 4)

            # EUR/GBP: derived but with slight adjustment, base ~0.85
            eur_gbp = round(0.85 + random.uniform(-0.01, 0.01), 4)

            # Special handling for today to match exact values
            if current_date == today:
                eur_usd = 1.08
                gbp_usd = 1.27
                eur_gbp = 0.8504

            writer.writerow([date_str, 'EUR', 'USD', eur_usd])
            writer.writerow([date_str, 'GBP', 'USD', gbp_usd])
            writer.writerow([date_str, 'EUR', 'GBP', eur_gbp])

            current_date += timedelta(days=1)

    print(f"  Created {rates_file}")


def generate_cash_journal(today):
    """Generate 12 months of cash journal entries."""
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

            # Check for payroll day
            if is_payroll_day(current_date):
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
            usd_inflows = random.randint(3, 6)
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
            usd_outflows = random.randint(3, 6)
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

            # EUR inflows
            eur_inflows = random.randint(2, 4)
            for _ in range(eur_inflows):
                amount = random.randint(30000, 80000)
                counterparty = random.choice(COUNTERPARTIES['EUR_INFLOW'])
                gl_account = random.choice(GL_ACCOUNTS['EUR_INFLOW'])

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

            # EUR outflows
            eur_outflows = random.randint(2, 4)
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

            # GBP inflows
            gbp_inflows = random.randint(1, 3)
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

            # GBP outflows
            gbp_outflows = random.randint(1, 3)
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

    print(f"  Created {journal_file}")
    print(f"  Total journal entries: {journal_id - 1}")
    print(f"  ACME Corp late payment entries: {acme_late_count}")


def generate_ar_items(today):
    """Generate 35 open AR items with due dates from today+1 to today+29."""
    today = _to_date(today)
    print("Generating ar_open_items.csv...")

    ar_file = OUTPUT_DIR / 'ar_open_items.csv'

    # Define 35 AR items: (customer_id, customer_name, amount, currency, day_offset, probability, description)
    # day_offset is relative to today
    items = [
        ('C-001', 'TechGlobal Solutions',        450000,  'USD', 2,  0.95, 'Q1 software implementation project'),
        ('C-002', 'AutoMotive Industries GmbH',   380000,  'EUR', 4,  0.92, 'Manufacturing equipment delivery'),
        ('C-003', 'British Retail Group',           95000,  'GBP', 3,  0.88, 'Retail POS system integration'),
        ('C-004', 'Pacific Trading Corp',          520000,  'USD', 6,  0.94, 'International shipping services'),
        ('C-005', 'Nordic Energy AS',              285000,  'EUR', 8,  0.90, 'Energy management consulting'),
        ('C-006', 'London Financial Services',     125000,  'GBP', 9,  0.91, 'Financial software licensing'),
        ('C-007', 'MegaCorp USA',                  680000,  'USD', 11, 0.96, 'Enterprise cloud migration'),
        ('C-008', 'Deutsche Industrial AG',        195000,  'EUR', 12, 0.89, 'Industrial automation project'),
        ('C-009', 'Highland Manufacturing',         78000,  'GBP', 13, 0.85, 'Equipment calibration services'),
        ('C-010', 'American Logistics Inc',        425000,  'USD', 15, 0.93, 'Supply chain optimization'),
        ('C-011', 'EuroTech Solutions',            340000,  'EUR', 16, 0.91, 'IT infrastructure upgrade'),
        ('C-012', 'Westminster Holdings',           42000,  'GBP', 17, 0.87, 'Business consulting services'),
        ('C-013', 'Continental Systems',           575000,  'USD', 18, 0.95, 'Software licensing annual renewal'),
        ('C-014', 'FranceTech SA',                 265000,  'EUR', 19, 0.90, 'Digital transformation services'),
        ('C-015', 'Manchester United Industries',   35000,  'GBP', 20, 0.86, 'Maintenance contract quarterly'),
        ('C-016', 'Global Pharma Corp',            890000,  'USD', 21, 0.97, 'Pharmaceutical data analytics platform'),
        ('C-017', 'Siemens Digital Industries',    425000,  'EUR', 22, 0.92, 'IoT platform deployment'),
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
    """Generate 40 open AP items with due dates from today+2 to today+29."""
    today = _to_date(today)
    print("Generating ap_open_items.csv...")

    ap_file = OUTPUT_DIR / 'ap_open_items.csv'

    # (vendor_id, vendor_name, invoice_number, amount, currency, day_offset, payment_method, description)
    items = [
        ('V-001', 'Oracle Corp',             'INV-ORC-2401', 450000,  'USD', 2,  'WIRE', 'Software license renewal'),
        ('V-002', 'Siemens AG',              'INV-SIE-8821', 350000,  'EUR', 4,  'WIRE', 'Industrial equipment purchase'),
        ('V-003', 'SAP SE',                  'INV-SAP-1923', 280000,  'EUR', 6,  'WIRE', 'ERP system maintenance'),
        ('V-004', 'Shell Energy',            'INV-SHL-4429', 185000,  'GBP', 3,  'ACH',  'Quarterly energy costs'),
        ('V-005', 'Microsoft Corp',          'INV-MSF-7712', 520000,  'USD', 5,  'WIRE', 'Azure cloud services Q1'),
        ('V-006', 'Deloitte Consulting',     'INV-DLT-3384', 380000,  'USD', 7,  'WIRE', 'Q1 advisory services'),
        ('V-007', 'BASF SE',                 'INV-BAS-5591', 420000,  'EUR', 9,  'WIRE', 'Raw materials supply'),
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
        ('V-026', 'Capgemini SE',            'INV-CPG-9918', 365000,  'EUR', 19, 'WIRE', 'Digital transformation services'),
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
        ('BA001', 'Chase',          'checking',     'USD', 5200000, '1010'),
        ('BA002', 'Chase',          'savings',      'USD', 2100000, '1020'),
        ('BA003', 'Bank of America','checking',     'USD', 3800000, '1030'),
        ('BA004', 'Deutsche Bank',  'checking',     'EUR', 4500000, '1040'),
        ('BA005', 'BNP Paribas',    'checking',     'EUR', 2300000, '1050'),
        ('BA006', 'Barclays',       'checking',     'GBP', 1900000, '1060'),
        ('BA007', 'Barclays',       'money_market', 'GBP', 1200000, '1070'),
    ]

    with open(ba_file, 'w', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(['bank_account_id', 'bank_name', 'account_type',
                         'currency', 'current_balance', 'gl_account', 'last_updated'])

        for acct_id, bank, acct_type, currency, balance, gl in accounts:
            writer.writerow([acct_id, bank, acct_type, currency, balance, gl, today_str])

    print(f"  Created {ba_file} ({len(accounts)} accounts)")


def generate_payment_runs(today):
    """Generate 6 scheduled payment runs with dates relative to today."""
    today = _to_date(today)
    print("Generating payment_runs.csv...")

    pr_file = OUTPUT_DIR / 'payment_runs.csv'

    # (day_offset, total_amount, currency, item_count, description)
    runs = [
        (2,  1200000, 'USD', 5, 'Weekly vendor payments - USD batch 1'),
        (4,   450000, 'EUR', 3, 'EUR vendor payments'),
        (9,  2800000, 'USD', 8, 'Weekly vendor payments - USD batch 2'),
        (12,  800000, 'GBP', 4, 'GBP vendor payments'),
        (16, 1500000, 'USD', 6, 'Monthly payroll run'),
        (20,  650000, 'EUR', 3, 'EUR vendor payments batch 2'),
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
