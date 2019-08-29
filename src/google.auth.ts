import {ClientSecret, Scopes} from 'contrib/googleapis';
import {readFile, writeFile} from 'fs';
import {OAuth2Client} from 'google-auth-library';
import {Credentials} from 'google-auth-library/build/src/auth/credentials';
import {google} from 'googleapis';
import {createInterface} from 'readline';

const TOKEN_PATH = 'credentials.json';

export function initializeGoogleClient(scopes: Scopes): Promise<OAuth2Client> {
  return new Promise((resolve, reject) => {
    // Load client secrets from a local file.
    readFile('client_secret.json', (err, content: Buffer) => {
      if (err) {
        console.log('Error loading client secret file:', err);
        reject(err);
      }
      const secret: ClientSecret = JSON.parse(content.toString());
      // Authorize a client with credentials, then call the Google Drive API.
      authorize(secret, scopes, (err: Error, auth: OAuth2Client) => {
        if (err) reject(err.message);

        resolve(google.sheets({version: 'v4', auth}));
      });
    });
  });
}

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 * @param {ClientSecret} credentials The authorization client credentials.
 * @param {Scopes} scopes The scopes to request
 * @param {function} callback The callback to call with the authorized client or error.
 */
function authorize(
    credentials: ClientSecret, scopes: Scopes,
    callback: (err: Error, auth?: OAuth2Client) => void) {
  const {client_secret, client_id, redirect_uris} = credentials.installed;
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
