/**
 * Validates mapped data rows and produces a comprehensive report.
 * 
 * @param {object[]} mappedRows - Rows processed by mappingEngine
 * @returns {object} Validation report containing issues list, counts, and stats
 */
function validateData(mappedRows) {
  const issues = [];
  const customerItemKeys = new Set();
  let missingCustomerCount = 0;
  let missingItemCount = 0;
  let missingQtyCount = 0;
  let missingPriceCount = 0;
  let duplicateCount = 0;
  let validRowsCount = 0;

  mappedRows.forEach((row, index) => {
    const rowIssues = [];
    const customer = String(row._standardFields.CUSTOMER || row.CUSTOMER || row['CUSTOMER DESC.'] || '').trim();
    const item = String(row._standardFields.ITEM || row.ITEM || '').trim();
    
    // Qty and Price validation
    const qtyVal = row._standardFields.QTY !== undefined ? row._standardFields.QTY : row['Sales Plan Qty'] || row['SALES PLAN QTY'];
    const priceVal = row._standardFields.PRICE !== undefined ? row._standardFields.PRICE : row['SALES PRICE'] || row['Total price'] || row['USD/EUR value'];

    const qty = parseFloat(String(qtyVal).replace(/,/g, ''));
    const price = parseFloat(String(priceVal).replace(/,/g, ''));

    if (!customer) {
      rowIssues.push('Missing CUSTOMER');
      missingCustomerCount++;
    }
    if (!item) {
      rowIssues.push('Missing ITEM');
      missingItemCount++;
    }
    if (qtyVal === undefined || qtyVal === null || qtyVal === '' || isNaN(qty) || qty <= 0) {
      rowIssues.push('Missing/Invalid QTY');
      missingQtyCount++;
    }
    if (priceVal === undefined || priceVal === null || priceVal === '' || isNaN(price) || price <= 0) {
      rowIssues.push('Missing/Invalid PRICE');
      missingPriceCount++;
    }

    // Duplicate detection based on Customer + Item combination
    if (customer && item) {
      const key = `${customer}_${item}`;
      if (customerItemKeys.has(key)) {
        rowIssues.push(`Duplicate row for Customer: ${customer}, Item: ${item}`);
        duplicateCount++;
      } else {
        customerItemKeys.add(key);
      }
    }

    if (rowIssues.length > 0) {
      issues.push({
        row: row._rowIndex || (index + 2),
        customer: customer || 'UNKNOWN',
        item: item || 'UNKNOWN',
        issues: rowIssues
      });
    } else {
      validRowsCount++;
    }
  });

  return {
    totalRows: mappedRows.length,
    validRows: validRowsCount,
    missingCustomer: missingCustomerCount,
    missingItem: missingItemCount,
    missingQty: missingQtyCount,
    missingPrice: missingPriceCount,
    duplicates: duplicateCount,
    issues // detail list
  };
}

module.exports = {
  validateData
};
