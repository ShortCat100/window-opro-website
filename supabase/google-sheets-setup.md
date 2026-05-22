# Google Sheets logging (cart submit)

Backend-only. Credentials stay on Render — never in frontend code.

## Render environment variables

```
GOOGLE_SHEET_ID=1MJhYdNtHvSzu_L0roTIYoz3jVt28oRBKkFBmeO7txms
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

Optional:

```
GOOGLE_SHEET_NAME=Sheet1
GOOGLE_SHEET_DATA_START_ROW=2
```

## Sheet row 1 headers (recommended)

| A | B | C | D | E | F | G | H | I | J | K |
|---|---|---|---|---|---|---|---|---|---|---|
| timestamp | customer name | company | email | phone | quote | tax | discount | total cost | project details JSON | uploaded file names |

## Behavior

After `/api/submit-cart` saves to Supabase, **one row** is written per submit.

- Finds the **first empty row** from row 2 downward (row 1 = headers).
- Fills that row so manual edits above/below still work on the next submit.

## Google Cloud setup

1. Enable **Google Sheets API** in Google Cloud.
2. Create a **service account** and JSON key.
3. Share the spreadsheet with the service account email as **Editor**.

## NPM

```bash
npm install googleapis
```

If Sheets env vars are missing, submit still saves to Supabase only.
