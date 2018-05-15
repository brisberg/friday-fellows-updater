// const http = require('http');
//
// const hostname = '127.0.0.1';
// const port = 3000;

import * as fs from 'fs';
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly'];
import {initializeGoogleClient} from './google.auth.js';

import * as Chinmei from 'chinmei';
import {
  AnimeModel,
  GetMalUserResponse,
  MalAnimeModel,
  MalMyAnimeRecord,
} from '../types/chinmei';
import {AxiosResponse} from 'axios';
const MAL_CRED_PATH = 'mal_credentials.json';

enum STATUS {
  WATCHING = 1,
  COMPLETED = 2,
  ONHOLD = 3,
  DROPPED = 4,
  PLANTOWATCH = 6,
}

// Mapping of season name to starting month (Jan, Api, Jul, Oct).
// const SEASON = {
//     WINTER: 1,
//     SPRING: 4,
//     SUMMER: 7,
//     FALL: 10,
// }

/**
 * Main runner
 */
async function main() {
  let sheets; // Api Clients
  let mal;

  try {
    sheets = await initializeGoogleClient(SCOPES);
    mal = await initializeChinmeiClient(MAL_CRED_PATH);
  } catch (err) {
    console.log('Initialization error: ' + err);
    process.exit(1);
  }

  console.log('Accessing MAL for user FridayFellows');
  const listFetchP =
      mal.getMalUser('FridayFellows', 1, 'all')
          .then((res: GetMalUserResponse) => {
            console.log(
                'Fetched AnimeList, ' + res.anime.length + ' series found.');
            return res.anime;
          })
          .catch((err) => {
            console.error('Failed to fetch from MyAnimeList');
            throw err;
          });


  let animeList = await listFetchP;
  const malRecords = new Map<string, MalMyAnimeRecord>();
  const ongoing = new Map<string, AnimeModel>();
  animeList.forEach((record: MalMyAnimeRecord) => {
    malRecords.set(record.series_title, record);
  });
  console.log('Got all the results');
  console.log('List length: ' + animeList.length);

  // WIP hardcoded list of seasons
  const seasons = ['FALL 2013', 'WINTER 2014', 'SPRING 2014'];
  const seasonStartDates =
      [new Date(2013, 8, 27), new Date(2014, 0, 10), new Date(2014, 3, 11)];
  seasons.forEach(async (season: string, index: number) => {
    const seasonStartDate = seasonStartDates[index];
    const seasonTag = generateSeasonTag(season);

    // debug settings
    const daysInASeason = 7 * 13; // thirteen weeks in a season

    const seasonFinished = daysBetween(seasonStartDate, new Date()) > (7 * 13);
    const seasonEndDate = new Date(seasonStartDate);
    seasonEndDate.setDate(seasonStartDate.getDate() + daysInASeason);

    const votingRows =
        await promisify(sheets.spreadsheets.values.get, {
          spreadsheetId: '1uKWMRmtN5R0Lf3iNMVmwenZCNeDntGRK7is6Jl8wi6M',
          majorDimension: 'ROWS',
          range: '\'' + season + '\'!A2:K30',
        })
            .then((res: AxiosResponse) => {
              const rows = res.data.values;
              if (rows.length === 0) {
                console.log('No data found in sheet');
                return;
              } else {
                return rows;
              }
            })
            .catch((e) => {
              console.error('GoogleSheets API returned an error.');
              throw e;
            });

    console.log('Voting results for ' + votingRows.length + ' series');

    // Do the processing for the season
    votingRows.forEach(async (row) => {
      // let newAnime = false; // flag indicating we should add a new show
      let title = row[0];
      const record: MalMyAnimeRecord =
          await getMalRecord(title, malRecords, mal);
      const result: AnimeModel = {id: parseInt(record.series_animedb_id)};
      let rowLastVote: ParsedCellInfo;

      if (record) {
        if (!record.my_tags.includes(seasonTag)) {
          result.tags =
              record.my_tags ? seasonTag + ', ' + record.my_tags : seasonTag;
        }

        const episode1Index = row.findIndex((cell) => {
          return cell.startsWith('Ep. 01');
        });
        if (episode1Index !== -1) {
          // Set the start date as the week we saw episode 1
          const startDate = new Date(seasonStartDate.getTime());
          startDate.setDate(startDate.getDate() + (7 * (episode1Index - 1)));
          result.date_start = formatMalDate(startDate);
          result.status = STATUS.WATCHING;
        }

        let endIndex = row.length - 1;
        for (; endIndex >= 1; endIndex--) {
          if (row[endIndex].startsWith('Ep. ')) {
            break;
          }
        }
        // TODO: do a try here to catch poorly formatted cells?
        rowLastVote = parseVoteCell(endIndex, row[endIndex]);

        console.log(
            title + ' Ep. ' + rowLastVote.episode + ' ' + rowLastVote.votesFor +
            '-' + rowLastVote.votesAgainst);

        if (rowLastVote.votesFor < rowLastVote.votesAgainst) {
          // Anime lost, so this was the last episode we saw
          result.status = STATUS.DROPPED;
          result.episode = rowLastVote.episode;
        } else {
          // Show passed
          if (seasonFinished) {
            // Season is over, and the anime survived
            if (ongoing.get(record.series_animedb_id)) {
              // Series was on going
              if (ongoing.get(record.series_animedb_id).episode + 13 >
                  parseInt(record.series_episodes)) {
                // Series is finished
                result.episode = parseInt(record.series_episodes);
                const endDate = new Date(seasonStartDate.getTime());
                endDate.setDate(
                    endDate.getDate() +
                    (7 *
                     (parseInt(record.series_episodes) -
                      ongoing.get(record.series_animedb_id).episode)));
                result.date_finish = formatMalDate(endDate);
                result.status = STATUS.COMPLETED;
              } else {
                result.episode =
                    ongoing.get(record.series_animedb_id).episode + 13;
                ongoing.set(record.series_animedb_id, result);
              }
            } else {
              // First time we have seen this series, series is ended
              result.episode = parseInt(record.series_episodes);
              const endDate = new Date(seasonStartDate.getTime());
              endDate.setDate(
                  endDate.getDate() +
                  (7 * (parseInt(record.series_episodes) + episode1Index - 1)));
              result.date_finish = formatMalDate(endDate);
              result.status = STATUS.COMPLETED;
            }
          } else {
            // This is the current season
            // current season and show is continuing
            if (row[row.length - 1] === 'BYE') {
              // last records are BYE weeks, so use the last known vote
              result.episode = rowLastVote.episode;
              result.status = STATUS.WATCHING;
            } else {
              // last record is a successful vote.
              const weeksOfSeason: number = daysBetween(
                  seasonStartDate,
                  new Date()); // maybe add a day to give time for update?
              result.episode =
                  rowLastVote.episode + (weeksOfSeason - rowLastVote.weekIndex);
              if (result.episode >= parseInt(record.series_episodes)) {
                result.episode = parseInt(record.series_episodes);
                result.status = STATUS.COMPLETED;
              } else {
                result.status = STATUS.WATCHING;
              }
            }
          }
        }

        // console.log(result);
        // console.log(record);
        try {
          normalizeAnimePayload(result, record);
          console.log(result);

          if (Object.keys(result).length > 1) {
            // if (newAnime) await mal.addAnime(animePayload)
            // else await mal.updateAnime(animePayload)
          }
        } catch (err) {
          console.error(err);
        }
      }
    });
  });
}

