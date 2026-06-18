class FifoEngine {
  filterByMaterial(batches, materialNumber) {
    return batches.filter((b) => b.materialNumber === materialNumber);
  }

  filterAvailable(batches) {
    return batches.filter((b) => b.availableQuantity > 0);
  }

  sortByFifo(batches) {
    return [...batches].sort((a, b) => {
      const dateCompare = new Date(a.productionDate) - new Date(b.productionDate);
      return dateCompare !== 0 ? dateCompare : a.batchId.localeCompare(b.batchId);
    });
  }

  selectCandidates(batches, materialNumber) {
    let candidates = this.filterByMaterial(batches, materialNumber);
    candidates = this.filterAvailable(candidates);
    return this.sortByFifo(candidates);
  }
}

module.exports = { FifoEngine };
