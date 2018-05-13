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

const STATUS = {
    WATCHING: 1,
    COMPLETED: 2,
    ONHOLD: 3,
    DROPPED: 4,
    PLANTOWATCH: 6,
};

// Mapping of season name to starting month (Jan, Api, Jul, Oct).
// const SEASON = {
//     WINTER: 1,
//     SPRING: 4,
//     SUMMER: 7,
//     FALL: 10,
// }

async function main() {
    let sheets, mal; // API clients
    const season = 'WINTER 2014'
    const seasonTag = season.toLowerCase().split(' ').map(function(word) {
        return (word.charAt(0).toUpperCase() + word.slice(1));
      }).join(' ');

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
        range: '\'' + season + '\'!A2:K30',
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

    // const seasonStartDate = new Date();
    // const [seasonName, year] = season.split(' ');
    // seasonStartDate.setMonth(SEASON[seasonName]);
    // seasonStartDate.setYear(parseInt(year));
    // seasonStartDate.setDate(1);
    // const offset = (13 - seasonStartDate.getDay())%7; // Date of the first Friday of the month
    // seasonStartDate.setDate(offset);

    // console.log(seasonStartDate.getFullYear() + '-' + seasonStartDate.getMonth() + '-' + seasonStartDate.getDate());

    // debug settings
    const seasonStartDate = new Date(2014, 0, 10);
    const daysInASeason = 7 * 13; // thirteen weeks in a season

    const seasonFinished = daysBetween(seasonStartDate, new Date()) > (7 * 13);
    const seasonEndDate = new Date(seasonStartDate);
    seasonEndDate.setDate(seasonStartDate.getDate() + daysInASeason);

    // Do the processing for the season
    votingRows.forEach(async (row) => {
        let newAnime = false; // flag indicating we should add a new show
        let title = row[0];
        let animeRecord = animeList.find(record => record.series_title === title);

        if (!animeRecord) {
            // Add a new show
            // Search for the title
            try {
                // If found, add the new show with the specified episode count
                animeRecord = await map.searchSingleAnime(title);
                newAnime = true;
            }
            catch (err) {
                // If not found, log an error
                console.log('No record or MAL listing found for ' + title);
            }
            return;
        }

        const cours = Math.round(animeRecord.series_episodes / 13);
        if (cours > 1) {
            console.log(title + ' is a multi-cour series, skipping...');
            return;
        }

        const episode1Index = row.findIndex((cell) => {
            return cell.startsWith('Ep. 01');
        })
        let endIndex = row.length - 1;
        for ( ; endIndex >= 1; endIndex--) {
            if (row[endIndex].startsWith('Ep. ')) {
                break;
            }
        }

        let episode, votesFor, votesAgainst = 0;
        if (endIndex !== 0) {
            const lastCell = row[endIndex];
            ({episode, votesFor, votesAgainst} = parseVoteCell(lastCell));
        }

        console.log(title + " Ep. " + episode + " " + votesFor + "-" + votesAgainst);
        const animePayload = {
            id: animeRecord.series_animedb_id,
            episode: episode,
        };

        const currentDate = new Date();
        currentDate.setHours(0,0,0,0);
        const lastEpisodeDate = new Date(seasonStartDate);
        lastEpisodeDate.setDate(seasonStartDate.getDate() + (7 * (endIndex-1)));

        if (votesFor >= votesAgainst) {
            if (seasonFinished) {
                // Season is finished so update to end
                episode = animeRecord.series_episodes;
                animePayload.date_finish = formatMalDate(seasonEndDate);
            } else if (currentDate > lastEpisodeDate) {
                // Assume voting ended and the show continued

                // calculate real episode count past the date
                const daysSince = daysBetween(lastEpisodeDate, currentDate);
                // console.log(daysSince);
                // console.log(Math.round(daysSince/7));
                // console.log(Math.min(15 - endIndex, Math.round(daysSince/7)));
                let extraEpisodes = Math.round(daysSince/7);
                // const overDraft = (episode + extraEpisodes) - animeRecord.series_episodes;
                // if (overDraft > 0) {
                //     extraEpisodes -= overDraft;
                // }
                episode += extraEpisodes;
                endIndex += extraEpisodes;
                console.log('actual episode: ' + episode);
            }
        } else {
            animePayload.status = STATUS.DROPPED;
        }

        if (episode1Index !== -1) {
            // Set the start date as the week we saw episode 1
            const startDate = new Date(seasonStartDate.getTime());
            startDate.setDate(startDate.getDate() + (7 * (episode1Index-1)));
            animePayload.date_start = formatMalDate(startDate);
        }
        if (episode === parseInt(animeRecord.series_episodes)) {
            animePayload.status = STATUS.COMPLETED;
            // Add weeks since the first Friday of the season
            const endDate = new Date(seasonStartDate.getTime());
            endDate.setDate(endDate.getDate() + (7 * (endIndex-1)));
            animePayload.date_finish = formatMalDate(endDate);
        }
        if (!animeRecord.my_tags.includes(seasonTag)) {
            animePayload.tags = seasonTag + ', ' + animeRecord.my_tags;
        }

        console.log(animePayload);
        console.log(animeRecord);
        try {
            normalizeAnimePayload(animePayload, animeRecord);
            console.log(animePayload);

            if (Object.keys(animePayload).length > 1) {
                // if (newAnime) await mal.addAnime(animePayload)
                // else await mal.updateAnime(animePayload)
            }
        }
        catch (err) {
            console.error(err);
        }
    });
}

function daysBetween(date1, date2) {
    console.log(date1, date2);
    var one_day=1000*60*60*24;
    var date1_ms = date1.getTime();
    var date2_ms = date2.getTime();
    var difference_ms = date2_ms - date1_ms;
    return Math.round(difference_ms/one_day);
 }

function formatMalDate(date) {
    return date.getFullYear() + "-" + getMonth(date) + "-" + getDate(date);
}

function getMonth(date) {
  var month = date.getMonth() + 1;
  return month < 10 ? '0' + month : '' + month; // ('' + month) for string result
}

function getDate(date) {
  var date = date.getDate();
  return date < 10 ? '0' + date : '' + date; // ('' + month) for string result
}

function normalizeAnimePayload(animePayload, animeRecord) {
    if (animePayload.id !== animeRecord.series_animedb_id) {
        throw new Error('Somehow payload and record have different anime ids. Skipping');
    }
    if (animePayload.episode === parseInt(animeRecord.my_watched_episodes)) {
        delete animePayload.episode;
    }
    if (animePayload.status === parseInt(animeRecord.my_status)) {
        delete animePayload.status;
    }
    if (animePayload.score === parseInt(animeRecord.my_score)) {
        delete animePayload.score;
    }
    if (animePayload.date_start === animeRecord.my_start_date) {
        delete animePayload.date_start;
    }
    if (animePayload.date_finish === animeRecord.my_finish_date) {
        delete animePayload.date_finish;
    }
    if (animePayload.tags === animeRecord.my_tags) {
        delete animePayload.tags;
    }
}

/**
 * Parses a string of the form "Ep. <epNum>: <votesFor> to <votesAgainst>" into
 * its variable parts.
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