/**
 * @param {Date} start
 * @param {Date} end
 * @return {number} Whole number days that elapsed between start and end.
 */
function daysBetween(start, end) {
  console.log(start, end);
  const oneDay = 1000 * 60 * 60 * 24;
  const startMs = start.getTime();
  const endMs = end.getTime();
  const differenceMs = endMs - startMs;
  return Math.round(differenceMs / oneDay);
}

/**
 * @param {string} title Title of anime to search for
 * @param {Map<string, MalMyAnimeRecord>} malRecords Map of known records
 * @param {Chinmei} mal Mal API client
 * @return {MalMyAnimeRecord} Found record or undefined
 */
async function getMalRecord(
    title: string, malRecords: Map<string, MalMyAnimeRecord>,
    mal: Chinmei): Promise<MalMyAnimeRecord> {
  if (malRecords.has(title)) {
    return Promise.resolve(malRecords.get(title));
  } else {
    // If found, add the new show with the specified episode count
    return mal.searchSingleAnime(title)
        .then((res: MalAnimeModel) => {
          // newAnime = true;
          return convertMalAnimeModel(res);
        })
        .catch((err) => {
          // If not found, log an error
          console.log('No record or MAL listing found for ' + title);
          // TODO: Log missing to missing list
        });
  }
}

