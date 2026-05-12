"""Policy thresholds and document access.

Reads from pre-generated constants (zero I/O at runtime).
Regenerate after editing policy .md files:
    python data/policies/generate_policy_constants.py
"""

from typing import Any

from .policy_data import MERGED_THRESHOLDS, POLICIES


def load_all_policies() -> dict[str, dict[str, Any]]:
    return POLICIES


def get_merged_thresholds() -> dict[str, Any]:
    return MERGED_THRESHOLDS


def get_surplus_ratio() -> float:
    return float(MERGED_THRESHOLDS.get("surplus_ratio", 1.2))


def get_collection_risk_threshold() -> float:
    return float(MERGED_THRESHOLDS.get("collection_risk_probability", 0.6))


def get_hedge_thresholds() -> dict[str, int]:
    return dict(MERGED_THRESHOLDS.get("hedge_thresholds", {}))


def get_auto_execute_max() -> int:
    return int(MERGED_THRESHOLDS.get("agent_auto_execute_max", 100000))


def get_confirmation_max() -> int:
    return int(MERGED_THRESHOLDS.get("agent_confirmation_max", 500000))


def get_formal_approval_min() -> int:
    return int(MERGED_THRESHOLDS.get("agent_formal_approval_min", 500000))


def get_policy_documents() -> list[dict[str, Any]]:
    display_names = {
        "approval_matrix.md": "Treasury Approval Matrix",
        "fx_hedging_policy.md": "Foreign Exchange Hedging Policy",
        "treasury_policy.md": "Corporate Treasury Policy",
    }
    return [
        {
            "name": fname,
            "display_name": display_names.get(fname, fname.replace("_", " ").replace(".md", "").title()),
            "thresholds": data["thresholds"],
            "body_markdown": data["body"],
        }
        for fname, data in POLICIES.items()
    ]
