"""Human-readable explanations for a prediction.

SHAP values are used when the library is installed; otherwise the model's own
feature importances are combined with project-specific rules. Either way the
officer sees the same vocabulary, never a raw model dump.
"""
from __future__ import annotations

IMPACT_HIGH, IMPACT_MEDIUM = "High", "Medium"

FOCUS = {
    "Land Acquisition": "Expedite land acquisition coordination with the district administration.",
    "Clearance Status": "Escalate pending statutory clearances to the nodal ministry.",
    "Physical Progress Gap": "Review contractor mobilisation and the execution plan for the current quarter.",
    "Cost Revision": "Verify the revised cost estimate and the additional funding requirement.",
    "Milestone Delay": "Convene a milestone review meeting with the implementing agency.",
    "Schedule Slippage": "Request a revised completion plan with a month-wise catch-up schedule.",
    "Reported Delay": "Reconcile the reported delay against the approved revised completion date.",
}


def build_drivers(raw: dict, feats: dict, shap_values: dict | None = None) -> list[dict]:
    """Return the top contributing factors, worded for a review note."""
    candidates = []

    def add(factor, detail, weight, high_at):
        if weight <= 0:
            return
        candidates.append({
            "factor": factor,
            "detail": detail,
            "impact": IMPACT_HIGH if weight >= high_at else IMPACT_MEDIUM,
            "_w": shap_values.get(factor, weight) if shap_values else weight,
        })

    gap = feats["progress_gap"]
    if gap > 5:
        add("Physical Progress Gap",
            f"Actual progress is {raw.get('physical_progress_pct')}% while expected progress is "
            f"{raw.get('expected_progress_pct')}%.", gap / 30, 0.6)

    cor = feats["cost_overrun_ratio"]
    if cor > 0.05:
        add("Cost Revision",
            f"Revised cost is {round(cor * 100)}% above the sanctioned cost.", cor * 3, 0.6)

    if feats["land_gap"] > 0.08:
        add("Land Acquisition",
            f"Land acquisition is {raw.get('land_acquisition_pct')}% complete.",
            feats["land_gap"] * 2, 0.6)

    if feats["clearance_penalty"] > 0:
        add("Clearance Status",
            f"Statutory clearance status is {str(raw.get('clearance_status','')).lower()}.",
            feats["clearance_penalty"], 0.9)

    if feats["milestone_delay_ratio"] > 0:
        delayed = round(feats["milestone_delay_ratio"] * len(raw.get("milestones") or [1]))
        add("Milestone Delay",
            f"{delayed} milestone(s) are behind their planned dates.",
            feats["milestone_delay_ratio"], 0.4)

    if feats["slip_excess"] > 0.05:
        add("Schedule Slippage",
            f"Elapsed duration has passed the planned duration by "
            f"{round(feats['schedule_slippage_ratio'] * 100 - 100)}%.", feats["slip_excess"], 0.3)

    if feats["months_of_delay"] >= 6:
        add("Reported Delay",
            f"The agency reports {int(feats['months_of_delay'])} months of delay against the "
            f"original completion date.", feats["months_of_delay"] / 24, 0.5)

    candidates.sort(key=lambda d: d["_w"], reverse=True)
    top = candidates[:4]
    for d in top:
        d.pop("_w", None)
    return top


def build_focus(drivers: list[dict]) -> list[str]:
    out = [FOCUS[d["factor"]] for d in drivers if d["factor"] in FOCUS]
    return out or ["Continue routine quarterly monitoring; no material risk driver detected."]
