# BigQuery Dataset
resource "google_bigquery_dataset" "cash_agent_demo" {
  dataset_id    = var.dataset_id
  friendly_name = "Cash Agent Demo Dataset"
  description   = "Dataset for Cash Agent Demo application"
  location      = var.region

  depends_on = [google_project_service.bigquery]
}

# GL Accounts Table
resource "google_bigquery_table" "gl_accounts" {
  dataset_id          = google_bigquery_dataset.cash_agent_demo.dataset_id
  table_id            = "gl_accounts"
  deletion_protection = false

  schema = jsonencode([
    {
      name = "company_code"
      type = "STRING"
      mode = "REQUIRED"
    },
    {
      name = "gl_account"
      type = "STRING"
      mode = "REQUIRED"
    },
    {
      name = "gl_account_name"
      type = "STRING"
      mode = "REQUIRED"
    },
    {
      name = "currency"
      type = "STRING"
      mode = "REQUIRED"
    },
    {
      name = "account_type"
      type = "STRING"
      mode = "REQUIRED"
    },
    {
      name = "is_bank_account"
      type = "BOOLEAN"
      mode = "REQUIRED"
    }
  ])
}

# Bank Accounts Table
resource "google_bigquery_table" "bank_accounts" {
  dataset_id          = google_bigquery_dataset.cash_agent_demo.dataset_id
  table_id            = "bank_accounts"
  deletion_protection = false

  schema = jsonencode([
    {
      name = "bank_account_id"
      type = "STRING"
      mode = "REQUIRED"
    },
    {
      name = "bank_name"
      type = "STRING"
      mode = "REQUIRED"
    },
    {
      name = "account_type"
      type = "STRING"
      mode = "REQUIRED"
    },
    {
      name = "currency"
      type = "STRING"
      mode = "REQUIRED"
    },
    {
      name = "current_balance"
      type = "FLOAT"
      mode = "REQUIRED"
    },
    {
      name = "gl_account"
      type = "STRING"
      mode = "REQUIRED"
    },
    {
      name = "last_updated"
      type = "DATE"
      mode = "REQUIRED"
    }
  ])
}

# Cash Journal Table
resource "google_bigquery_table" "cash_journal" {
  dataset_id          = google_bigquery_dataset.cash_agent_demo.dataset_id
  table_id            = "cash_journal"
  deletion_protection = false

  schema = jsonencode([
    {
      name = "journal_id"
      type = "STRING"
      mode = "REQUIRED"
    },
    {
      name = "posting_date"
      type = "DATE"
      mode = "REQUIRED"
    },
    {
      name = "amount"
      type = "FLOAT"
      mode = "REQUIRED"
    },
    {
      name = "currency"
      type = "STRING"
      mode = "REQUIRED"
    },
    {
      name = "transaction_type"
      type = "STRING"
      mode = "REQUIRED"
    },
    {
      name = "counterparty"
      type = "STRING"
      mode = "REQUIRED"
    },
    {
      name = "gl_account"
      type = "STRING"
      mode = "NULLABLE"
    },
    {
      name = "description"
      type = "STRING"
      mode = "NULLABLE"
    },
    {
      name = "bank_account_id"
      type = "STRING"
      mode = "NULLABLE"
    }
  ])
}

# AP Open Items Table
resource "google_bigquery_table" "ap_open_items" {
  dataset_id          = google_bigquery_dataset.cash_agent_demo.dataset_id
  table_id            = "ap_open_items"
  deletion_protection = false

  schema = jsonencode([
    {
      name = "ap_item_id"
      type = "STRING"
      mode = "REQUIRED"
    },
    {
      name = "vendor_id"
      type = "STRING"
      mode = "REQUIRED"
    },
    {
      name = "vendor_name"
      type = "STRING"
      mode = "REQUIRED"
    },
    {
      name = "invoice_number"
      type = "STRING"
      mode = "REQUIRED"
    },
    {
      name = "amount"
      type = "FLOAT"
      mode = "REQUIRED"
    },
    {
      name = "currency"
      type = "STRING"
      mode = "REQUIRED"
    },
    {
      name = "due_date"
      type = "DATE"
      mode = "REQUIRED"
    },
    {
      name = "status"
      type = "STRING"
      mode = "REQUIRED"
    },
    {
      name = "payment_method"
      type = "STRING"
      mode = "REQUIRED"
    },
    {
      name = "description"
      type = "STRING"
      mode = "NULLABLE"
    }
  ])
}

# AR Open Items Table
resource "google_bigquery_table" "ar_open_items" {
  dataset_id          = google_bigquery_dataset.cash_agent_demo.dataset_id
  table_id            = "ar_open_items"
  deletion_protection = false

  schema = jsonencode([
    {
      name = "ar_item_id"
      type = "STRING"
      mode = "REQUIRED"
    },
    {
      name = "customer_id"
      type = "STRING"
      mode = "REQUIRED"
    },
    {
      name = "customer_name"
      type = "STRING"
      mode = "REQUIRED"
    },
    {
      name = "invoice_number"
      type = "STRING"
      mode = "REQUIRED"
    },
    {
      name = "amount"
      type = "FLOAT"
      mode = "REQUIRED"
    },
    {
      name = "currency"
      type = "STRING"
      mode = "REQUIRED"
    },
    {
      name = "due_date"
      type = "DATE"
      mode = "REQUIRED"
    },
    {
      name = "status"
      type = "STRING"
      mode = "REQUIRED"
    },
    {
      name = "probability"
      type = "FLOAT"
      mode = "REQUIRED"
    },
    {
      name = "description"
      type = "STRING"
      mode = "NULLABLE"
    }
  ])
}

