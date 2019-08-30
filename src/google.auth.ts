import {ClientSecret, Scopes} from 'contrib/googleapis';
import {readFile, writeFile} from 'fs';
import {OAuth2Client} from 'google-auth-library';
import {Credentials} from 'google-auth-library/build/src/auth/credentials';
import {google, sheets_v4} from 'googleapis';
import {createInterface} from 'readline';
import {promisify} from 'util';

import {TOKEN_PATH} from './config';

const readFileAsync = promisify(readFile);

// Initialize and return an autenticated GoogleSheets Client
export async function initializeGoogleClient(scopes: Scopes):
    Promise<sheets_v4.Sheets> {
  // Load client secrets from a local file.
  const content: Buffer|void = await readFileAsync('client_secret.json')
  // .catch((err) => {
  //   console.error('Error loading client secret file:', err);
  // });
  const secret: ClientSecret = JSON.parse(content.toString());
  // Authorize a client with credentials, then call the Google Drive API.
  return await authorize(secret, scopes)
      .then((auth: OAuth2Client) => {
        return google.sheets({version: 'v4', auth});
      })
      .catch((err: Error) => {
        printGoogleAuthError(err);
        return Promise.reject(err);
      });
};

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 * @param {ClientSecret} secret The authorization client secret.
 * @param {Scopes} scopes The scopes to request
//  * @param {function} callback The callback to call with the authorized client or error.
 */
async function authorize(
    secret: ClientSecret, scopes: Scopes): Promise<OAuth2Client> {
  const {client_secret, client_id, redirect_uris} = secret.installed;
  const oAuth2Client =
      new OAuth2Client(client_id, client_secret, redirect_uris[0]);

  // Check if we have previously stored a token.
  const token = await readFileAsync(TOKEN_PATH).catch((err) => {
    return getAccessToken(oAuth2Client, scopes);
  });
  if (!token) throw new Error('Error getting auth token');
  const credentials: Credentials = JSON.parse(token.toString());
  oAuth2Client.setCredentials(credentials);
  return oAuth2Client;
};

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
 * @param {Scopes} scopes The scopes to request
//  * @param {getEventsCallback} callback The callback for the authorized client.
 */
function getAccessToken(oAuth2Client: OAuth2Client, scopes: Scopes) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
  });
  console.log('Authorize this app by visiting this url:', authUrl);
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  rl.question('Enter the code from that page here: ', (code) => {
    rl.close();
    oAuth2Client.getToken(code, (err, token) => {
      // if (err) return callback(err);
      oAuth2Client.setCredentials(token);
      // Store the token to disk for later program executions
      writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
        if (err) console.error(err);
        console.log('Token stored to', TOKEN_PATH);
      });
      // callback(null, oAuth2Client);
      return oAuth2Client;
    });
  });
}

/** Small utility to nicely print an error returned from GoogleSheets */
function printGoogleAuthError(err) {
  console.error('Error authorizing Google Sheets client:');
  console.error(err.code + ' ' + err.response.statusText)
  console.error(err.stack);
}
