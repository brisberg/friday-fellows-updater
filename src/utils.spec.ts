import 'mocha';

import {expect} from 'chai';

import {AnimeModel, MalAnimeModel, MalMyAnimeRecord} from '../types/chinmei';

import {
  convertMalAnimeModel,
  daysBetween,
  formatMalDate,
  generateSeasonTag,
  normalizeAnimePayload,
} from './utils';

describe('formatMalDate function', () => {
  it('should return a formatted date', () => {
    const result = formatMalDate(new Date(2014, 0, 4));
    expect(result).to.equal('2014-01-04');
  });
});

describe('daysBetween function', () => {
  it('should calculate days between for sequential dates', () => {
    const days = daysBetween(new Date(2014, 0, 1), new Date(2014, 0, 10));
    expect(days).to.equal(9);
  });

  it('should calculate days between for reverse sequential dates', () => {
    const days = daysBetween(new Date(2014, 0, 10), new Date(2014, 0, 1));
    expect(days).to.equal(-9);
  });
});

describe('generateSeasonTag function', () => {
  it('should generate a season tag from a season name', () => {
    const tag = generateSeasonTag('SPRING 2014');
    expect(tag).to.equal('Spring 2014');
  });
});

describe('normalizeAnimePayload function', () => {
  let model: AnimeModel;
  let record: MalMyAnimeRecord;

  before(() => {
    model = {
      id: 12345,
      episode: 13,
      status: 1,
      score: 1,
      date_start: '2014-01-02',
      date_finish: '2014-04-05',
      tags: 'tag1',
    };
    record = {
      series_animedb_id: '12345',
      series_title: '',
      series_synonyms: '',
      series_episodes: '',
      series_status: '',
      series_start: '',
      series_end: '',
      series_image: '',
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
  });

  it('should retain all properties on model if record is empty', () => {
    const result = normalizeAnimePayload(model, record);

    expect(result).to.deep.equal(model);
  });

  it('should clear identical properties except id', () => {
    record.series_animedb_id = model.id + '';
    record.my_watched_episodes = model.episode + '';
    record.my_start_date = model.date_start;
    record.my_finish_date = model.date_finish;
    record.my_score = model.score + '';
    record.my_status = model.status + '';
    record.my_tags = model.tags;
    const result = normalizeAnimePayload(model, record);

    expect(result).to.deep.equal({id: 12345});
  });

  it('should error if the record and model have different ids', () => {
    record.series_animedb_id = 'foo';

    expect(() => normalizeAnimePayload(model, record))
        .to.throw(
            'Somehow payload and record have different anime ids. Skipping');
  });
});

describe('convertMalAnimeModel function', () => {
  let model: MalAnimeModel;

  before(() => {
    model = {
      id: '12345',
      title: 'foobar',
      english: 'barbaz',
      synonyms: 'foobaz',
      episodes: '13',
      score: '9',
      type: 'TV',
      status: 'Finished Airing',
      start_date: '2014-01-25',
      end_date: '2014-04-22',
      image: 'foo.png',
    };
  });

  it('should convert to a MalMyAnimeRecord', () => {
    const expected: MalMyAnimeRecord = {
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
    const result = convertMalAnimeModel(model);

    expect(result).to.deep.equal(expected);
  });
});
