import {SCOPES, SPREADSHEET_ID} from './config';
import {initializeGoogleClient} from './google.auth';

/**
 * @param {boolean} dryRun whether this is a dry run
 * Main runner
 */
async function main(dryRun: boolean = false) {
  console.log(
      'Starting Friday Fellows updater...' + (dryRun ? ' as dry run' : ''));

  let sheets = initializeGoogleClient(SCOPES);
  if (!sheets) process.exit(1);
}

// Main call
try {
  const args = process.argv.slice(2);
  main(args[0] === '--dryRun');
} catch (err) {
  console.log(err);
}
