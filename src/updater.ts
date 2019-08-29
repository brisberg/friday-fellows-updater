import {SCOPES, SPREADSHEET_ID} from './config';
import {initializeGoogleClient} from './google.auth';

/**
 * @param {boolean} dryRun whether this is a dry run
 * Main runner
 */
async function main(dryRun: boolean = false) {
  console.log(
      'Starting Friday Fellows updater...' + (dryRun ? ' as dry run' : ''));

  let sheets = await initializeGoogleClient(SCOPES).catch((err) => {
    console.error('Error authorizing Google Sheets client:');
    console.error(err.code + ' ' + err.response.statusText)
    console.error(err.stack);
    process.exit(1);
  })
}

// Main call
try {
  const args = process.argv.slice(2);
  main(args[0] === '--dryRun');
} catch (err) {
  console.log(err);
}
