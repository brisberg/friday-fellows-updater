import {GaxiosResponse} from 'gaxios';
import {sheets_v4} from 'googleapis';

import {SCOPES, SPREADSHEET_ID} from './config';
import {initializeGoogleClient} from './google.auth';

/**
 * @param {boolean} dryRun whether this is a dry run
 * Main runner
 */
async function main(dryRun: boolean = false) {
  console.log(
      'Starting Friday Fellows updater...' + (dryRun ? ' as dry run' : ''));

  let sheets = await initializeGoogleClient(SCOPES);
  if (!sheets) return;

  const data =
      await sheets.spreadsheets
          .get({
            spreadsheetId: SPREADSHEET_ID,
            fields: 'sheets.properties.title',
          })
          .then((res: GaxiosResponse) => {
            return res.data.sheets
                .map((sheet: sheets_v4.Schema$Sheet) => sheet.properties.title)
                .reverse();
          })

  console.log(data);
}

// Main call
try {
  const args = process.argv.slice(2);
  main(args[0] === '--dryRun');
} catch (err) {
  console.log(err);
}
