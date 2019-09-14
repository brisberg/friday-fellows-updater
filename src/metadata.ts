import {sheets_v4} from 'googleapis';
import * as util from 'util';

import {SCOPES, SPREADSHEET_ID} from './config';
import {initializeGoogleClient} from './google.auth';

/**
 * Temporary library to test writing and reading Developer Metadata in the
 * GoogleSheets API.
 */

/**
 * @param {boolean} dryRun whether this is a dry run
 * Main runner
 */
async function main(dryRun: boolean = false) {
  console.log(
      'Starting Developer Metadata test run...' +
      (dryRun ? ' as dry run' : ''));

  let sheets: sheets_v4.Sheets;

  try {
    sheets = await initializeGoogleClient(SCOPES);
  } catch (err) {
    console.error('Fatal: Could not initialize GoogleSheets Client');
    process.exit(1);
  }
  console.info('\tGoogleSheets client service initialized');

  console.log('Writing Developer metadata for: ' + SPREADSHEET_ID + '...');
  const req: sheets_v4.Schema$CreateDeveloperMetadataRequest = {
    developerMetadata: {
      location: {
        sheetId: 1242888778,
      },
      metadataId: 1000,
      metadataKey: 'SPRING 2018 Start Date',
      metadataValue: new Date(2018, 3, 14).toUTCString(),
      visibility: 'PROJECT',
    }
  }

  const request = sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [{
        createDeveloperMetadata: req,
      }],
    }
  });

  // await request.then(console.log);
  console.log('done');

  const req2:
      sheets_v4.Params$Resource$Spreadsheets$Developermetadata$Search = {
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      dataFilters: [{
        developerMetadataLookup: {
          locationType: 'SHEET',
        }
      }]
    },
  };

  console.log(
      'Searching for Developer metadata for: ' + SPREADSHEET_ID + '...');
  await sheets.spreadsheets.developerMetadata.search(req2).then((res) => {
    const matchedData =
        res.data.matchedDeveloperMetadata.map((dm) => dm.developerMetadata);
    console.log(util.inspect(matchedData, false, null, true));
  });
  console.log('done');

  const req3: sheets_v4.Params$Resource$Spreadsheets$Developermetadata$Get = {
    spreadsheetId: SPREADSHEET_ID,
    metadataId: 1000,
  };

  console.log(
      'Reading Developer metadata ' + 1000 + ' for: ' + SPREADSHEET_ID + '...');
  await sheets.spreadsheets.developerMetadata.get(req3).then(console.log);
  console.log('done');
}

// Main call
try {
  const args = process.argv.slice(2);
  main(args[0] === '--dryRun');
} catch (err) {
  console.log(err);
}
