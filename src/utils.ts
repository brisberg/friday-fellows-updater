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
