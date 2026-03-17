"""Policy document search tools using Gemini grounding."""

import os

from ..shared_libraries.constants import PROJECT_ID


_POLICY_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "data", "policies")


def _load_policies() -> dict[str, str]:
    """Load policy markdown files from local directory."""
    policies = {}
    policy_dir = os.path.normpath(_POLICY_DIR)
    if os.path.isdir(policy_dir):
        for fname in os.listdir(policy_dir):
            if fname.endswith(".md"):
                with open(os.path.join(policy_dir, fname)) as f:
                    policies[fname] = f.read()
    return policies


def search_policies(query: str) -> dict:
    """Searches treasury policy documents for relevant sections.

    Performs keyword-based search over treasury policy documents and returns
    matching sections. Used by the RecommendationAgent to ground suggestions
    in company policy.

    Args:
        query: Natural language query about policy (e.g. "surplus investment limits",
               "FX hedging requirements", "approval thresholds").

    Returns:
        dict with matching policy excerpts and source document names.
    """
    policies = _load_policies()
    if not policies:
        return {
            "error": "No policy documents found.",
            "suggestion": "Ensure policy markdown files exist in data/policies/.",
        }

    query_lower = query.lower()
    keywords = query_lower.split()

    results = []
    for filename, content in policies.items():
        sections = content.split("\n## ")
        for section in sections:
            section_lower = section.lower()
            score = sum(1 for kw in keywords if kw in section_lower)
            if score > 0:
                # Take first 500 chars of matching section
                title = section.split("\n")[0].strip("# ")
                body = section[:500]
                results.append({
                    "source": filename,
                    "section": title,
                    "content": body,
                    "relevance_score": score,
                })

    results.sort(key=lambda x: x["relevance_score"], reverse=True)
    return {"results": results[:5], "query": query}
