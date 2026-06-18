"""FastAPI wrapper for OR-Tools scheduling sidecar."""
import os

from fastapi import FastAPI
from pydantic import BaseModel, Field

from optimize import optimize_payload
from optimize_operations import optimize_operations_payload

app = FastAPI(title="HAP OR-Tools Sidecar", version="0.3.0")


class OptimizeRequest(BaseModel):
    horizonStart: str = "2026-09-01"
    horizonDays: int = 90
    maxTimeSeconds: float | None = None
    lines: list = Field(default_factory=list)
    calendars: list = Field(default_factory=list)
    orders: list = Field(default_factory=list)


class OptimizeOperationsRequest(BaseModel):
    horizonStart: str = "2026-09-01"
    horizonDays: int = 14
    maxTimeSeconds: float | None = None
    lineBalanceWeight: int | None = None
    numWorkers: int | None = None
    hoursPerDay: float | None = None
    workCenters: list = Field(default_factory=list)
    operations: list = Field(default_factory=list)


@app.get("/health")
def health():
    return {
        "status": "ok",
        "engine": "google-or-tools",
        "maxTimeSeconds": float(os.getenv("ORTOOLS_MAX_TIME_SECONDS", "30")),
        "operationsEndpoint": "/optimize-operations",
    }


@app.post("/optimize")
def optimize(req: OptimizeRequest):
    body = req.model_dump()
    if body.get("maxTimeSeconds") is None:
        body["maxTimeSeconds"] = float(os.getenv("ORTOOLS_MAX_TIME_SECONDS", "30"))
    return optimize_payload(body)


@app.post("/optimize-operations")
def optimize_operations(req: OptimizeOperationsRequest):
    body = req.model_dump()
    if body.get("maxTimeSeconds") is None:
        body["maxTimeSeconds"] = float(os.getenv("ORTOOLS_MAX_TIME_SECONDS", "120"))
    if body.get("lineBalanceWeight") is None:
        body["lineBalanceWeight"] = int(os.getenv("ORTOOLS_LINE_BALANCE_WEIGHT", "15"))
    if body.get("numWorkers") is None:
        body["numWorkers"] = int(os.getenv("ORTOOLS_NUM_WORKERS", "8"))
    if body.get("hoursPerDay") is None:
        body["hoursPerDay"] = float(os.getenv("PLANNING_HOURS_PER_DAY", "8")) * 2
    return optimize_operations_payload(body)
