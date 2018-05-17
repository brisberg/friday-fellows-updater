import 'mocha';

import {expect} from 'chai';
// import * as Chinmai from 'chinmai';
import * as sinon from 'sinon';

import {AnimeModel, MalMyAnimeRecord} from '../types/chinmei';

import {processSeasonSheet} from './app';

console.log(sinon);

describe('main updater function', () => {
  let sheets;
  let mal;
  let seasonTitle;
  let seasonStartDate;
  let ongoing: Map<string, AnimeModel>;
  let malRecords: Map<string, MalMyAnimeRecord>;

  before(() => {
    sheets = {spreadsheets: {values: {get: sinon.stub()}}};
    mal = {
      searchSingleAnime: sinon.stub(),
    };
    ongoing = new Map<string, AnimeModel>();
    malRecords = new Map<string, MalMyAnimeRecord>();
    seasonTitle = 'SPRING 2014';
    seasonStartDate = new Date(2014, 4, 1);
  });

  it('should set date_start if episode 1 is found', () => {
    sheets.spreadsheets.values.get.returns(
        null, ['Danganronpa', 'Ep. 01: 4 to 3']);
    mal.searchSingleAnime.returns({});
    const results = processSeasonSheet(
        seasonTitle, seasonStartDate, sheets, mal, ongoing, malRecords);

    expect(results[0].start_date.getTime()).to.equal(seasonStartDate.getTime());
  });

  describe('for a finished season', () => {
    seasonTitle = 'WINTER 2010';
    seasonStartDate = new Date(2010, 0, 1); // Far in the past

    // it('should return a COMPLETED anime model if there is no record', () => {
    //   const fn = (params, callback) => {
    //     return callback(null, {'foo': 'bar'});
    //   };
    //   promisify(fn, {}).then((res) => {
    //     expect(res).to.deep.equal({'foo': 'bar'});
    //   });
    // });
  });
});
