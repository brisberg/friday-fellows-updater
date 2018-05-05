// const http = require('http');
//
// const hostname = '127.0.0.1';
// const port = 3000;

const fs = require('fs');
const readline = require('readline');
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly'];
const {initializeGoogleClient} = require('./google.auth.js');

const Chinmei = require('chinmei');
const MAL_CRED_PATH = 'mal_credentials.json';

async function main() {
    const {sheets, auth} = await initializeGoogleClient(SCOPES);
    loadingVotingSheet(sheets, auth)
    let mal;
    try {
        mal = new Chinmei('FridayFellows', '<PASS>');\
        await mal.verifyAuth();
    } catch (err) {
        console.log(err);\
        process.exit(1);
    }
    console.log('Accessing MAL for user FridayFellows');
    const animeList = (await mal.getMalUser('FridayFellows', 1, 'all')).anime;
    console.log('Fetched AnimeList, ' + animeList.length + ' series found.')
}

try {
    main();
}
catch (err) {
    console.log(err);
}

/**
 * Reads data from the voting sheet.
 */
 function loadingVotingSheet(sheets, auth) {
     sheets.spreadsheets.values.get({
         auth: auth,
         spreadsheetId: '1HN0dYPEet-Zkx_9AQGCKDZGU8ygNmpymLT3y6szp0UY',
         majorDimension: 'COLUMNS',
         range: 'A2:B25',
     }, (err, res) => {
    if (err) {
      console.error('The API returned an error.');
      throw err;
    }
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
  });
 }

// let animeList;
//
// const fetchAnimeList = mal.getMalUser('FridayFellows', 1, 'all')
//     .then((res) => {
//         console.log('Fetched animelist for FridayFellows: ' +
//                     res.anime.length + 'series found');
//         animeList = res.anime;
//     })
//     .catch(err => console.log(err));

// myChinmei.searchAnimes('Gegege no Kitaro (2018)')
//     .then(res => console.log(res))
//     .catch(err => console.log(err));
//
// myChinmei.searchSingleAnime('Gegege no Kitaro (2018)')
//     .then(res => console.log(res))
//     .catch(err => console.log(err));

// const server = http.createServer((req, res) => {
//   res.statusCode = 200;
//   res.setHeader('Content-Type', 'text/plain');
//   res.end('Hello World\n');
// });
//
// server.listen(port, hostname, () => {
//   console.log(`Server running at http://${hostname}:${port}/`);
// });
