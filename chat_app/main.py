"""Google Chat App webhook that bridges Chat events to Vertex AI Agent Engine."""

import json
import os

from flask import Flask, Request, request, jsonify

app = Flask(__name__)

PROJECT_ID = os.environ.get("PROJECT_ID", "")
REGION = os.environ.get("REGION", "us-central1")
AGENT_ENGINE_ID = os.environ.get("AGENT_ENGINE_ID", "")

# Session store (in production, use Firestore or Redis)
_sessions: dict[str, str] = {}


def _get_agent_app():
    """Lazily initialize the Agent Engine client."""
    import vertexai
    from vertexai import agent_engines

    vertexai.init(project=PROJECT_ID, location=REGION)
    resource_name = (
        f"projects/{PROJECT_ID}/locations/{REGION}"
        f"/reasoningEngines/{AGENT_ENGINE_ID}"
    )
    return agent_engines.get(resource_name)


def _get_or_create_session(user_id: str) -> str:
    """Get existing session or create a new one for the user."""
    if user_id in _sessions:
        return _sessions[user_id]

    agent_app = _get_agent_app()
    session = agent_app.create_session(user_id=user_id)
    _sessions[user_id] = session["id"]
    return session["id"]


def _query_agent(user_id: str, message: str) -> str:
    """Send a message to the agent and collect the response."""
    agent_app = _get_agent_app()
    session_id = _get_or_create_session(user_id)

    response_text = ""
    try:
        for event in agent_app.stream_query(
            user_id=user_id,
            session_id=session_id,
            message=message,
        ):
            if hasattr(event, "content") and event.content:
                for part in event.content.parts:
                    if hasattr(part, "text") and part.text:
                        response_text += part.text
    except Exception as e:
        response_text = f"I encountered an error: {str(e)}"

    return response_text or "I didn't get a response. Please try again."


@app.route("/", methods=["POST"])
def chat_webhook():
    """Handle incoming Google Chat events."""
    event = request.get_json()
    event_type = event.get("type", "")

    if event_type == "ADDED_TO_SPACE":
        return jsonify({
            "text": (
                "Hello! I'm Cash Agent, your AI Treasury Assistant. "
                "I can help you with:\n"
                "- Cash position across all currencies\n"
                "- 30/60/90-day cash flow forecasts\n"
                "- Policy-grounded recommendations\n"
                "- FX hedging and investment execution\n"
                "- Anomaly detection and risk alerts\n"
                "- What-if scenario analysis\n\n"
                "Try asking: *What's our current cash position?*"
            )
        })

    if event_type == "MESSAGE":
        user = event.get("user", {})
        user_id = user.get("name", "anonymous")
        message_text = event.get("message", {}).get("text", "").strip()

        if not message_text:
            return jsonify({"text": "I didn't receive a message. Please try again."})

        # Remove bot mention if present
        if message_text.startswith("@"):
            message_text = message_text.split(" ", 1)[-1] if " " in message_text else message_text

        if not AGENT_ENGINE_ID:
            return jsonify({
                "text": (
                    "Agent Engine is not configured. "
                    "Set the AGENT_ENGINE_ID environment variable."
                )
            })

        response = _query_agent(user_id, message_text)
        return jsonify({"text": response})

    if event_type == "CARD_CLICKED":
        action = event.get("action", {})
        action_name = action.get("actionMethodName", "")

        if action_name == "approve":
            params = action.get("parameters", [])
            request_id = next(
                (p["value"] for p in params if p["key"] == "request_id"), None
            )
            if request_id:
                user_id = event.get("user", {}).get("name", "anonymous")
                response = _query_agent(
                    user_id,
                    f"Approve request {request_id}. I am approving this action.",
                )
                return jsonify({"text": response})

        if action_name == "reject":
            params = action.get("parameters", [])
            request_id = next(
                (p["value"] for p in params if p["key"] == "request_id"), None
            )
            if request_id:
                user_id = event.get("user", {}).get("name", "anonymous")
                response = _query_agent(
                    user_id,
                    f"Reject request {request_id}. Reason: Rejected via Chat.",
                )
                return jsonify({"text": response})

    return jsonify({"text": ""})


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "healthy", "service": "chat-app"})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    app.run(host="0.0.0.0", port=port, debug=True)
