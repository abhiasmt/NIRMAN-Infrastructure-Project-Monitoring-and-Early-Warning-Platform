"""Train the delay-risk and cost-overrun-risk classifiers.

    python -m app.train --data ../data/synthetic_projects.csv

Labels are derived from the project features themselves (not assigned at random),
so the classifiers learn the same relationships the domain rules encode:
progress gap, cost revision, land acquisition, clearances and milestone slippage.

XGBoost is used when installed; otherwise RandomForestClassifier. Models are
saved with joblib into models/.
"""
from __future__ import annotations
import argparse, json, os
from pathlib import Path

import numpy as np
import pandas as pd
import joblib
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.calibration import CalibratedClassifierCV
from sklearn.metrics import roc_auc_score, precision_score, recall_score, f1_score, brier_score_loss

from .features import build_features, FEATURE_ORDER

try:
    from xgboost import XGBClassifier
    HAS_XGB = True
except ImportError:                                  # documented fallback
    HAS_XGB = False

MODEL_DIR = Path(__file__).resolve().parent.parent / "models"
MODEL_VERSION = "v1.3.0"


def _rows_from_csv(path: str) -> list[dict]:
    df = pd.read_csv(path)
    rows = df.to_dict("records")
    for r in rows:
        # The CSV has no milestone table; approximate delayed milestones from the
        # progress gap so training and inference see the same feature.
        gap = (r.get("expected_progress_pct") or 0) - (r.get("physical_progress_pct") or 0)
        delayed = 0 if gap < 6 else 1 if gap < 14 else 2 if gap < 22 else 3
        r["milestones"] = [{"status": "Delayed"}] * delayed + [{"status": "Completed"}] * (5 - delayed)
    return rows


def _labels(feats: pd.DataFrame) -> tuple[np.ndarray, np.ndarray]:
    """Ground truth derived from the project's own signals."""
    delay_score = (
        0.055 * feats.progress_gap.clip(lower=0)
        + 2.0 * feats.slip_excess
        + 1.5 * feats.land_gap
        + 1.0 * feats.clearance_penalty
        + 0.9 * feats.milestone_delay_ratio
        + 0.8 * feats.cost_overrun_ratio.clip(lower=0)
        + 0.05 * feats.months_of_delay
    )
    cost_score = (
        4.5 * feats.cost_overrun_ratio.clip(lower=0)
        + 0.028 * feats.progress_gap.clip(lower=0)
        + 1.0 * feats.land_gap
        + 0.6 * feats.clearance_penalty
        + 1.0 * feats.slip_excess
        + 0.03 * feats.months_of_delay
    )
    # Draw labels from the probability rather than a hard cut-off. Real outcomes
    # are not a deterministic function of the features, and a model trained on a
    # clean threshold would score a misleadingly perfect AUC.
    # Outcomes are drawn from the probability, not from a hard cut-off. Two
    # reasons: real project outcomes are not a deterministic function of the
    # features, and a model fitted to a clean threshold returns near-binary
    # probabilities — useless for a 0-100 risk score that has to rank projects.
    rng = np.random.default_rng(42)
    p_delay = 1 / (1 + np.exp(-(delay_score - 2.35)))
    p_cost = 1 / (1 + np.exp(-(cost_score - 1.75)))
    return ((rng.random(len(p_delay)) < p_delay).astype(int),
            (rng.random(len(p_cost)) < p_cost).astype(int))


def _base_estimator():
    if HAS_XGB:
        return XGBClassifier(n_estimators=320, max_depth=4, learning_rate=0.07,
                             subsample=0.9, colsample_bytree=0.9, eval_metric="logloss",
                             reg_lambda=1.2, random_state=42)
    return RandomForestClassifier(n_estimators=400, max_depth=9, min_samples_leaf=6,
                                  random_state=42)


def _make_model():
    """Isotonic calibration on top of the tree ensemble.

    Officers read the output as a probability and the platform turns it into a
    0-100 score, so the numbers have to mean what they say. Raw tree ensembles
    are over-confident; calibration is what makes a 0.42 actually behave like 42%.
    """
    return CalibratedClassifierCV(_base_estimator(), method="isotonic", cv=4)


