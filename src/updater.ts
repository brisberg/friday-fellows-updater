/**
 * FridayFellowsUpdater main function and the starting point for the process.
 */

import {GaxiosResponse} from 'gaxios';
import {sheets_v4} from 'googleapis';

import {SCOPES, SPREADSHEET_ID} from './config';
import {initializeGoogleClient, printGoogleAuthError} from './google.auth';
import {SpreadsheetModel, WorksheetModel} from './model/sheets';

/**
 * @param {boolean} dryRun whether this is a dry run
 * Main runner
 */
async function main(dryRun: boolean = false) {
  console.log(
      'Starting Friday Fellows updater...' + (dryRun ? ' as dry run' : ''));

  let sheets: sheets_v4.Sheets;

  try {
    sheets = await initializeGoogleClient(SCOPES);
  } catch (err) {
    console.error('Fatal: Could not initialize GoogleSheets Client');
    process.exit(1);
  }
  console.info('\tGoogleSheets client service initialized');

  process.stdout.write(
      'Fetching spreadsheet metadata for: ' + SPREADSHEET_ID + '...');

  const metadataFields = [
    'spreadsheetId',
    'properties.title',
    'sheets.properties.sheetId',
    'sheets.properties.title',
    'sheets.properties.gridProperties',
  ].join(',');

  const request = sheets.spreadsheets.get({
    spreadsheetId: SPREADSHEET_ID,
    fields: metadataFields,
  });

  const sheetModel = await request.then(handleSpreadsheetsGetResponse);

  // request.catch((err) => {
  //   console.error('Error fetching GoogleSheets data:');
  //   printGoogleAuthError(err);
  // });
  console.log('done');
  console.log(sheetModel);
}

/**
 * Convert a response from spreadsheets.get into a SpreadsheetModel domain
 * object.
 */
function handleSpreadsheetsGetResponse(
    res: GaxiosResponse<sheets_v4.Schema$Spreadsheet>): SpreadsheetModel {
  const data = res.data;

  const sheetModel: SpreadsheetModel = {
    spreadsheetId: data.spreadsheetId,
    title: data.properties.title,
    sheets: [],
  };

  const sheets: WorksheetModel[] = data.sheets.map((sheet) => {
    return {
      title: sheet.properties.title,
      sheetId: sheet.properties.sheetId,
      gridProperties: {
        rowCount: sheet.properties.gridProperties.rowCount,
        columnCount: sheet.properties.gridProperties.columnCount,
      },
      data: [],
    };
  });
  sheetModel.sheets = sheets.reverse();
  return sheetModel;
}

// Main call
try {
  const args = process.argv.slice(2);
  main(args[0] === '--dryRun');
} catch (err) {
  console.log(err);
}
