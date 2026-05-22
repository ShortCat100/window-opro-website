const { google } = require("googleapis");

const SPREADSHEET_ID =
  process.env.GOOGLE_SHEETS_SPREADSHEET_ID ||
  "1MJhYdNtHvSzu_L0roTIYoz3jVt28oRBKkFBmeO7txms";
const SHEET_NAME = process.env.GOOGLE_SHEETS_SHEET_NAME || "Sheet1";
const DATA_START_ROW = Number(process.env.GOOGLE_SHEETS_DATA_START_ROW || 2);
const LAST_COLUMN = "M";

function isGoogleSheetsConfigured() {
  return Boolean(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
    process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
  );
}

function getSheetsClient() {
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.replace(
    /\\n/g,
    "\n"
  );

  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: privateKey,
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

function recordsToSheetValues(records) {
  return records.map(record => [
    record.submission_time,
    record.email,
    record.full_name,
    record.company_name,
    record.num_windows,
    record.height_inch,
    record.width_inch,
    record.openings,
    record.glass_type,
    record.adding,
    record.cost,
    record.discount,
    record.total_cost
  ]);
}

async function appendCartSubmissionRows(records) {
  if (!isGoogleSheetsConfigured()) {
    console.warn(
      "Google Sheets skipped: set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY"
    );
    return { skipped: true };
  }

  if (!records.length) {
    return { skipped: true };
  }

  const sheets = getSheetsClient();
  const startRow = await findFirstEmptyRow(sheets);
  const endRow = startRow + records.length - 1;
  const values = recordsToSheetValues(records);

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A${startRow}:${LAST_COLUMN}${endRow}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values }
  });

  return {
    skipped: false,
    startRow,
    rowCount: records.length
  };
}

module.exports = {
  appendCartSubmissionRows,
  isGoogleSheetsConfigured
};
