/**
 * Authentication library for GoogleSheets API. Modified from the Node
 * QuickStart sample on the Sheets Developer website.
 *
 * Handles the Oauth2 Flow for authenticating a GoogleClient.
 */

import {ClientSecret, Scopes} from 'contrib/googleapis';
import {readFile, writeFile} from 'fs';
import {OAuth2Client} from 'google-auth-library';
import {Credentials} from 'google-auth-library/build/src/auth/credentials';
import {google, sheets_v4} from 'googleapis';
import {createInterface} from 'readline';
import {promisify} from 'util';

import {SECRET_PATH, TOKEN_PATH} from './config';

const readFileAsync = promisify(readFile);
const writeFileAsync = promisify(writeFile);

// Initialize and return an autenticated GoogleSheets Client
export async function initializeGoogleClient(scopes: Scopes):
    Promise<sheets_v4.Sheets> {
  // Load client secrets from a local file.
  let content: Buffer;
  try {
    content = await readFileAsync(SECRET_PATH)
  } catch (err) {
    console.error('Error loading client secret file:', err);
    return Promise.reject(err);
  };
  const secret: ClientSecret = JSON.parse((content as Buffer).toString());

  // Authorize a client with credentials, then call the Google Drive API.
  return await authorize(secret, scopes)
      .then((auth: OAuth2Client) => {
        return google.sheets({version: 'v4', auth});
      })
      .catch((err: Error) => {
        console.error('Error authorizing Google Sheets client:');
        printGoogleAuthError(err);
        return Promise.reject(err);
      });
};

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 * @param {ClientSecret} secret The authorization client secret.
 * @param {Scopes} scopes The scopes to request
 */
async function authorize(
    secret: ClientSecret, scopes: Scopes): Promise<OAuth2Client> {
  const {client_secret, client_id, redirect_uris} = secret.installed;
  const oAuth2Client =
      new OAuth2Client(client_id, client_secret, redirect_uris[0]);

  // Check if we have previously stored a token.
  await readFileAsync(TOKEN_PATH)
      .then((token) => {
        const credentials: Credentials = JSON.parse(token.toString());
        oAuth2Client.setCredentials(credentials);
      })
      .catch(() => {
        return getAccessToken(oAuth2Client, scopes);
      });

  return oAuth2Client;
};

function ask(prompt: string) {
  const rli = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise<string>((resolve) => {
    rli.question(prompt, (code) => {
      rli.close();
      resolve(code);
    });
  })
}

/**
 * Get and store new token after prompting for user authorization, then stores
 * the credentials inthe provided OAuth2 client and writes the token to disk for
 * future invocations.
 * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
 * @param {Scopes} scopes The scopes to request
 */
async function getAccessToken(oAuth2Client: OAuth2Client, scopes: Scopes) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
  });
  console.log('Authorize this app by visiting this url:', authUrl);

  await ask('Enter the code from that page here: ').then((code) => {
    return oAuth2Client.getToken(code).then(async (res) => {
      // Store the token to disk for later program executions
      await writeFileAsync(TOKEN_PATH, JSON.stringify(res.tokens))
          .then(() => {
            console.log('Token stored to', TOKEN_PATH);
          })
          .catch((err) => {
            console.warn('Warning: Failed to write token to disk.');
            if (err) console.error(err);
          });

      oAuth2Client.setCredentials(res.tokens);
    });
  });
}

/** Small utility to nicely print an error returned from GoogleSheets */
export function printGoogleAuthError(err) {
  console.error(err.code + ' ' + err.response.statusText)
  console.error(err.stack);
}
