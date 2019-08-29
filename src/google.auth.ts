import {ClientSecret, Scopes} from 'contrib/googleapis';
import {readFile, writeFile} from 'fs';
import {OAuth2Client} from 'google-auth-library';
import {Credentials} from 'google-auth-library/build/src/auth/credentials';
import {google} from 'googleapis';
import {createInterface} from 'readline';

import {TOKEN_PATH} from './config';

// Really returns a google sheets api client
export function initializeGoogleClient(scopes: Scopes): any|null {
  // Load client secrets from a local file.
  readFile('client_secret.json', (err, content: Buffer) => {
    if (err) {
      console.error('Error loading client secret file:', err);
      return null;
    }
    const secret: ClientSecret = JSON.parse(content.toString());
    // Authorize a client with credentials, then call the Google Drive API.
    authorize(secret, scopes, (err: Error, auth: OAuth2Client) => {
      if (err) {
        printGoogleAuthError(err);
        return null;
      }

      return google.sheets({version: 'v4', auth});
    });
  });
}

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 * @param {ClientSecret} secret The authorization client secret.
 * @param {Scopes} scopes The scopes to request
 * @param {function} callback The callback to call with the authorized client or error.
 */
function authorize(
    secret: ClientSecret, scopes: Scopes,
    callback: (err: Error, auth?: OAuth2Client) => void) {
  const {client_secret, client_id, redirect_uris} = secret.installed;
  const oAuth2Client =
      new OAuth2Client(client_id, client_secret, redirect_uris[0]);

  // Check if we have previously stored a token.
  readFile(TOKEN_PATH, (err, token) => {
    if (err) return getAccessToken(oAuth2Client, scopes, callback);
    const credentials: Credentials = JSON.parse(token.toString());
    oAuth2Client.setCredentials(credentials);
    callback(null, oAuth2Client);
  });
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
 * @param {Scopes} scopes The scopes to request
 * @param {getEventsCallback} callback The callback for the authorized client.
 */
function getAccessToken(
    oAuth2Client: OAuth2Client, scopes: Scopes,
    callback: (err: Error, auth?: OAuth2Client) => void) {
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
      if (err) return callback(err);
      oAuth2Client.setCredentials(token);
      // Store the token to disk for later program executions
      writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
        if (err) console.error(err);
        console.log('Token stored to', TOKEN_PATH);
      });
      callback(null, oAuth2Client);
    });
  });
}

/** Small utility to nicely print an error returned from GoogleSheets */
function printGoogleAuthError(err) {
  console.error('Error authorizing Google Sheets client:');
  console.error(err.code + ' ' + err.response.statusText)
  console.error(err.stack);
}