# FX Rates Table
resource "google_bigquery_table" "fx_rates" {
  dataset_id          = google_bigquery_dataset.cash_agent_demo.dataset_id
  table_id            = "fx_rates"
  deletion_protection = false

  schema = jsonencode([
    {
      name = "rate_date"
      type = "DATE"
      mode = "REQUIRED"
    },
    {
      name = "from_currency"
      type = "STRING"
      mode = "REQUIRED"
    },
    {
      name = "to_currency"
      type = "STRING"
      mode = "REQUIRED"
    },
    {
      name = "exchange_rate"
      type = "FLOAT"
      mode = "REQUIRED"
    }
  ])
}

# Payment Runs Table
resource "google_bigquery_table" "payment_runs" {
  dataset_id          = google_bigquery_dataset.cash_agent_demo.dataset_id
  table_id            = "payment_runs"
  deletion_protection = false

  schema = jsonencode([
    {
      name = "payment_run_id"
      type = "STRING"
      mode = "REQUIRED"
    },
    {
      name = "scheduled_date"
      type = "DATE"
      mode = "REQUIRED"
    },
    {
      name = "total_amount"
      type = "FLOAT"
      mode = "REQUIRED"
    },
    {
      name = "currency"
      type = "STRING"
      mode = "REQUIRED"
    },
    {
      name = "item_count"
      type = "INTEGER"
      mode = "REQUIRED"
    },
    {
      name = "status"
      type = "STRING"
      mode = "REQUIRED"
    },
    {
      name = "description"
      type = "STRING"
      mode = "NULLABLE"
    }
  ])
}

# Approval Requests Table
resource "google_bigquery_table" "approval_requests" {
  dataset_id          = google_bigquery_dataset.cash_agent_demo.dataset_id
  table_id            = "approval_requests"
  deletion_protection = false

  schema = jsonencode([
    {
      name = "request_id"
      type = "STRING"
      mode = "REQUIRED"
    },
    {
      name = "action_type"
      type = "STRING"
      mode = "REQUIRED"
    },
    {
      name = "amount"
      type = "FLOAT"
      mode = "REQUIRED"
    },
    {
      name = "currency"
      type = "STRING"
      mode = "REQUIRED"
    },
    {
      name = "description"
      type = "STRING"
      mode = "NULLABLE"
    },
    {
      name = "agent_reasoning"
      type = "STRING"
      mode = "NULLABLE"
    },
    {
      name = "status"
      type = "STRING"
      mode = "REQUIRED"
    },
    {
      name = "requested_at"
      type = "TIMESTAMP"
      mode = "NULLABLE"
    },
    {
      name = "requested_by"
      type = "STRING"
      mode = "NULLABLE"
    },
    {
      name = "approved_at"
      type = "TIMESTAMP"
      mode = "NULLABLE"
    },
    {
      name = "approved_by"
      type = "STRING"
      mode = "NULLABLE"
    },
    {
      name = "rejection_reason"
      type = "STRING"
      mode = "NULLABLE"
    }
  ])
}

# Agent Recommendations Table
resource "google_bigquery_table" "agent_recommendations" {
  dataset_id          = google_bigquery_dataset.cash_agent_demo.dataset_id
  table_id            = "agent_recommendations"
  deletion_protection = false

  schema = jsonencode([
    {
      name = "recommendation_id"
      type = "STRING"
      mode = "REQUIRED"
    },
    {
      name                   = "created_at"
      type                   = "TIMESTAMP"
      mode                   = "REQUIRED"
      defaultValueExpression = "CURRENT_TIMESTAMP()"
    },
    {
      name = "priority"
      type = "STRING"
      mode = "REQUIRED"
    },
    {
      name = "action_type"
      type = "STRING"
      mode = "REQUIRED"
    },
    {
      name = "amount"
      type = "FLOAT"
      mode = "REQUIRED"
    },
    {
      name = "currency"
      type = "STRING"
      mode = "REQUIRED"
    },
    {
      name = "description"
      type = "STRING"
      mode = "NULLABLE"
    },
    {
      name = "rationale"
      type = "STRING"
      mode = "NULLABLE"
    },
    {
      name = "status"
      type = "STRING"
      mode = "REQUIRED"
    },
    {
      name = "approval_request_id"
      type = "STRING"
      mode = "NULLABLE"
    }
  ])
}

# Agent Audit Log Table
resource "google_bigquery_table" "agent_audit_log" {
  dataset_id          = google_bigquery_dataset.cash_agent_demo.dataset_id
  table_id            = "agent_audit_log"
  deletion_protection = false

  schema = jsonencode([
    {
      name                     = "timestamp"
      type                     = "TIMESTAMP"
      mode                     = "REQUIRED"
      defaultValueExpression   = "CURRENT_TIMESTAMP()"
    },
    {
      name = "agent_name"
      type = "STRING"
      mode = "REQUIRED"
    },
    {
      name = "action"
      type = "STRING"
      mode = "REQUIRED"
    },
    {
      name = "tool_name"
      type = "STRING"
      mode = "NULLABLE"
    },
    {
      name = "input_summary"
      type = "STRING"
      mode = "NULLABLE"
    },
    {
      name = "output_summary"
      type = "STRING"
      mode = "NULLABLE"
    }
  ])
}