def _evaluate(model, X_test, y_test) -> dict:
    proba = model.predict_proba(X_test)[:, 1]
    pred = (proba >= 0.5).astype(int)
    return {
        "roc_auc": round(float(roc_auc_score(y_test, proba)), 4),
        "precision": round(float(precision_score(y_test, pred, zero_division=0)), 4),
        "recall": round(float(recall_score(y_test, pred, zero_division=0)), 4),
        "f1": round(float(f1_score(y_test, pred, zero_division=0)), 4),
        "brier": round(float(brier_score_loss(y_test, proba)), 4),
    }


def _augment(X: pd.DataFrame, target_rows: int) -> pd.DataFrame:
    """Expand a small seed set with jittered copies.

    400 projects is not enough to fit a calibrated ensemble without high
    variance. Each synthetic row is an existing project perturbed within
    plausible bounds; labels are re-derived from the perturbed features, so the
    feature-to-outcome relationship stays intact.
    """
    if len(X) >= target_rows:
        return X
    rng = np.random.default_rng(7)
    copies = [X]
    scale = X.std(numeric_only=True).fillna(0.1).values * 0.25
    while sum(len(c) for c in copies) < target_rows:
        jitter = rng.normal(0, 1, size=X.shape) * scale
        c = X + jitter
        c["progress_gap"] = c["progress_gap"].clip(-20, 60)
        c["cost_overrun_ratio"] = c["cost_overrun_ratio"].clip(-0.05, 0.9)
        c["land_gap"] = c["land_gap"].clip(0, 1)
        c["clearance_penalty"] = c["clearance_penalty"].clip(0, 1).round(1)
        c["milestone_delay_ratio"] = c["milestone_delay_ratio"].clip(0, 1)
        c["slip_excess"] = c["slip_excess"].clip(0, 2)
        c["months_of_delay"] = c["months_of_delay"].clip(0, 60).round()
        copies.append(c)
    return pd.concat(copies, ignore_index=True).iloc[:target_rows]


def train(data_path: str, target_rows: int = 3000) -> dict:
    rows = _rows_from_csv(data_path)
    X = pd.DataFrame([build_features(r) for r in rows])[FEATURE_ORDER]
    seed_rows = len(X)
    X = _augment(X, target_rows)
    y_delay, y_cost = _labels(X)
    MODEL_DIR.mkdir(parents=True, exist_ok=True)

    report = {"model_version": MODEL_VERSION,
              "algorithm": ("XGBoost" if HAS_XGB else "RandomForest") + " + isotonic calibration",
              "seed_projects": seed_rows, "training_rows": len(X),
              "features": FEATURE_ORDER, "metrics": {}}

    for name, y in (("delay", y_delay), ("cost", y_cost)):
        X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.25, random_state=42, stratify=y)
        model = _make_model()
        model.fit(X_tr, y_tr)
        report["metrics"][name] = _evaluate(model, X_te, y_te)
        # Importances live on the wrapped estimators inside the calibrator.
        inner = [c.estimator for c in getattr(model, "calibrated_classifiers_", [])]
        importances = (np.mean([e.feature_importances_ for e in inner], axis=0)
                       if inner and hasattr(inner[0], "feature_importances_")
                       else np.zeros(len(FEATURE_ORDER)))
        report[f"{name}_feature_importance"] = {
            f: round(float(v), 4) for f, v in sorted(zip(FEATURE_ORDER, importances),
                                                     key=lambda kv: kv[1], reverse=True)}
        joblib.dump({"model": model, "features": FEATURE_ORDER, "version": MODEL_VERSION},
                    MODEL_DIR / f"{name}_model.joblib")
        print(f"  {name}: {report['metrics'][name]}")

    (MODEL_DIR / "training_report.json").write_text(json.dumps(report, indent=2))
    print(f"\nSaved models to {MODEL_DIR} ({report['algorithm']}).")
    return report


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    default = Path(__file__).resolve().parent.parent.parent / "data" / "synthetic_projects.csv"
    ap.add_argument("--data", default=str(default))
    ap.add_argument("--rows", type=int, default=3000, help="training rows after augmentation")
    args = ap.parse_args()
    print(f"Training on {args.data} (XGBoost {'available' if HAS_XGB else 'not installed — using RandomForest'})")
    train(args.data, args.rows)
