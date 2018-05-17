import * as fs from 'fs';
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly'];
import {initializeGoogleClient} from './google.auth';

import * as Chinmei from 'chinmei';
import {
  AnimeModel,
  MalAnimeModel,
  GetMalUserResponse,
  MalMyAnimeRecord,
} from '../types/chinmei';
import {AxiosResponse} from 'axios';
import {
  formatMalDate,
  daysBetween,
  generateSeasonTag,
  normalizeAnimePayload,
  parseVoteCell,
  ParsedCellInfo,
  promisify,
  convertMalAnimeModel,
} from './utils';
const MAL_CRED_PATH = 'mal_credentials.json';

enum STATUS {
  WATCHING = 1,
  COMPLETED = 2,
  ONHOLD = 3,
  DROPPED = 4,
  PLANTOWATCH = 6,
}

/**
 * Main runner
 */
export async function main() {
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
  const seasons: Array<[string, Date]> = [
    ['FALL 2013', new Date(2013, 8, 27)],
    ['WINTER 2014', new Date(2014, 0, 10)],
    ['SPRING 2014', new Date(2014, 3, 11)],
  ];
  for (let seasonTuple of seasons) {
    await processSeasonSheet(
        seasonTuple[0], seasonTuple[1], sheets, mal, ongoing, malRecords);
  }
}

/**
 * @param {string} seasonTitle Title of the season
 * @param {Date} seasonStartDate
 * @param {Sheets} sheets Authenticated google sheets api client
 * @param {Chinmei} mal Authenticated MAL api client
 * @param {Map<string, AnimeModel>} ongoing Map of known ongoing series
 * @param {Map<string, MalMyAnimeRecord>} malRecords Map of known records
 */
export async function processSeasonSheet(
    seasonTitle: string, seasonStartDate: Date, sheets, mal,
    ongoing: Map<string, AnimeModel>,
    malRecords: Map<string, MalMyAnimeRecord>) {
  console.log('Starting processing ' + seasonTitle);
  const seasonTag = generateSeasonTag(seasonTitle);

  const seasonFinished = daysBetween(seasonStartDate, new Date()) > (7 * 13);

  const votingRows =
      await promisify(sheets.spreadsheets.values.get, {
        spreadsheetId: '1uKWMRmtN5R0Lf3iNMVmwenZCNeDntGRK7is6Jl8wi6M',
        majorDimension: 'ROWS',
        range: '\'' + seasonTitle + '\'!A2:K30',
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
  for (let row of votingRows) {
    // let newAnime = false; // flag indicating we should add a new show
    let title = row[0];
    const record: MalMyAnimeRecord|null =
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
  }
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

// Main call
try {
  main();
} catch (err) {
  console.log(err);
}
