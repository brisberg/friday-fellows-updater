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
  season: string;
  date?: string;
  title?: string;
  row?: number;
}

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

  const seasons: string[] =
      await promisify(sheets.spreadsheets.get, {
        spreadsheetId: '1uKWMRmtN5R0Lf3iNMVmwenZCNeDntGRK7is6Jl8wi6M',
        fields: 'sheets.properties.title',
      })
          .then((res: AxiosResponse) => {
            return res.data.sheets.map((sheet) => sheet.properties.title)
                .reverse();
          })
          .catch((err) => {
            console.log('GoogleSheets API returned an error.');
            throw err;
          });

  for (let season of seasons) {
    console.log('Starting processing ' + season);
    const seasonTag = generateSeasonTag(season);

    const {votingRows, startDateString} =
        await promisify(sheets.spreadsheets.values.batchGet, {
          spreadsheetId: '1uKWMRmtN5R0Lf3iNMVmwenZCNeDntGRK7is6Jl8wi6M',
          majorDimension: 'ROWS',
          ranges: ['\'' + season + '\'!A2:K30', '\'' + season + '\'!B1:B1'],
        })
            .then((res: AxiosResponse) => {
              const votingRows = res.data.valueRanges[0].values;
              const startDateString = res.data.valueRanges[1].values[0];
              if (votingRows.length === 0) {
                console.log('No data found in sheet');
                return;
              } else {
                return {votingRows, startDateString};
              }
            })
            .catch((e) => {
              console.error('GoogleSheets API returned an error.');
              throw e;
            });

    console.log('Voting results for ' + votingRows.length + ' series');

    const startDateMs = Date.parse(startDateString);
    if (Number.isNaN(startDateMs)) {
      console.log(
          'Start date (' + startDateString + 'in cell B2 for ' + season +
          ' could not be parsed as a date.');
      errors.push({season, date: startDateString});
      continue;
    }
    const seasonStartDate = new Date(startDateMs);
    const seasonFinished = daysBetween(seasonStartDate, new Date()) > (7 * 13);

    // Do the processing for the season
    for (const [index, row] of votingRows.entries()) {
      // let newAnime = false; // flag indicating we should add a new show
      let title = row[0];
      const record: MalMyAnimeRecord =
          await getMalRecord(title, malRecords, mal);

      if (!record) {
        // Could not find record for anime, add to errors list
        errors.push({
          title,
          season,
          row: index,
        });
      } else {
        const result:
            AnimeModel = {id: parseInt(record.series_animedb_id), title};
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
            if (ongoing.get(record.series_animedb_id)) {
              // Series was on going
              const ongoingModel = ongoing.get(record.series_animedb_id);
              if (ongoingModel.episode + 13 >=
                  parseInt(record.series_episodes)) {
                // Series is finished
                result.episode = parseInt(record.series_episodes);
                const endDate = new Date(seasonStartDate.getTime());
                endDate.setDate(
                    endDate.getDate() +
                    (7 *
                     (parseInt(record.series_episodes) -
                      ongoingModel.episode)));
                result.date_finish = formatMalDate(endDate);
                result.status = STATUS.COMPLETED;
              } else {
                result.episode = ongoingModel.episode + 13;
                ongoing.set(
                    record.series_animedb_id, {...ongoingModel, ...result});
              }
            } else {
              // First time we have seen this series, series is ended
              const seriesEpisodes = parseInt(record.series_episodes);
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
                  new Date()); // TODO: maybe add a day to give time for update?
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

        const final = normalizeAnimePayload(result, record);
        console.log(final);

        if (Object.keys(final).length > 1) {
          results.set(final.id, final);
        }
      }
    }
  }

  console.log('results: ');
  console.log(results);
  const resultsFile = 'logs/' + formatMalDate(new Date()) + '-results.json';
  fs.writeFile(
      resultsFile, JSON.stringify(Array.from(results.values())), (err) => {
        if (err) throw err;

        console.log('Results writted to ' + resultsFile);
      });
  console.log('errors: ');
  console.log(errors);
  const errorsFile = 'logs/' + formatMalDate(new Date()) + '-errors.json';
  fs.writeFile(errorsFile, JSON.stringify(errors), (err) => {
    if (err) throw err;

    console.log('Results writted to ' + errorsFile);
  });

  // for (const model of results) {
  //   // TODO bring back the newAnime flag
  //   await mal.updateAnime(model);
  // }
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
