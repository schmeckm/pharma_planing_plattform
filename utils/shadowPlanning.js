/**
 * Shadow-Planning Feature-Flag (Phase 1).
 * Bei true: Solver/Entwürfe nur in draftSchedules — produktive Orders erst via activate-draft.
 */
function isShadowPlanningEnabled() {
  return process.env.SHADOW_PLANNING === 'true';
}

module.exports = { isShadowPlanningEnabled };
