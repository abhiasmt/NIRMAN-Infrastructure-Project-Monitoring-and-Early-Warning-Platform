"""NIRMAN ML service — delay and cost-overrun risk scoring with explanations.

    uvicorn app.main:app --reload --port 8000

If the trained models are missing, the service scores with the calibrated
logistic fallback so the platform still runs end to end. /health reports which
mode is active.
"""
from __future__ import annotations
import math, os
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from fastapi import FastAPI
from pydantic import BaseModel, Field

from .features import build_features, FEATURE_ORDER
from .explain import build_drivers, build_focus

MODEL_DIR = Path(__file__).resolve().parent.parent / "models"
MODEL_VERSION_FALLBACK = "v1.3.0-logistic"

app = FastAPI(title="NIRMAN ML Service",
              description="Delay and cost-overrun risk prediction with explainable drivers. "
                          "Synthetic CUF-like data only.",
              version="1.3.0")

THRESHOLDS = {"low": 40, "high": 70, "critical": 85}
WEIGHTS = {"delay": 0.55, "cost": 0.45}

_models: dict = {}
try:
    for name in ("delay", "cost"):
        _models[name] = joblib.load(MODEL_DIR / f"{name}_model.joblib")
    MODE = "trained"
except Exception:                                    # not trained yet
    MODE = "fallback"

try:
    import shap
    HAS_SHAP = True
except ImportError:
    HAS_SHAP = False


class ProjectIn(BaseModel):
    project_code: str | None = None
    sanctioned_cost_cr: float
    revised_cost_cr: float | None = None
    expenditure_incurred_cr: float = 0
    physical_progress_pct: float = 0
    expected_progress_pct: float = 0
    land_acquisition_pct: float = 100
    clearance_status: str = "Approved"
    months_of_delay: int = 0
    actual_start_date: str | None = None
    original_start_date: str | None = None
    original_completion_date: str | None = None
    milestones: list[dict] = Field(default_factory=list)


class PredictRequest(BaseModel):
    project: ProjectIn


class BatchRequest(BaseModel):
    projects: list[ProjectIn]


# --- fallback scorer: same weights the Node service uses ---------------------
DELAY_W = dict(bias=-2.35, gap=0.055, slip=2.0, land=1.5, clear=1.0, milestone=0.9, cost=0.8, months=0.05)
COST_W = dict(bias=-1.75, cost=4.5, gap=0.028, land=1.0, clear=0.6, slip=1.0, months=0.03)
_sig = lambda z: 1 / (1 + math.exp(-z))


def _fallback(f: dict) -> tuple[float, float]:
    gap = max(0.0, f["progress_gap"])
    dz = (DELAY_W["bias"] + DELAY_W["gap"] * gap + DELAY_W["slip"] * f["slip_excess"]
          + DELAY_W["land"] * f["land_gap"] + DELAY_W["clear"] * f["clearance_penalty"]
          + DELAY_W["milestone"] * f["milestone_delay_ratio"]
          + DELAY_W["cost"] * max(0.0, f["cost_overrun_ratio"]) + DELAY_W["months"] * f["months_of_delay"])
    cz = (COST_W["bias"] + COST_W["cost"] * max(0.0, f["cost_overrun_ratio"])
          + COST_W["gap"] * gap + COST_W["land"] * f["land_gap"]
          + COST_W["clear"] * f["clearance_penalty"] + COST_W["slip"] * f["slip_excess"]
          + COST_W["months"] * f["months_of_delay"])
    return min(max(_sig(dz), 0.01), 0.98), min(max(_sig(cz), 0.01), 0.98)


def _level(score: int) -> str:
    if score >= THRESHOLDS["critical"]:
        return "Critical"
    if score >= THRESHOLDS["high"]:
        return "High"
    if score >= THRESHOLDS["low"]:
        return "Medium"
    return "Low"


def _shap_for(kind: str, X: pd.DataFrame) -> dict | None:
    if not (HAS_SHAP and MODE == "trained"):
        return None
    try:
        explainer = shap.TreeExplainer(_models[kind]["model"])
        values = explainer.shap_values(X)
        values = values[1] if isinstance(values, list) else values
        return {f: float(abs(v)) for f, v in zip(FEATURE_ORDER, np.ravel(values)[:len(FEATURE_ORDER)])}
    except Exception:
        return None


def _score_one(raw: dict) -> dict:
    feats = build_features(raw)
    X = pd.DataFrame([feats])[FEATURE_ORDER]

    if MODE == "trained":
        delay = float(_models["delay"]["model"].predict_proba(X)[0][1])
        cost = float(_models["cost"]["model"].predict_proba(X)[0][1])
        version = _models["delay"]["version"]
    else:
        delay, cost = _fallback(feats)
        version = MODEL_VERSION_FALLBACK

    score = round(100 * (WEIGHTS["delay"] * delay + WEIGHTS["cost"] * cost))
    shap_map = _shap_for("delay", X)
    drivers = build_drivers(raw, feats, shap_map)

    return {
        "project_code": raw.get("project_code"),
        "model_version": version,
        "explanation_method": "shap" if shap_map else "feature-importance + rules",
        "delay_probability": round(delay, 4),
        "cost_overrun_probability": round(cost, 4),
        "overall_risk_score": score,
        "risk_level": _level(score),
        "estimated_delay_months_min": round(10 * delay),
        "estimated_delay_months_max": round(15 * delay),
        "estimated_cost_overrun_pct_min": round(27 * cost),
        "estimated_cost_overrun_pct_max": round(38 * cost),
        "top_risk_drivers": drivers,
        "suggested_review_focus": build_focus(drivers),
        "features": {k: round(float(v), 4) for k, v in feats.items()},
    }


@app.get("/health")
def health():
    return {"status": "ok", "mode": MODE, "shap": HAS_SHAP,
            "model_dir": str(MODEL_DIR), "thresholds": THRESHOLDS, "weights": WEIGHTS}


@app.post("/predict")
def predict(req: PredictRequest):
    return _score_one(req.project.model_dump())


@app.post("/predict/batch")
def predict_batch(req: BatchRequest):
    return {"count": len(req.projects),
            "predictions": [_score_one(p.model_dump()) for p in req.projects]}


@app.get("/model/info")
def model_info():
    report = MODEL_DIR / "training_report.json"
    if report.exists():
        import json
        return json.loads(report.read_text())
    return {"mode": MODE, "message": "No trained model yet — run `python -m app.train`.",
            "features": FEATURE_ORDER}
