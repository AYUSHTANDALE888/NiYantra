"""Plausibility rules R1-R5 from shared/formcheck-rules.json (the API evaluates the same file in Node)."""
from __future__ import annotations

import math
from typing import Optional

from .config import RULES
from .features import FIELD_LABEL


def js_round(x: float) -> int:
    """Math.round semantics (half up), so values match the Node evaluator exactly."""
    return math.floor(x + 0.5)


def _round(v: float) -> float:
    return js_round(v * 100) / 100


def evaluate_rules(f: dict[str, Optional[float]]) -> list[dict]:
    out: list[dict] = []
    for r in RULES.rules:
        v = f.get(r.feature)
        if v is None:
            continue
        hit = False
        if r.op == "gt":
            hit = v > r.value
        elif r.op == "gte":
            hit = v >= r.value
        elif r.op == "lt":
            hit = v < r.value
        elif r.op == "lte":
            hit = v <= r.value
        elif r.op == "gt_feature":
            other = f.get(r.compare or "")
            hit = other is not None and v > other
        if hit:
            shown = js_round(v * 100) if r.feature == "docs_ratio" else _round(v)
            out.append(
                {
                    "source": "rule",
                    "ruleId": r.id,
                    "field": FIELD_LABEL.get(r.field, r.field),
                    "value": shown,
                    "message": r.message,
                    "severity": r.severity,
                }
            )
    return out


def rule_hits(f: dict[str, Optional[float]]) -> list[str]:
    return [w["ruleId"] for w in evaluate_rules(f)]
