"""
OR-Tools CP-SAT scheduling sidecar for Hard Allocation Engine.

POST /optimize — job-shop with line assignment, no-overlap, weighted lateness.
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


def _duration_days(order: dict[str, Any], horizon: int) -> int:
    hours = float(order.get("durationHours") or 16)
    qty = float(order.get("quantity") or 0)
    perf_factor = float(order.get("performanceFactor") or 1.0)
    if perf_factor > 0:
        hours = hours / max(0.5, min(1.5, perf_factor))
    if qty > 8000 and hours < qty / 500.0:
        hours = max(hours, qty / 500.0)
    days = max(1, int((hours + 7) // 8))
    return min(days, max(1, horizon - 1))


def optimize_payload(payload: dict[str, Any]) -> dict[str, Any]:
    t0 = time.time()
    horizon_start = payload.get("horizonStart", "2026-09-01")
    horizon_days = int(payload.get("horizonDays", 90))
    max_time = float(payload.get("maxTimeSeconds") or 120.0)
    line_score_weight = int(payload.get("lineScoreWeight") or 8)
    line_balance_weight = int(payload.get("lineBalanceWeight") or 15)
    num_workers = int(payload.get("numWorkers") or 8)
    lines = payload.get("lines") or []
    all_orders = payload.get("orders") or []

    eligible = [o for o in all_orders if o.get("eligible", True)]
    blocked = [o for o in all_orders if not o.get("eligible", True)]

    line_ids = [l["lineId"] for l in lines if l.get("lineId")]
    if not line_ids:
        line_ids = ["PACK_LINE_01"]

    horizon = max(14, min(horizon_days, 365))
    model = cp_model.CpModel()
    starts: dict[str, cp_model.IntVar] = {}
    ends: dict[str, cp_model.IntVar] = {}
    line_vars: dict[str, dict[str, cp_model.IntVar]] = {}
    durations: dict[str, int] = {}
    prefer_penalties: list[cp_model.IntVar] = []
    line_score_penalties: list[cp_model.IntVar] = []

    for order in eligible:
        oid = order["packagingOrderId"]
        dur = _duration_days(order, horizon)
        durations[oid] = dur
        starts[oid] = model.NewIntVar(0, horizon - dur, f"start_{oid}")
        ends[oid] = model.NewIntVar(dur, horizon, f"end_{oid}")
        model.Add(ends[oid] == starts[oid] + dur)
        line_vars[oid] = {}
        preferred = order.get("preferredLine") or order.get("bestLineId")
        line_scores = order.get("lineScores") or {}
        for lid in line_ids:
            line_vars[oid][lid] = model.NewBoolVar(f"line_{oid}_{lid}")
            score = int(line_scores.get(lid, 50))
            score = max(0, min(100, score))
            line_pen = model.NewIntVar(0, 100, f"line_score_pen_{oid}_{lid}")
            model.Add(line_pen == 100 - score).OnlyEnforceIf(line_vars[oid][lid])
            model.Add(line_pen == 0).OnlyEnforceIf(line_vars[oid][lid].Not())
            line_score_penalties.append(line_pen)
        model.AddExactlyOne(line_vars[oid][lid] for lid in line_ids)
        if preferred and preferred in line_ids:
            pref_var = model.NewBoolVar(f"pref_{oid}")
            model.Add(line_vars[oid][preferred] == 1).OnlyEnforceIf(pref_var)
            model.Add(line_vars[oid][preferred] == 0).OnlyEnforceIf(pref_var.Not())
            penalty = model.NewIntVar(0, 1, f"pref_pen_{oid}")
            model.Add(penalty == 0).OnlyEnforceIf(pref_var)
            model.Add(penalty == 1).OnlyEnforceIf(pref_var.Not())
            prefer_penalties.append(penalty)

    for lid in line_ids:
        intervals = []
        for order in eligible:
            oid = order["packagingOrderId"]
            iv = model.NewOptionalIntervalVar(
                starts[oid],
                durations[oid],
                ends[oid],
                line_vars[oid][lid],
                f"iv_{oid}_{lid}",
            )
            intervals.append(iv)
        if intervals:
            model.AddNoOverlap(intervals)

    late_terms = []
    for order in eligible:
        oid = order["packagingOrderId"]
        delivery = order.get("requestedDeliveryDate")
        if not delivery:
            continue
        try:
            due = _days_between(horizon_start, delivery[:10])
        except ValueError:
            continue
        late = model.NewIntVar(0, horizon, f"late_{oid}")
        model.Add(late >= ends[oid] - due)
        weight = max(1, int(order.get("priorityScore", 50)))
        late_terms.append(late * weight)

    makespan = model.NewIntVar(0, horizon, "makespan")
    if eligible:
        model.AddMaxEquality(makespan, [ends[o["packagingOrderId"]] for o in eligible])

    line_loads: list[cp_model.IntVar] = []
    for lid in line_ids:
        assigned = [
            line_vars[o["packagingOrderId"]][lid]
            for o in eligible
        ]
        load = model.NewIntVar(0, len(eligible), f"load_{lid}")
        model.Add(load == sum(assigned))
        line_loads.append(load)

    max_line_load = model.NewIntVar(0, len(eligible), "max_line_load")
    if line_loads:
        model.AddMaxEquality(max_line_load, line_loads)

    objective_parts = (
        late_terms
        + [makespan * 2]
        + [p * 10 for p in prefer_penalties]
        + [p * line_score_weight for p in line_score_penalties]
        + [max_line_load * line_balance_weight]
    )
    if objective_parts:
        model.Minimize(sum(objective_parts))
    else:
        model.Minimize(0)

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
    base_date = date.fromisoformat(horizon_start[:10])
    sequence = []

    for order in eligible:
        oid = order["packagingOrderId"]
        start_day = solver.Value(starts[oid]) if ok else 0
        dur = durations[oid]
        start_date = (base_date + timedelta(days=start_day)).isoformat()
        end_date = (base_date + timedelta(days=start_day + dur - 1)).isoformat()
        assigned_line = line_ids[0]
        if ok:
            for lid in line_ids:
                if solver.Value(line_vars[oid][lid]):
                    assigned_line = lid
                    break
        end_day = solver.Value(ends[oid]) if ok else dur
        delivery = order.get("requestedDeliveryDate")
        late = False
        if delivery and ok:
            try:
                due = _days_between(horizon_start, delivery[:10])
                late = end_day > due
            except ValueError:
                pass
        sequence.append({
            "packagingOrderId": oid,
            "packagingOrder": oid,
            "materialNumber": order.get("materialNumber"),
            "destinationCountry": order.get("destinationCountry"),
            "quantity": order.get("quantity"),
            "priority": order.get("priority"),
            "productionLine": assigned_line,
            "plannedStartDate": start_date,
            "plannedEndDate": end_date,
            "planningStatus": "OPTIMIZED",
            "allocationStatus": "VALID",
            "recommendedBatchId": (order.get("eligibleBatchIds") or [None])[0],
            "priorityScore": order.get("priorityScore"),
            "expectedOee": order.get("expectedOee"),
            "performanceFactor": order.get("performanceFactor"),
            "adjustedLineScore": order.get("adjustedLineScore"),
            "late": late,
        })

    for order in blocked:
        oid = order["packagingOrderId"]
        sequence.append({
            "packagingOrderId": oid,
            "packagingOrder": oid,
            "materialNumber": order.get("materialNumber"),
            "destinationCountry": order.get("destinationCountry"),
            "productionLine": order.get("preferredLine") or line_ids[0],
            "plannedStartDate": horizon_start,
            "plannedEndDate": horizon_start,
            "planningStatus": "BLOCKED",
            "allocationStatus": "AT_RISK",
            "recommendedBatchId": None,
            "issues": [{"code": "CONSTRAINT", "severity": "HIGH", "message": "Failed ATP/TRIC/RMSL/QA gate"}],
        })

    sequence.sort(key=lambda x: (x.get("plannedStartDate") or "", x.get("packagingOrderId") or ""))

    late_count = sum(1 for s in sequence if s.get("late"))
    runtime_ms = int((time.time() - t0) * 1000)
    horizon_end = (base_date + timedelta(days=horizon - 1)).isoformat()
    order_end = max((s["plannedEndDate"] for s in sequence if s.get("plannedEndDate")), default=horizon_start)
    timeline_end = order_end if order_end > horizon_end else horizon_end
    line_counts = {}
    for s in sequence:
        line = s.get("productionLine")
        if line:
            line_counts[line] = line_counts.get(line, 0) + 1

    return {
        "solverStatus": status_name,
        "runtimeMs": runtime_ms,
        "sequence": sequence,
        "timelineStart": horizon_start,
        "timelineEnd": timeline_end,
        "score": {
            "lateOrders": late_count,
            "blockedOrders": len(blocked),
            "solverObjective": solver.ObjectiveValue() if ok else None,
            "lineScoreWeight": line_score_weight,
            "lineBalanceWeight": line_balance_weight,
            "maxLineLoad": max(line_counts.values()) if line_counts else 0,
            "lineDistribution": line_counts,
            "eligibleOrders": len(eligible),
        },
        "kpis": {
            "openOrders": len(sequence),
            "optimizedOrders": len(eligible) if ok else 0,
            "blockedOrders": len(blocked),
        },
    }
