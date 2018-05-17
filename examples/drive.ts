import * as fs from 'fs';
import {AxiosResponse} from 'axios';
import * as readline from 'readline';
import {google} from 'googleapis';
const OAuth2Client = google.auth.OAuth2;
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly'];
const TOKEN_PATH = '../credentials.json';

// Load client secrets from a local file.
fs.readFile('../client_secret.json', (err, content) => {
  if (err) return console.log('Error loading client secret file:', err);
  // Authorize a client with credentials, then call the Google Drive API.
  authorize(JSON.parse(content.toString()), loadingVotingSheet);
});

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(credentials, callback) {
  const {client_secret, client_id, redirect_uris} = credentials.installed;
  const oAuth2Client = new OAuth2Client(client_id, client_secret, redirect_uris[0]);

  // Check if we have previously stored a token.
  fs.readFile(TOKEN_PATH, (err, token) => {
    if (err) return getAccessToken(oAuth2Client, callback);
    oAuth2Client.setCredentials(JSON.parse(token.toString()));
    callback(oAuth2Client);
  });
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback for the authorized client.
 */
function getAccessToken(oAuth2Client, callback) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });
  console.log('Authorize this app by visiting this url:', authUrl);
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  rl.question('Enter the code from that page here: ', (code) => {
    rl.close();
    oAuth2Client.getToken(code, (err, token) => {
      if (err) return callback(err);
      oAuth2Client.setCredentials(token);
      // Store the token to disk for later program executions
      fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
        if (err) console.error(err);
        console.log('Token stored to', TOKEN_PATH);
      });
      callback(oAuth2Client);
    });
  });
}

/**
 * Lists the names and IDs of up to 10 files.
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
function listFiles(auth) {
  const drive = google.drive({version: 'v3', auth});
  drive.files.list({
    pageSize: 10,
    fields: 'nextPageToken, files(id, name)',
  }, (err, {data}) => {
    if (err) return console.log('The API returned an error: ' + err);
    const files = data.files;
    if (files.length) {
      console.log('Files:');
      files.map((file) => {
        console.log(`${file.name} (${file.id})`);
      });
    } else {
      console.log('No files found.');
    }
  });
}

function promisifiy(fn, params) {
    return new Promise((resolve, reject) => {
        fn(params, (err, res) => {
            if (err) reject(err);
            resolve(res);
        });
    });
}

/**
 * Reads data from the voting sheet.
 */
 function loadingVotingSheet(auth) {
    const sheets = google.sheets({version: 'v4', auth});
    promisifiy(sheets.spreadsheets.values.get, {
         auth: auth,
         spreadsheetId: '1HN0dYPEet-Zkx_9AQGCKDZGU8ygNmpymLT3y6szp0UY',
         majorDimension: 'COLUMNS',
         range: 'A2:B25',
    }).then((res: AxiosResponse) => {
         const rows = res.data.values;
         if (rows.length === 0) {
           console.log('No data found.');
         } else {
           //console.log('Name, Major:');
           // for (const row of rows) {
           //   // Print columns A and E, which correspond to indices 0 and 4.
           //   console.log(`${row[0]}, ${row[4]}`);
           // }
           console.log(JSON.stringify(rows));
         }
    }).catch(err => {
         console.error('The API returned an error.');
         throw err;
    });
}