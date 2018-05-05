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
    let sheets, mal; // API clients

    try {
        sheets = await initializeGoogleClient(SCOPES);
        mal = await initializeChinmeiClient(MAL_CRED_PATH);
    } catch (err) {
        console.log('Initialization error: ' + err);
        process.exit(1);
    }
    console.log('Accessing MAL for user FridayFellows');
    const listFetchP = mal.getMalUser('FridayFellows', 1, 'all').then(res => {
        console.log('Fetched AnimeList, ' + res.anime.length + ' series found.')
        return res.anime;
    }).catch(err => {
        console.error('Failed to fetch from MyAnimeList');
        throw err;
    });
    const sheetsFetchP = promisify(sheets.spreadsheets.values.get, {
        spreadsheetId: '1HN0dYPEet-Zkx_9AQGCKDZGU8ygNmpymLT3y6szp0UY',
        majorDimension: 'ROWS',
        range: '\'SPRING 2014\'!A2:K30',
    }).then(res => {
        const rows = res.data.values;
        if (rows.length === 0) {
            console.log('No data found in sheet');
            return;
        } else {
            return rows;
        }
    }).catch(e => {
        console.error('GoogleSheets API returned an error.')
        throw err;
    });

    let [animeList, votingRows] = await Promise.all([
        listFetchP,
        sheetsFetchP,
    ])
    console.log('Got all the results')
    console.log('List length: ' + animeList.length);
    console.log('Voting results for ' + votingRows.length + ' series');

    // mal.updateAnime({
    //     id: 32979,
    //     episode: 4,
    // }).then((res) => console.log(res));

    // Do the processing
    votingRows.forEach((row) => {
        let title = row[0];
        const animeRecord = animeList.find(record => record.series_title === title);

        if (!animeRecord) {
            console.log('No record found for ' + title);
            // Add a new show
            // Search for the title
                // If found, add the new show with the specified episode count
                // If not found, log an error
            return;
        }

        let index = row.length-1;
        while (index >= 1 && row[index] === 'BYE') {
            index--;
        }
        let episode, votesFor, votesAgainst = 0;
        if (index !== 0) {
            const lastCell = row[index];
            ({episode, votesFor, votesAgainst} = parseVoteCell(lastCell));
        }

        console.log(title + " Ep. " + episode + " " + votesFor + "-" + votesAgainst);
        const animePayload = {
            id: animeRecord.series_animedb_id,
            episode: episode,
        };
        if (!animeRecord.my_tags.includes('SPRING 2014')) {
            animePayload.tags = 'SPRING 2014, ' + animeRecord.my_tags;
        }

        //await mal.updateAnime(animePayload);
    });
}

/**
 * Parses a string of the form "Ep. <epNum>: <votesFor> to <votesAgainst>" into
 * its variable values.
 */
function parseVoteCell(value) {
    const parts = value.split(' ');
    const episode = parseInt(parts[1].slice(0, -1));
    const votesFor = parseInt(parts[2]);
    const votesAgainst = parseInt(parts[4]);
    return {episode, votesFor, votesAgainst};
}

try {
    main();
}
catch (err) {
    console.log(err);
}

function initializeChinmeiClient(cred_path) {
    return new Promise(async (resolve, reject) => {
        // Load mal credentials from a local file.
        fs.readFile(cred_path, async (err, content) => {
            if (err) {
                console.log('Error loading MAL client credentials file:', err);
                reject(err);
            }
            // Authorize a client with credentials, then verify with MAL api.
            const {username, password} = JSON.parse(content);

            try {
                const mal = new Chinmei(username, password);
                await mal.verifyAuth();
                resolve(mal);
            } catch (err) {
                reject(err);
            }
        });
    });
}

/**
 * Used to convert google api calls into promises for use with await
 */
function promisify(fn, params) {
    return new Promise((resolve, reject) => {
        fn(params, (err, res) => {
            if (err) reject(err);
            resolve(res);
        });
    });
}
