function groupCustomerSummary(rows) {
  const customerMap = new Map();

  rows.forEach((row) => {
    const customer = String(row.customer || '').trim();
    const value = Number(row.salePlanValue || 0);

    if (!customer) {
      return;
    }

    if (!customerMap.has(customer)) {
      customerMap.set(customer, 0);
    }

    customerMap.set(
      customer,
      customerMap.get(customer) + value
    );
  });

  return Array.from(customerMap.entries())
    .map(([customer, totalValue]) => ({
      customer,
      totalValue
    }))
    .sort((a, b) => b.totalValue - a.totalValue);
}

module.exports = {
  groupCustomerSummary
};