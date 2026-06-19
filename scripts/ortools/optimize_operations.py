"""
Phase 5 — Multi work-center operation scheduling (SAP routing + finite capacity).
"""
from __future__ import annotations

import time
from datetime import date, timedelta
from typing import Any

from ortools.sat.python import cp_model


def _days_between(a: str, b: str) -> int:
    d0 = date.fromisoformat(a[:10])
    d1 = date.fromisoformat(b[:10])
    return (d1 - d0).days


def _hours_to_days(hours: float, perf_factor: float, hours_per_day: float) -> int:
    pf = max(0.5, min(1.5, perf_factor or 1.0))
    adjusted = float(hours) / pf
    return max(1, int((adjusted + hours_per_day - 1) // hours_per_day))


def optimize_operations_payload(payload: dict[str, Any]) -> dict[str, Any]:
    t0 = time.time()
    horizon_start = payload.get("horizonStart", "2026-09-01")
    horizon_days = int(payload.get("horizonDays", 14))
    max_time = float(payload.get("maxTimeSeconds") or 120.0)
    line_balance_weight = int(payload.get("lineBalanceWeight") or 15)
    num_workers = int(payload.get("numWorkers") or 8)
    hours_per_day = float(payload.get("hoursPerDay") or 16.0)

    work_centers = payload.get("workCenters") or []
    wc_map = {w["workCenterId"]: w for w in work_centers if w.get("workCenterId")}
    operations = payload.get("operations") or []

    horizon = max(7, min(horizon_days, 365))
    base_date = date.fromisoformat(horizon_start[:10])

    if not operations:
        return {
            "solverStatus": "EMPTY",
            "runtimeMs": 0,
            "operations": [],
            "timelineStart": horizon_start,
            "timelineEnd": horizon_start,
            "score": {},
        }

    model = cp_model.CpModel()
    starts: dict[str, cp_model.IntVar] = {}
    ends: dict[str, cp_model.IntVar] = {}
    durations: dict[str, int] = {}

    for op in operations:
        oid = op["operationId"]
        wc = wc_map.get(op["workCenterId"], {})
        perf = float(wc.get("performanceFactor") or op.get("performanceFactor") or 1.0)
        dur = op.get("durationDays")
        if dur is None:
            dur = _hours_to_days(op.get("durationHours") or 8, perf, hours_per_day)
        dur = max(1, min(int(dur), horizon - 1))
        durations[oid] = dur
        starts[oid] = model.NewIntVar(0, horizon - dur, f"start_{oid}")
        ends[oid] = model.NewIntVar(dur, horizon, f"end_{oid}")
        model.Add(ends[oid] == starts[oid] + dur)

    pinned_map = {p["operationId"]: p for p in payload.get("pinnedOperations") or [] if p.get("operationId")}
    for op in operations:
        oid = op["operationId"]
        pin = pinned_map.get(oid)
        if not pin:
            continue
        if pin.get("plannedStartDate"):
            try:
                day = _days_between(horizon_start, pin["plannedStartDate"][:10])
            except ValueError:
                continue
            day = max(0, min(day, horizon - durations[oid] - 1))
            model.Add(starts[oid] == day)

    by_order: dict[str, list[dict]] = {}
    for op in operations:
        po = op.get("packagingOrderId") or op.get("packagingOrder")
        by_order.setdefault(po, []).append(op)

    for ops in by_order.values():
        ordered = sorted(ops, key=lambda x: int(x.get("operationNo") or 0))
        for i in range(1, len(ordered)):
            model.Add(starts[ordered[i]["operationId"]] >= ends[ordered[i - 1]["operationId"]])

    wc_ids = sorted({op["workCenterId"] for op in operations if op.get("workCenterId")})
    for wc_id in wc_ids:
        intervals = []
        for op in operations:
            if op.get("workCenterId") != wc_id:
                continue
            oid = op["operationId"]
            intervals.append(model.NewIntervalVar(
                starts[oid], durations[oid], ends[oid], f"iv_{oid}",
            ))
        if intervals:
            model.AddNoOverlap(intervals)

    late_terms = []
    for po, ops in by_order.items():
        last_op = max(ops, key=lambda x: int(x.get("operationNo") or 0))
        delivery = last_op.get("requestedDeliveryDate")
        if not delivery:
            continue
        try:
            due = _days_between(horizon_start, delivery[:10])
        except ValueError:
            continue
        oid = last_op["operationId"]
        late = model.NewIntVar(0, horizon, f"late_{oid}")
        model.Add(late >= ends[oid] - due)
        weight = max(1, int(last_op.get("priorityScore") or 50))
        late_terms.append(late * weight)

    line_loads = []
    for wc_id in wc_ids:
        count_vars = []
        for op in operations:
            if op.get("workCenterId") != wc_id:
                continue
            present = model.NewBoolVar(f"on_{wc_id}_{op['operationId']}")
            model.Add(present == 1)
            count_vars.append(present)
        if count_vars:
            load = model.NewIntVar(0, len(count_vars), f"load_{wc_id}")
            model.Add(load == sum(count_vars))
            line_loads.append(load)

    max_line_load = model.NewIntVar(0, len(operations), "max_load")
    if line_loads:
        model.AddMaxEquality(max_line_load, line_loads)

    makespan = model.NewIntVar(0, horizon, "makespan")
    model.AddMaxEquality(makespan, [ends[op["operationId"]] for op in operations])

    objective = late_terms + [makespan * 2, max_line_load * line_balance_weight]
    model.Minimize(sum(objective) if objective else 0)

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = max_time
    solver.parameters.num_search_workers = max(1, num_workers)
    status = solver.Solve(model)

    status_name = {
        cp_model.OPTIMAL: "OPTIMAL",
        cp_model.FEASIBLE: "FEASIBLE",
        cp_model.INFEASIBLE: "INFEASIBLE",
        cp_model.MODEL_INVALID: "MODEL_INVALID",
        cp_model.UNKNOWN: "UNKNOWN",
    }.get(status, "UNKNOWN")

    ok = status in (cp_model.OPTIMAL, cp_model.FEASIBLE)
    scheduled = []

    for op in operations:
        oid = op["operationId"]
        start_day = solver.Value(starts[oid]) if ok else 0
        dur = durations[oid]
        start_date = (base_date + timedelta(days=start_day)).isoformat()
        end_date = (base_date + timedelta(days=start_day + dur - 1)).isoformat()
        scheduled.append({
            **op,
            "plannedStartDate": start_date,
            "plannedEndDate": end_date,
            "durationDays": dur,
            "solverScheduled": ok,
        })

    horizon_end = (base_date + timedelta(days=horizon - 1)).isoformat()
    order_end = max((s["plannedEndDate"] for s in scheduled if s.get("plannedEndDate")), default=horizon_start)
    timeline_end = order_end if order_end > horizon_end else horizon_end
    runtime_ms = int((time.time() - t0) * 1000)

    return {
        "solverStatus": status_name,
        "runtimeMs": runtime_ms,
        "engine": "google-or-tools-operations",
        "phase": 5,
        "operations": scheduled,
        "timelineStart": horizon_start,
        "timelineEnd": timeline_end,
        "score": {
            "solverObjective": solver.ObjectiveValue() if ok else None,
            "operationCount": len(scheduled),
            "workCenterCount": len(wc_ids),
            "lineBalanceWeight": line_balance_weight,
        },
    }
