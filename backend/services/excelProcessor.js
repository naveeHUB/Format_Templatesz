const xlsx = require('xlsx');
const { groupCustomerSummary } = require('./summaryGenerator');

const calculationConfig = {
  currencyFormat: '[$$-409]#,##0.00;[Red]-[$$-409]#,##0.00'
};

function createWorksheetFromRows(rows) {
  const data = [
    [
      'CUSTOMER',
      'CUSTOMER DESC.',
      'ITEM',
      'ITEM DESCRIPTION',
      'Sales Plan Qty',
      'Sale Plan Value',
      '',
      '',
      'Customer',
      'Sum of Sale Plan Value'
    ]
  ];

  rows.forEach((row) => {
    data.push([
      row.customer || '',
      row.customerDesc || '',
      row.item || '',
      row.itemDescription || '',
      Number(row.salesQty) || 0,
      Number(row.salePlanValue) || 0,
      '',
      '',
      '',
      ''
    ]);
  });

  const worksheet = xlsx.utils.aoa_to_sheet(data);

  const summaryRows = groupCustomerSummary(rows);

  worksheet['I1'] = {
    t: 's',
    v: 'Customer'
  };

  worksheet['J1'] = {
    t: 's',
    v: 'Sum of Sale Plan Value'
  };

  summaryRows.forEach((item, index) => {
    const rowNumber = index + 2;

    worksheet[`I${rowNumber}`] = {
      t: 's',
      v: item.customer
    };

    worksheet[`J${rowNumber}`] = {
      t: 'n',
      v: Number(item.totalValue) || 0,
      z: calculationConfig.currencyFormat
    };
  });

  worksheet['!cols'] = [
    { wch: 20 },
    { wch: 35 },
    { wch: 20 },
    { wch: 50 },
    { wch: 18 },
    { wch: 18 },
    { wch: 5 },
    { wch: 5 },
    { wch: 20 },
    { wch: 25 }
  ];

  return {
    worksheet,
    summaryRows
  };
}

async function processSalesPlanWorkbook({
  sourcePath,
  outputPath,
  sheetName
}) {
  console.log('Reading workbook:', sourcePath);

  const workbook = xlsx.readFile(sourcePath);
  console.log('================================');
console.log('FILE BEING READ =', sourcePath);
console.log('ALL SHEETS =', workbook.SheetNames);
console.log('================================');

  const sourceSheetName = workbook.SheetNames[0];

console.log('USING SHEET =', sourceSheetName);

const worksheet = workbook.Sheets[sourceSheetName];

console.log('SHEET RANGE =', worksheet['!ref']);

  const rawRows = xlsx.utils.sheet_to_json(
    worksheet,
    {
      header: 1,
      defval: ''
    }
  );
  console.log('TOTAL RAW ROWS =', rawRows.length);

  if (!rawRows.length) {
    throw new Error('Worksheet is empty.');
  }

  console.log('HEADER ROW:', rawRows[0]);
  console.log('ROW LENGTH:', rawRows[1]?.length);

  const rows = rawRows
    .slice(1)
    .filter(row =>
      row.some(cell =>
        String(cell || '').trim() !== ''
      )
    )
    .map(row => ({
      customer: row[6] || '',
      customerDesc: row[7] || '',
      item: row[8] || '',
      itemDescription: row[10] || '',
      salesQty: row[19] || 0,
      salePlanValue: row[20] || 0
    }));

 console.log('FIRST DATA ROW:', rawRows[1]);

if (rawRows[1]) {
  console.log('COLUMN COUNT =', rawRows[1].length);

  rawRows[1].forEach((value, index) => {
    console.log(`COLUMN ${index} =`, value);
  });
}
  console.log('FIRST PROCESSED ROW:', rows[0]);

  const {
    worksheet: outputWorksheet,
    summaryRows
  } = createWorksheetFromRows(rows);

  const outputWorkbook = xlsx.utils.book_new();

  xlsx.utils.book_append_sheet(
    outputWorkbook,
    outputWorksheet,
    sheetName
  );

  xlsx.writeFile(
    outputWorkbook,
    outputPath
  );

  console.log(
    'Workbook generated:',
    outputPath
  );

  return {
    totalRows: rows.length,
    totalCustomers: summaryRows.length,
    summaryRows
  };
}

module.exports = {
  processSalesPlanWorkbook,
  calculationConfig
};