/**
 * @param {string} season Season name to parse ex. 'WINTER 2014'
 * @return {string} Parsed season tag, ex. 'Winter 2014'
 */
function generateSeasonTag(season: string): string {
  return season.toLowerCase()
      .split(' ')
      .map(function(word) {
        return (word.charAt(0).toUpperCase() + word.slice(1));
      })
      .join(' ');
}

/**
 * @param {Date} date
 * @return {string} Date formatted as '2018-05-10'
 */
function formatMalDate(date: Date) {
  return date.getFullYear() + '-' + getMonth(date) + '-' + getDate(date);
}

/**
 * @param {Date} date
 * @return {string} Month formatted as a numerical string
 */
function getMonth(date: Date) {
  const month = date.getMonth() + 1;
  return month < 10 ? '0' + month :
                      '' + month; // ('' + month) for string result
}

/**
 * @param {Date} date
 * @return {string} Day of the month formatted as a string
 */
function getDate(date: Date) {
  const day = date.getDate();
  return day < 10 ? '0' + day : '' + day; // ('' + day) for string result
}


/**
 *  Removes field from the payload which are already recorded in the record.
 *  @param {AnimeModel} animePayload Model to be deduped.
 *  @param {MalMyAnimeRecord} animeRecord Record from Mal to compare against.
 */
function normalizeAnimePayload(
    animePayload: AnimeModel, animeRecord: MalMyAnimeRecord) {
  if (animePayload.id !== parseInt(animeRecord.series_animedb_id)) {
    throw new Error(
        'Somehow payload and record have different anime ids. Skipping');
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

export interface ParsedCellInfo {
  weekIndex: number;
  episode: number;
  votesFor: number;
  votesAgainst: number;
}

/**
 * @param {number} index column index of this cell
 * @param {string} value string of the form "Ep. <epNum>: <votesFor> to
 * <votesAgainst>" to parse into
 * its variable parts.
 * @return {ParsedCellInfo} Wrapper for episodes, votesFor and
 * VotesAgainst.
 */
function parseVoteCell(index: number, value: string): ParsedCellInfo {
  const parts = value.split(' ');
  const episode = parseInt(parts[1].slice(0, -1));
  const votesFor = parseInt(parts[2]);
  const votesAgainst = parseInt(parts[4]);
  return {weekIndex: index, episode, votesFor, votesAgainst};
}

// Main call
try {
  main();
} catch (err) {
  console.log(err);
}

/**
 * Used to convert google api calls into promises for use with await
 * @param {string} credPath path to Mal Credentials file.
 * @return {Chinmei} Authenticated Chinmei API Client
 */
function initializeChinmeiClient(credPath: string): Chinmei {
  return new Promise(async (resolve, reject) => {
    // Load mal credentials from a local file.
    fs.readFile(credPath, async (err, content) => {
      if (err) {
        console.log('Error loading MAL client credentials file:', err);
        reject(err);
      }
      // Authorize a client with credentials, then verify with MAL api.
      const {username, password} = JSON.parse(content.toString());

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
 * Converts a MalAnimeModel to a MalMyAnimeRecord
 * @param {MalAnimeModel} model Model returned from searchSingleAnime()
 * @return {MalMyAnimeRecord} converted Record
 */
function convertMalAnimeModel(model: MalAnimeModel): MalMyAnimeRecord {
  return {
    series_animedb_id: model.id,
    series_title: model.title,
    series_synonyms: model.synonyms,
    series_episodes: model.episodes,
    series_status: model.status,
    series_start: model.start_date,
    series_end: model.end_date,
    series_image: model.image,
    my_id: '',
    my_watched_episodes: '',
    my_start_date: '',
    my_finish_date: '',
    my_score: '',
    my_status: '',
    my_rewatching_ep: '',
    my_last_updated: '',
    my_tags: '',
  };
}

/**
 * Used to convert google api calls into promises for use with await
 * @param {function} fn function to wrap in promise.
 * @param {Object} params parameters to pass to the wrapped function.
 * @return {Promise} promise wrapping the function
 */
function promisify(fn: Function, params: any) {
  return new Promise((resolve, reject) => {
    fn(params, (err, res) => {
      if (err) reject(err);
      resolve(res);
    });
  });
}
