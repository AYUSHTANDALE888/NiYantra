"""Shared configuration: rules, document lists and paths (validated with pydantic on startup)."""
from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Literal, Optional

from pydantic import BaseModel, Field

ROOT = Path(__file__).resolve().parent.parent
SHARED_DIR = Path(os.environ.get("SHARED_DIR", ROOT.parent / "shared"))
MODEL_PATH = Path(os.environ.get("MODEL_PATH", ROOT / "models" / "application_form_v1.joblib"))


class Rule(BaseModel):
    id: str
    feature: str
    op: Literal["gt", "gte", "lt", "lte", "gt_feature"]
    value: Optional[float] = None
    compare: Optional[str] = None
    field: str
    severity: Literal["HIGH", "MEDIUM"]
    message: str


class FormcheckRules(BaseModel):
    version: int = Field(gt=0)
    note: Optional[str] = None
    rules: list[Rule] = Field(min_length=1)


class DocCfg(BaseModel):
    kind: str
    label: str
    critical: bool
    hasExpiry: bool


class TypeCfg(BaseModel):
    label: str
    category: str
    requiresPriorApproval: bool
    documents: list[DocCfg]


def load_rules() -> FormcheckRules:
    return FormcheckRules.model_validate(json.loads((SHARED_DIR / "seed" / "formcheck-rules.json").read_text()))


def load_types() -> dict[str, TypeCfg]:
    raw = json.loads((SHARED_DIR / "seed" / "rules.json").read_text())
    return {k: TypeCfg.model_validate(v) for k, v in raw["types"].items()}


RULES = load_rules()
TYPES = load_types()


def required_doc_kinds(app_type: str) -> list[str]:
    """Critical documents are the required set for docs_ratio (as in the API)."""
    cfg = TYPES.get(app_type)
    return [d.kind for d in cfg.documents if d.critical] if cfg else []
