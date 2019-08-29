// import {AnimeModel, MalAnimeModel, MalMyAnimeRecord} from 'chinmei';

/**
 * Used to convert google api calls into promises for use with await
 * @param {function} fn function to wrap in promise.
 * @param {Object} params parameters to pass to the wrapped function.
 * @return {Promise} promise wrapping the function
 */
export function promisify(fn: Function, params: any) {
  return new Promise((resolve, reject) => {
    fn(params, (err, res) => {
      if (err) reject(err);
      resolve(res);
    });
  });
}

/**
 * @param {Date} date
 * @return {string} Date formatted as '2018-05-10'
 */
export function formatMalDate(date: Date) {
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
 * @param {Date} start
 * @param {Date} end
 * @return {number} Whole number days that elapsed between start and end.
 */
export function daysBetween(start, end) {
  const oneDay = 1000 * 60 * 60 * 24;
  const startMs = start.getTime();
  const endMs = end.getTime();
  const differenceMs = endMs - startMs;
  return Math.round(differenceMs / oneDay);
}

/**
 * @param {string} season Season name to parse ex. 'WINTER 2014'
 * @return {string} Parsed season tag, ex. 'Winter 2014'
 */
export function generateSeasonTag(season: string): string {
  return season.toLowerCase()
      .split(' ')
      .map(function(word) {
        return (word.charAt(0).toUpperCase() + word.slice(1));
      })
      .join(' ');
}

/**
 *  Removes field from the payload which are already recorded in the record.
 *  @param {AnimeModel} animePayload Model to be deduped.
 *  @param {MalMyAnimeRecord} animeRecord Record from Mal to compare against.
 *  @return {AnimeModel} Resulting de-duped model
 */
export function normalizeAnimePayload(
    animePayload: Chinmei.AnimeModel, animeRecord: Chinmei.MalMyAnimeRecord): Chinmei.AnimeModel {
  const result: Chinmei.AnimeModel = {id: animePayload.id, title: animePayload.title};
  if (animePayload.id !== parseInt(animeRecord.series_animedb_id)) {
    throw new Error(
        'Somehow payload and record have different anime ids. Skipping');
  }
  if (animePayload.new) {
    result.new = animePayload.new;
  }
  if (animePayload.episode &&
      animePayload.episode !== parseInt(animeRecord.my_watched_episodes)) {
    result.episode = animePayload.episode;
  }
  if (animePayload.status &&
      animePayload.status !== parseInt(animeRecord.my_status)) {
    result.status = animePayload.status;
  }
  if (animePayload.score &&
      animePayload.score !== parseInt(animeRecord.my_score)) {
    result.score = animePayload.score;
  }
  if (animePayload.date_start &&
      animePayload.date_start !== animeRecord.my_start_date) {
    result.date_start = animePayload.date_start;
  }
  if (animePayload.date_finish &&
      animePayload.date_finish !== animeRecord.my_finish_date) {
    result.date_finish = animePayload.date_finish;
  }
  if (animePayload.tags && animePayload.tags !== animeRecord.my_tags) {
    result.tags = animePayload.tags;
  }
  return result;
}

/**
 * Converts a MalAnimeModel to a MalMyAnimeRecord
 * @param {MalAnimeModel} model Model returned from searchSingleAnime()
 * @return {MalMyAnimeRecord} converted Record
 */
export function convertMalAnimeModel(model: Chinmei.MalAnimeModel): Chinmei.MalMyAnimeRecord {
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
export function parseVoteCell(index: number, value: string): ParsedCellInfo {
  const parts = value.split(' ');
  const episode = parseInt(parts[1].slice(0, -1));
  const votesFor = parseInt(parts[2]);
  const votesAgainst = parseInt(parts[4]);
  return {weekIndex: index, episode, votesFor, votesAgainst};
}
