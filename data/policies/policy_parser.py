"""Parse YAML frontmatter from policy markdown files.

Provides cached, typed access to all policy thresholds.
Used by agent tools, agent runner, and UI API.
"""

import os
from functools import lru_cache
from typing import Any

import yaml

_DIR = os.path.dirname(os.path.abspath(__file__))


def _parse_frontmatter(content: str) -> tuple[dict, str]:
    """Split a markdown file into YAML frontmatter dict and body text."""
    if not content.startswith("---"):
        return {}, content
    # Find second '---' delimiter
    end = content.index("---", 3)
    frontmatter_str = content[3:end].strip()
    body = content[end + 3:].strip()
    return yaml.safe_load(frontmatter_str) or {}, body


@lru_cache(maxsize=1)
def load_all_policies() -> dict[str, dict[str, Any]]:
    """Load all policy files with parsed frontmatter.

    Returns:
        Dict mapping filename to {"thresholds": {...}, "body": "markdown..."}
    """
    policies: dict[str, dict[str, Any]] = {}
    if not os.path.isdir(_DIR):
        return policies
    for fname in sorted(os.listdir(_DIR)):
        if not fname.endswith(".md"):
            continue
        with open(os.path.join(_DIR, fname)) as f:
            content = f.read()
        frontmatter, body = _parse_frontmatter(content)
        policies[fname] = {
            "thresholds": frontmatter.get("thresholds", {}),
            "body": body,
        }
    return policies


@lru_cache(maxsize=1)
def get_merged_thresholds() -> dict[str, Any]:
    """Return all thresholds merged from all policy files."""
    merged: dict[str, Any] = {}
    for data in load_all_policies().values():
        merged.update(data["thresholds"])
    return merged


# ---- Convenience Accessors ----

def get_surplus_ratio() -> float:
    return float(get_merged_thresholds().get("surplus_ratio", 1.2))


def get_collection_risk_threshold() -> float:
    return float(get_merged_thresholds().get("collection_risk_probability", 0.6))


def get_hedge_thresholds() -> dict[str, int]:
    return dict(get_merged_thresholds().get("hedge_thresholds", {}))


def get_auto_execute_max() -> int:
    return int(get_merged_thresholds().get("agent_auto_execute_max", 100000))


def get_confirmation_max() -> int:
    return int(get_merged_thresholds().get("agent_confirmation_max", 500000))


def get_formal_approval_min() -> int:
    return int(get_merged_thresholds().get("agent_formal_approval_min", 500000))


def get_policy_documents() -> list[dict[str, Any]]:
    """Return policy documents for the UI — body only, no YAML frontmatter."""
    display_names = {
        "approval_matrix.md": "Treasury Approval Matrix",
        "fx_hedging_policy.md": "Foreign Exchange Hedging Policy",
        "treasury_policy.md": "Corporate Treasury Policy",
    }
    docs = []
    for fname, data in load_all_policies().items():
        docs.append({
            "name": fname,
            "display_name": display_names.get(fname, fname.replace("_", " ").replace(".md", "").title()),
            "thresholds": data["thresholds"],
            "body_markdown": data["body"],
        })
    return docs
