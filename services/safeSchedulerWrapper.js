/**
 * Safe Degradation Wrapper — Optimierung wirft nie unkontrolliert nach oben (Zero-Crash).
 */
class SafeSchedulerWrapper {
  constructor(schedulingService, logger = console) {
    this.scheduling = schedulingService;
    this.logger = logger;
  }

  /**
   * @returns {Promise<{ ok: true, result: object } | { ok: false, status: string, message: string, errorCode: string, error?: string }>}
   */
  async optimizeSequence(options = {}) {
    try {
      const result = await this.scheduling.optimizeSequence(options);
      return { ok: true, result };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error('[SafeScheduler] Optimierung fehlgeschlagen — Graceful Degradation', {
        error: message,
        stack: err instanceof Error ? err.stack : undefined,
      });
      return {
        ok: false,
        status: 'DEGRADED',
        message: 'Scheduler vorübergehend nicht verfügbar — manuelle Planung läuft weiter.',
        errorCode: 'SCHEDULER_DEGRADED',
        error: message,
      };
    }
  }

  /**
   * @returns {Promise<{ ok: true, result: object } | { ok: false, status: string, message: string, errorCode: string, error?: string }>}
   */
  async getRecommendedSequence(options = {}) {
    try {
      const result = await this.scheduling.getRecommendedSequence(options);
      return { ok: true, result };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error('[SafeScheduler] Sequenzempfehlung fehlgeschlagen', { error: message });
      return {
        ok: false,
        status: 'DEGRADED',
        message: 'Sequenzempfehlung nicht verfügbar — Grobplan oder gespeicherten Plan verwenden.',
        errorCode: 'SCHEDULER_DEGRADED',
        error: message,
      };
    }
  }
}

module.exports = { SafeSchedulerWrapper };
