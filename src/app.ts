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
import {
  formatMalDate,
  daysBetween,
  convertMalAnimeModel,
  generateSeasonTag,
  normalizeAnimePayload,
  parseVoteCell,
  ParsedCellInfo,
  promisify,
} from './utils';
const MAL_CRED_PATH = 'mal_credentials.json';

enum STATUS {
  WATCHING = 1,
  COMPLETED = 2,
  ONHOLD = 3,
  DROPPED = 4,
  PLANTOWATCH = 6,
}

export interface AnimeError {
  title: string;
  season: string;
  row: number;
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
  const results = new Map<number, AnimeModel>();
  const errors: AnimeError[] = [];
  animeList.forEach((record: MalMyAnimeRecord) => {
    malRecords.set(record.series_title, record);
  });
  console.log('Got all the results');
  console.log('List length: ' + animeList.length);

  // WIP hardcoded list of seasons
  const seasons: Array<[string, Date]> = [
    ['FALL 2013', new Date(2013, 8, 27)],
    ['WINTER 2014', new Date(2014, 0, 10)],
    ['SPRING 2014', new Date(2014, 3, 11)],
  ];
  for (let seasonTuple of seasons) {
    const season: string = seasonTuple[0];
    console.log('Starting processing ' + season);
    const seasonStartDate: Date = seasonTuple[1];
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
    for (const [index, row] of votingRows.entries()) {
      // let newAnime = false; // flag indicating we should add a new show
      let title = row[0];
      const record: MalMyAnimeRecord =
          await getMalRecord(title, malRecords, mal);

      if (!record) {
        errors.push({
          title,
          season,
          row: index,
        });
      } else {
        const result: AnimeModel = {id: parseInt(record.series_animedb_id)};
        let rowLastVote: ParsedCellInfo;

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
            console.log('season finished');
            console.log(ongoing.get(record.series_animedb_id));
            if (ongoing.get(record.series_animedb_id)) {
              // Series was on going
              if (ongoing.get(record.series_animedb_id).episode + 13 >=
                  parseInt(record.series_episodes)) {
                // Series is finished
                // console.log(
                //     title + ' ongoing series finished. Recorded episode: ' +
                //     ongoing.get(record.series_animedb_id).episode);
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
                // console.log(
                //     title + 'ongoing series continuing' + result.episode);
              }
            } else {
              // First time we have seen this series, series is ended
              // console.log(record);
              const seriesEpisodes = parseInt(record.series_episodes);
              // console.log(
              //     title +
              //     ' first time seen, series is ended, ep:' + seriesEpisodes);
              if (seriesEpisodes <= 13) {
                result.episode = seriesEpisodes;
                const endDate = new Date(seasonStartDate.getTime());
                endDate.setDate(
                    endDate.getDate() +
                    (7 * (seriesEpisodes + episode1Index - 1)));
                result.date_finish = formatMalDate(endDate);
                result.status = STATUS.COMPLETED;
              } else {
                result.episode = 13;
                result.status = STATUS.WATCHING;
                // console.log('setting ongoing record for ' + title);
                ongoing.set(record.series_animedb_id, result);
              }
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
        const final = normalizeAnimePayload(result, record);
        console.log(final);

        if (Object.keys(final).length > 1) {
          // if (newAnime) await mal.addAnime(animePayload)
          // else await mal.updateAnime(animePayload)
          results.set(final.id, final);
        }
      }
    }
  }

  console.log('results: ');
  console.log(results);
  console.log('errors: ');
  console.log(errors);
}

/**
 * @param {string} title Title of anime to search for
 * @param {Map<string, MalMyAnimeRecord>} malRecords Map of known records
 * @param {Chinmei} mal Mal API client
 * @return {MalMyAnimeRecord} Found record or undefined
 */
async function getMalRecord(
    title: string, malRecords: Map<string, MalMyAnimeRecord>,
    mal: Chinmei): Promise<MalMyAnimeRecord|null> {
  if (malRecords.has(title)) {
    return Promise.resolve(malRecords.get(title));
  } else {
    // If found, add the new show with the specified episode count
    return mal.searchSingleAnime(title)
        .then((res: MalAnimeModel) => {
          if (res.title === title) {
            return convertMalAnimeModel(res);
          } else {
            return null;
          }
        })
        .catch((err) => {
          // If not found, log an error
          console.log('No record or MAL listing found for ' + title);
          return null;
        });
  }
}

// Main call
try {
  main();
} catch (err) {
  console.log(err);
}

/**
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
