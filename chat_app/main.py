"""Google Chat App webhook that bridges Chat events to Vertex AI Agent Engine."""

import os

from flask import Flask, Request, request, jsonify, render_template_string

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


def _query_agent(user_id: str, message: str) -> dict:
    """Send a message to the agent and collect text + images."""
    agent_app = _get_agent_app()
    session_id = _get_or_create_session(user_id)

    response_text = ""
    images = []
    try:
        for event in agent_app.stream_query(
            user_id=user_id,
            session_id=session_id,
            message=message,
        ):
            if isinstance(event, dict):
                content = event.get("content", {})
                for part in content.get("parts", []):
                    if part.get("text"):
                        response_text += part["text"]
                    inline = part.get("inline_data") or part.get("inlineData")
                    if inline:
                        mime = inline.get("mime_type") or inline.get("mimeType", "")
                        if mime.startswith("image/"):
                            images.append({"data": inline.get("data", ""), "mime_type": mime})
            elif hasattr(event, "content") and event.content:
                for part in event.content.parts:
                    if hasattr(part, "text") and part.text:
                        response_text += part.text
                    if hasattr(part, "inline_data") and part.inline_data:
                        mime = getattr(part.inline_data, "mime_type", "")
                        if mime.startswith("image/"):
                            import base64
                            data = part.inline_data.data
                            if isinstance(data, bytes):
                                data = base64.b64encode(data).decode()
                            images.append({"data": data, "mime_type": mime})
    except Exception as e:
        response_text = f"I encountered an error: {str(e)}"

    return {
        "response": response_text or "I didn't get a response. Please try again.",
        "images": images,
    }


