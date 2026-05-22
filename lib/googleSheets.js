const { google } = require("googleapis");

const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;
const SHEET_NAME = process.env.GOOGLE_SHEET_NAME || "Sheet1";
const DATA_START_ROW = Number(process.env.GOOGLE_SHEET_DATA_START_ROW || 2);
const LAST_COLUMN = "K";

const SHEET_HEADERS = [
  "timestamp",
  "customer name",
  "company",
  "email",
  "phone",
  "quote",
  "tax",
  "discount",
  "total cost",
  "project details JSON",
  "uploaded file names"
];

function isGoogleSheetsConfigured() {
  return Boolean(
    SPREADSHEET_ID &&
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
    process.env.GOOGLE_PRIVATE_KEY
  );
}

function getPrivateKey() {
  return process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n");
}

function getSheetsClient() {
  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: getPrivateKey(),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"]
  });

  return google.sheets({ version: "v4", auth });
}

function isEmptySheetRow(row) {
  if (!row || row.length === 0) {
    return true;
  }

  return row.every(
    cell => cell === undefined || cell === null || String(cell).trim() === ""
  );
}

async function findFirstEmptyRow(sheets) {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A:${LAST_COLUMN}`
  });

  const rows = response.data.values || [];

  for (let index = DATA_START_ROW - 1; index < rows.length; index++) {
    if (isEmptySheetRow(rows[index])) {
      return index + 1;
    }
  }

  return rows.length + 1;
}

function computeCartSummary(cart) {
  let quote = 0;
  let tax = 0;
  let discount = 0;
  let totalCost = 0;

  cart.forEach(project => {
    quote += Number(project.quote) || 0;
    tax += Number(project.tax) || 0;

    const total = Number(project.total) || 0;
    const discountQuote = Number(project.discountQuote) || 0;

    if (discountQuote > 0) {
      discount += total - discountQuote;
      totalCost += discountQuote;
    } else {
      totalCost += total;
    }
  });

  return {
    quote: Number(quote.toFixed(2)),
    tax: Number(tax.toFixed(2)),
    discount: Number(discount.toFixed(2)),
    totalCost: Number(totalCost.toFixed(2))
  };
}

function buildSubmissionRow({ timestamp, user, cart, uploadedFileNames }) {
  const summary = computeCartSummary(cart);

  return [
    timestamp,
    user?.full_name || "",
    user?.company_name || "",
    user?.email || "",
    user?.phone || "",
    summary.quote,
    summary.tax,
    summary.discount,
    summary.totalCost,
    JSON.stringify(cart),
    uploadedFileNames.join(", ")
  ];
}

async function appendCartSubmissionLog({
  timestamp,
  user,
  cart,
  uploadedFileNames = []
}) {
  if (!isGoogleSheetsConfigured()) {
    console.warn(
      "Google Sheets skipped: set GOOGLE_SHEET_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL, and GOOGLE_PRIVATE_KEY"
    );
    return { skipped: true };
  }

  const sheets = getSheetsClient();
  const startRow = await findFirstEmptyRow(sheets);
  const values = [
    buildSubmissionRow({ timestamp, user, cart, uploadedFileNames })
  ];

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A${startRow}:${LAST_COLUMN}${startRow}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values }
  });

  return {
    skipped: false,
    startRow
  };
}

module.exports = {
  appendCartSubmissionLog,
  isGoogleSheetsConfigured,
  SHEET_HEADERS
};
