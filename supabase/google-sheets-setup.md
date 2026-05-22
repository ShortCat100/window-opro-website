# Google Sheets setup (cart submissions)

Spreadsheet: https://docs.google.com/spreadsheets/d/1MJhYdNtHvSzu_L0roTIYoz3jVt28oRBKkFBmeO7txms/edit

## Row 1 headers (recommended)

| A | B | C | D | E | F | G | H | I | J | K | L | M |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| submission_time | email | full_name | company_name | num_windows | height_inch | width_inch | openings | glass_type | adding | cost | discount | total_cost |

## How rows are added

- Scans from **row 2** downward (row 1 = headers).
- Finds the **first completely empty row** from the top.
- Writes all submitted cart lines starting on that row (stacked down).
- Works after manual edits: the next submit still uses the topmost empty row.

## Server environment variables

```
GOOGLE_SHEETS_SPREADSHEET_ID=1MJhYdNtHvSzu_L0roTIYoz3jVt28oRBKkFBmeO7txms
GOOGLE_SHEETS_SHEET_NAME=Sheet1
GOOGLE_SHEETS_DATA_START_ROW=2
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@project.iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

## Google Cloud steps

1. Create a project in [Google Cloud Console](https://console.cloud.google.com/).
2. Enable **Google Sheets API**.
3. Create a **Service Account** → Keys → JSON key.
4. Copy `client_email` → `GOOGLE_SERVICE_ACCOUNT_EMAIL`.
5. Copy `private_key` → `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` (keep `\n` line breaks).
6. Open your Google Sheet → **Share** → add the service account email as **Editor**.

If Sheets env vars are not set, submit still saves to Supabase only.
