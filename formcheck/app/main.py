"""Form check service: rules R1-R5 plus an Isolation Forest model. Advisory only."""
from __future__ import annotations

from typing import Literal

from fastapi import FastAPI
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from .config import required_doc_kinds
from .features import FormValues, compute_features
from .model import load_scorer
from .rules import evaluate_rules

app = FastAPI(title="AICTE form check", version="1.0.0")
scorer = load_scorer()


class ScoreRequest(BaseModel):
    type: Literal["NEW_INSTITUTION", "EXTENSION", "NAME_CHANGE", "INTAKE_INCREASE", "CHANGE_OF_SITE", "VERIFICATION_VISIT", "RESTORATION"]
    values: FormValues
    today: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    requiredDocs: list[str] | None = None


def score_request(req: ScoreRequest) -> dict:
    required = req.requiredDocs if req.requiredDocs is not None else required_doc_kinds(req.type)
    f = compute_features(req.values, req.today, required)
    rule_warnings = evaluate_rules(f)
    assert scorer is not None
    s = scorer.score(f)
    flagged = s > scorer.threshold
    warnings = list(rule_warnings)
    if flagged:
        warnings.extend(scorer.explain(f))
    severity = "HIGH" if rule_warnings else "MEDIUM" if flagged else "NONE"
    return {
        "modelVersion": scorer.version,
        "severity": severity,
        "score": round(s, 4),
        "threshold": round(scorer.threshold, 4),
        "warnings": warnings,
    }


@app.get("/health")
def health() -> JSONResponse:
    if scorer is None:
        return JSONResponse({"status": "model missing"}, status_code=503)
    return JSONResponse({"status": "ok", "modelVersion": scorer.version})


@app.post("/score")
def score(req: ScoreRequest) -> JSONResponse:
    if scorer is None:
        return JSONResponse({"error": "model not available"}, status_code=503)
    return JSONResponse(score_request(req))
