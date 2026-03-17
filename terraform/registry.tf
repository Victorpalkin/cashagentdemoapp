# Artifact Registry for Docker images
resource "google_artifact_registry_repository" "docker" {
  location      = var.region
  repository_id = "cash-agent-demo"
  format        = "DOCKER"
  description   = "Docker images for Cash Agent Demo"

  depends_on = [google_project_service.artifactregistry]
}
