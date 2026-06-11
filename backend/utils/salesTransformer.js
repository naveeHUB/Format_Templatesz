// backend/utils/salesTransformer.js

/**
 * Transform raw sheet row into required output format
 * Final columns order:
 * CUSTOMER, CUSTOMER DESC., ITEM, ITEM DESCRIPTION, CATEGORY,
 * SALES PRICE, CURRENCY, USD/EUR VALUE, TOTAL PRICE,
 * SALES PLAN QTY, SALES PLAN VALUE (FORMULA),
 * blank, blank,
 * CUSTOMER DESC (duplicate),
 * SUM INR, SUM USD
 */

function toNumber(val) {
  if (val === null || val === undefined || val === "") return 0;

  const n = Number(String(val).replace(/,/g, ""));
  return isNaN(n) ? 0 : n;
}

function getMinPrice(usd, eur) {
  if (usd && eur) return Math.min(usd, eur);
  return usd || eur || "";
}

function transformRow(row, index) {
  const usdValue = toNumber(row.USD_VALUE || row.USD_EUR_VALUE_USD);
  const eurValue = toNumber(row.EUR_VALUE || row.USD_EUR_VALUE_EUR);

  const totalPrice = usdValue || eurValue || "";

  const salesPrice =
    usdValue && eurValue
      ? Math.min(usdValue, eurValue)
      : usdValue || eurValue || "";

  const qty = row.SALES_PLAN_QTY || "";

  // Excel row index (header assumed at row 1)
  const excelRow = index + 2;

  // Excel formula for Sales Plan Value
  const salesPlanFormula =
    `=IF(AND(J${excelRow}<>"",I${excelRow}<>""),J${excelRow}*I${excelRow}/100000,"")`;

  return {
    output: [
      row.CUSTOMER || "",
      row.CUSTOMER_DESC || "",
      row.ITEM || "",
      row.ITEM_DESCRIPTION || "",
      row.CATEGORY || "",

      salesPrice,
      row.CURRENCY || "",

      totalPrice,
      totalPrice,

      qty,

      salesPlanFormula, // ✅ Excel formula

      "", // blank
      "", // blank

      row.CUSTOMER_DESC || "",

      "", // SUM INR (future Excel/Pivot)
      ""  // SUM USD
    ]
  };
}

function transformData(rows) {
  const transformed = [];

  let sumINR = 0;
  let sumUSD = 0;

  const validationReport = [];

  rows.forEach((row, index) => {
    const { output } = transformRow(row, index);

    transformed.push(output);

    // =========================
    // BASIC VALIDATION REPORT
    // =========================
    const issues = [];

    if (!row.CUSTOMER) issues.push("Missing CUSTOMER");
    if (!row.ITEM) issues.push("Missing ITEM");
    if (!row.SALES_PLAN_QTY) issues.push("Missing QTY");

    if (!row.USD_VALUE && !row.EUR_VALUE) {
      issues.push("Missing PRICE");
    }

    if (issues.length > 0) {
      validationReport.push({
        row: index + 2,
        customer: row.CUSTOMER || "",
        issues
      });
    }
  });

  return {
    data: transformed,
    summary: {
      sumINR,
      sumUSD,
      validationReport
    }
  };
}

module.exports = {
  transformRow,
  transformData
};