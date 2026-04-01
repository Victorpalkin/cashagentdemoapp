"""Policy document search and threshold tools."""

import os
import sys

from ..shared_libraries.constants import PROJECT_ID


_POLICY_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "data", "policies")

# Make the policy parser importable
sys.path.insert(0, os.path.normpath(_POLICY_DIR))
import policy_parser as _parser  # noqa: E402


def _load_policies() -> dict[str, str]:
    """Load policy markdown files from local directory (body only, no frontmatter)."""
    policies = {}
    for data in _parser.load_all_policies().values():
        # Use the body without YAML frontmatter for text search
        pass
    policy_dir = os.path.normpath(_POLICY_DIR)
    if os.path.isdir(policy_dir):
        for fname in os.listdir(policy_dir):
            if fname.endswith(".md"):
                with open(os.path.join(policy_dir, fname)) as f:
                    content = f.read()
                # Strip YAML frontmatter for search
                if content.startswith("---"):
                    try:
                        end = content.index("---", 3)
                        content = content[end + 3:].strip()
                    except ValueError:
                        pass
                policies[fname] = content
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


def get_policy_thresholds() -> dict:
    """Returns all policy thresholds used for agent decision-making.

    Returns structured thresholds from all treasury policy documents including:
    - surplus_ratio: Balance-to-obligations ratio that defines surplus (e.g. 1.2 = 120%)
    - collection_risk_probability: AR probability below which collection is at risk (e.g. 0.6)
    - hedge_thresholds: Per-currency FX exposure limits that trigger mandatory hedging
    - agent_auto_execute_max: Max USD amount for auto-execution without approval
    - agent_confirmation_max: Max USD amount requiring only user confirmation
    - agent_formal_approval_min: Min USD amount requiring formal VP approval

    Returns:
        dict with all threshold values from policy documents.
    """
    return _parser.get_merged_thresholds()


# Re-export convenience accessors for internal use by other tools
get_hedge_thresholds = _parser.get_hedge_thresholds
get_collection_risk_threshold = _parser.get_collection_risk_threshold
get_surplus_ratio = _parser.get_surplus_ratio
get_auto_execute_max = _parser.get_auto_execute_max
get_formal_approval_min = _parser.get_formal_approval_min
