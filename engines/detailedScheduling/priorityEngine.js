class PriorityEngine {
  scoreOrder(order) {
    let score = 0;
    if (order.customerCritical) score += 10000;
    if (order.regulatoryCritical) score += 8000;
    if (order.priority === 'HIGH') score += 5000;
    else if (order.priority === 'MEDIUM') score += 2000;

    if (order.dueDate) {
      const days = Math.max(0, Math.floor((new Date(order.dueDate) - new Date()) / 86400000));
      score += Math.max(0, 4000 - days * 50);
    }

    score += Math.min(3000, Math.round((order.revenue || 0) / 100));
    return score;
  }

  sortOrders(orders) {
    return [...orders].sort((a, b) => this.scoreOrder(b) - this.scoreOrder(a));
  }
}

module.exports = { PriorityEngine };
