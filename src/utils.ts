import {AnimeModel, MalMyAnimeRecord} from '../types/chinmei';

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
    animePayload: AnimeModel, animeRecord: MalMyAnimeRecord): AnimeModel {
  const result: AnimeModel = {id: animePayload.id};
  if (animePayload.id !== parseInt(animeRecord.series_animedb_id)) {
    throw new Error(
        'Somehow payload and record have different anime ids. Skipping');
  }
  if (animePayload.episode !== parseInt(animeRecord.my_watched_episodes)) {
    result.episode = animePayload.episode;
  }
  if (animePayload.status !== parseInt(animeRecord.my_status)) {
    result.status = animePayload.status;
  }
  if (animePayload.score !== parseInt(animeRecord.my_score)) {
    result.score = animePayload.score;
  }
  if (animePayload.date_start !== animeRecord.my_start_date) {
    result.date_start = animePayload.date_start;
  }
  if (animePayload.date_finish !== animeRecord.my_finish_date) {
    result.date_finish = animePayload.date_finish;
  }
  if (animePayload.tags !== animeRecord.my_tags) {
    result.tags = animePayload.tags;
  }
  return result;
}
