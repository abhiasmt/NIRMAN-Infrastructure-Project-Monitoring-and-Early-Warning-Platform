"""Feature engineering shared by training and inference.

Every feature here is one an officer can point at in a review meeting — that is
deliberate, because the explanation shown in the UI is built from these names.
"""
from __future__ import annotations
from datetime import datetime, timezone
import numpy as np
import pandas as pd

FEATURE_ORDER = [
    "cost_overrun_ratio",
    "progress_gap",
    "progress_vs_time_ratio",
    "schedule_slippage_ratio",
    "slip_excess",
    "expenditure_ratio",
    "milestone_delay_ratio",
    "land_gap",
    "clearance_penalty",
    "months_of_delay",
]

CLEARANCE_PENALTY = {"Approved": 0.0, "Partial": 0.5, "Pending": 1.0}


def _months(a, b) -> float:
    a, b = pd.to_datetime(a), pd.to_datetime(b)
    if pd.isna(a) or pd.isna(b):
        return np.nan
    return (b - a).days / 30.44


def build_features(row: dict) -> dict:
    """Turn one raw project record into the model's feature vector."""
    sanctioned = float(row.get("sanctioned_cost_cr") or 0) or 1.0
    revised = float(row.get("revised_cost_cr") or sanctioned)
    physical = float(row.get("physical_progress_pct") or 0)
    expected = float(row.get("expected_progress_pct") or 0)
    expenditure = float(row.get("expenditure_incurred_cr") or 0)
    land = float(row.get("land_acquisition_pct") or 100)

    start = row.get("actual_start_date") or row.get("original_start_date")
    planned_duration = _months(start, row.get("original_completion_date"))
    elapsed = _months(start, datetime.now(timezone.utc).replace(tzinfo=None))
    planned_duration = planned_duration if planned_duration and planned_duration > 0 else 1.0
    elapsed = elapsed if elapsed and elapsed > 0 else 0.0
    slippage = elapsed / planned_duration

    milestones = row.get("milestones") or []
    total = max(1, len(milestones))
    delayed = sum(1 for m in milestones if (m.get("status") if isinstance(m, dict) else m) == "Delayed")

    return {
        "cost_overrun_ratio": (revised - sanctioned) / sanctioned,
        "progress_gap": expected - physical,
        "progress_vs_time_ratio": (physical / expected) if expected else 1.0,
        "schedule_slippage_ratio": slippage,
        # Slippage matters less on a project that is already nearly built.
        "slip_excess": max(0.0, slippage - 0.9) * (1 - 0.55 * min(max(physical, 0), 100) / 100),
        "expenditure_ratio": (expenditure / revised) if revised else 0.0,
        "milestone_delay_ratio": delayed / total,
        "land_gap": (100 - land) / 100,
        "clearance_penalty": CLEARANCE_PENALTY.get(row.get("clearance_status", "Approved"), 0.0),
        "months_of_delay": float(row.get("months_of_delay") or 0),
    }


def to_frame(rows: list[dict]) -> pd.DataFrame:
    return pd.DataFrame([build_features(r) for r in rows])[FEATURE_ORDER]
