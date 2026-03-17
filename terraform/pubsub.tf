# Pub/Sub Topic for Approval Requests
resource "google_pubsub_topic" "approval_requests" {
  name = "approval-requests"
}

# Pub/Sub Topic for Agent Actions
resource "google_pubsub_topic" "agent_actions" {
  name = "agent-actions"
}
