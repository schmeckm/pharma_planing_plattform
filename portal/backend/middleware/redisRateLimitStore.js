export class RedisRateLimitStore {
  constructor(_redisClient) {
    this.prefix = 'ratelimit:';
  }

  async increment(key) {
    return { totalHits: 1, resetTime: new Date(Date.now() + 60000) };
  }

  async decrement(key) {}

  async resetKey(key) {}
}
