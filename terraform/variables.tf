variable "project_id" {
  description = "The GCP project ID"
  type        = string
}

variable "region" {
  description = "The GCP region for resources"
  type        = string
  default     = "us-central1"
}

variable "dataset_id" {
  description = "The BigQuery dataset ID"
  type        = string
  default     = "cash_agent_demo"
}

variable "agent_engine_id" {
  description = "The Vertex AI Agent Engine ID (set after agent deployment)"
  type        = string
  default     = ""
}