CHAT_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Cash Agent</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; height: 100vh; display: flex; flex-direction: column; background: #f5f5f5; }
.header { background: #1a237e; color: #fff; padding: 16px 24px; font-size: 20px; font-weight: 600; flex-shrink: 0; display: flex; align-items: center; gap: 10px; }
.header span { font-size: 14px; font-weight: 400; opacity: 0.8; }
.messages { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 12px; }
.msg { max-width: 75%; padding: 12px 16px; border-radius: 16px; line-height: 1.5; font-size: 14px; word-wrap: break-word; }
.msg.user { align-self: flex-end; background: #1565c0; color: #fff; border-bottom-right-radius: 4px; }
.msg.agent { align-self: flex-start; background: #fff; color: #212121; border-bottom-left-radius: 4px; box-shadow: 0 1px 2px rgba(0,0,0,0.1); }
.msg.agent p { margin: 0 0 8px 0; } .msg.agent p:last-child { margin-bottom: 0; }
.msg.agent strong { font-weight: 600; }
.msg.agent code { background: #f0f0f0; padding: 2px 6px; border-radius: 4px; font-size: 13px; }
.msg.agent pre { background: #f0f0f0; padding: 12px; border-radius: 8px; overflow-x: auto; margin: 8px 0; }
.msg.agent pre code { background: none; padding: 0; }
.msg.agent ul, .msg.agent ol { margin: 4px 0 4px 20px; }
.msg.thinking { align-self: flex-start; background: #fff; color: #999; font-style: italic; box-shadow: 0 1px 2px rgba(0,0,0,0.1); }
.input-bar { display: flex; padding: 16px; background: #fff; border-top: 1px solid #e0e0e0; flex-shrink: 0; gap: 8px; }
.input-bar input { flex: 1; padding: 12px 16px; border: 1px solid #ddd; border-radius: 24px; font-size: 14px; outline: none; }
.input-bar input:focus { border-color: #1565c0; }
.input-bar button { background: #1565c0; color: #fff; border: none; border-radius: 24px; padding: 12px 24px; font-size: 14px; cursor: pointer; font-weight: 500; }
.input-bar button:hover { background: #0d47a1; }
.input-bar button:disabled { background: #bbb; cursor: not-allowed; }
.welcome { text-align: center; color: #666; margin: auto; max-width: 400px; }
.welcome h2 { margin-bottom: 12px; color: #1a237e; }
.welcome p { font-size: 14px; line-height: 1.6; }
</style>
</head>
<body>
<div class="header">Cash Agent <span>AI Treasury Assistant</span></div>
<div class="messages" id="messages">
  <div class="welcome">
    <h2>Welcome to Cash Agent</h2>
    <p>Ask about cash positions, forecasts, recommendations, FX hedging, anomalies, or scenario analysis.</p>
  </div>
</div>
<div class="input-bar">
  <input type="text" id="input" placeholder="Ask Cash Agent..." autocomplete="off">
  <button id="send" onclick="sendMessage()">Send</button>
</div>
<script>
const messagesEl = document.getElementById('messages');
const inputEl = document.getElementById('input');
const sendBtn = document.getElementById('send');
let firstMsg = true;

inputEl.addEventListener('keydown', e => { if (e.key === 'Enter' && !sendBtn.disabled) sendMessage(); });

function renderMarkdown(text) {
  let html = text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/```([\\s\\S]*?)```/g, (_, code) => '<pre><code>' + code.trim() + '</code></pre>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\\*\\*(.+?)\\*\\*/g, '<strong>$1</strong>')
    .replace(/\\*(.+?)\\*/g, '<em>$1</em>');
  html = html.replace(/(^|\\n)- (.+)/g, '$1<li>$2</li>');
  html = html.replace(/(<li>.*<\\/li>)/gs, '<ul>$1</ul>');
  html = html.replace(/<\\/ul>\\s*<ul>/g, '');
  html = html.split(/\\n{2,}/).map(p => {
    p = p.trim();
    if (!p || p.startsWith('<pre>') || p.startsWith('<ul>') || p.startsWith('<ol>')) return p;
    return '<p>' + p + '</p>';
  }).join('');
  html = html.replace(/\\n/g, '<br>');
  return html;
}

function addMessage(text, cls) {
  if (firstMsg) { messagesEl.querySelector('.welcome')?.remove(); firstMsg = false; }
  const div = document.createElement('div');
  div.className = 'msg ' + cls;
  if (cls === 'agent') div.innerHTML = renderMarkdown(text);
  else div.textContent = text;
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return div;
}

async function sendMessage() {
  const text = inputEl.value.trim();
  if (!text) return;
  inputEl.value = '';
  addMessage(text, 'user');
  sendBtn.disabled = true;
  const thinking = addMessage('Thinking...', 'thinking');
  try {
    const res = await fetch('/api/chat', {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({message: text})
    });
    const data = await res.json();
    thinking.remove();
    const resp = data.response || data.error || 'No response';
    addMessage(typeof resp === 'string' ? resp : resp.response || 'No response', 'agent');
    if (data.images && data.images.length > 0) {
      data.images.forEach(img => {
        const imgDiv = document.createElement('div');
        imgDiv.className = 'msg agent';
        imgDiv.innerHTML = '<img src="data:' + img.mime_type + ';base64,' + img.data + '" style="max-width:100%;border-radius:8px;">';
        messagesEl.appendChild(imgDiv);
      });
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }
  } catch (err) {
    thinking.remove();
    addMessage('Error: ' + err.message, 'agent');
  }
  sendBtn.disabled = false;
  inputEl.focus();
}
</script>
</body>
</html>"""


@app.route("/api/chat", methods=["POST"])
def api_chat():
    """JSON API for the web chat UI."""
    data = request.get_json()
    message = (data.get("message") or "").strip() if data else ""
    if not message:
        return jsonify({"error": "No message provided"}), 400

    if not AGENT_ENGINE_ID:
        return jsonify({
            "response": (
                "Agent Engine is not configured on this deployment. "
                "Set the AGENT_ENGINE_ID environment variable, or use "
                "'adk web' locally to chat with the agent."
            )
        })

    result = _query_agent("web-user", message)
    return jsonify(result)


@app.route("/", methods=["GET", "POST"])
def root():
    """GET: serve web chat UI. POST: handle Google Chat webhook events."""
    if request.method == "GET":
        return render_template_string(CHAT_HTML)

    # POST — Google Chat webhook
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

        result = _query_agent(user_id, message_text)
        return jsonify({"text": result["response"]})

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
                result = _query_agent(
                    user_id,
                    f"Approve request {request_id}. I am approving this action.",
                )
                return jsonify({"text": result["response"]})

        if action_name == "reject":
            params = action.get("parameters", [])
            request_id = next(
                (p["value"] for p in params if p["key"] == "request_id"), None
            )
            if request_id:
                user_id = event.get("user", {}).get("name", "anonymous")
                result = _query_agent(
                    user_id,
                    f"Reject request {request_id}. Reason: Rejected via Chat.",
                )
                return jsonify({"text": result["response"]})

    return jsonify({"text": ""})


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "healthy", "service": "chat-app"})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    app.run(host="0.0.0.0", port=port, debug=True)
