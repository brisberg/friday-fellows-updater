import 'mocha';

import {expect} from 'chai';

import {AnimeModel, MalAnimeModel, MalMyAnimeRecord} from '../types/chinmei';

import {
  convertMalAnimeModel,
  daysBetween,
  formatMalDate,
  generateSeasonTag,
  normalizeAnimePayload,
  ParsedCellInfo,
  parseVoteCell,
  promisify,
} from './utils';

describe('promisify function', () => {
  it('should return a promise to resolves when the call succeeds', () => {
    const fn = (params, callback) => {
      return callback(null, {'foo': 'bar'});
    };
    promisify(fn, {}).then((res) => {
      expect(res).to.deep.equal({'foo': 'bar'});
    });
  });

  it('should return a promise to rejects when the call returns an error',
     () => {
       const fn = (params, callback) => {
         return callback('foo error', null);
       };
       promisify(fn, {}).catch((err) => {
         expect(err).to.equal('foo error');
       });
     });

  it('should return a promise that passes params object to the wrapped call',
     () => {
       const mockParams = {foo: 'bar'};
       const fn = (params, callback) => {
         expect(params).to.equal(mockParams);
       };

       promisify(fn, mockParams);
     });
});

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
      title: 'foo',
      new: true,
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

  it('should clear identical properties except id, title, and new', () => {
    record.series_animedb_id = model.id + '';
    record.my_watched_episodes = model.episode + '';
    record.my_start_date = model.date_start;
    record.my_finish_date = model.date_finish;
    record.my_score = model.score + '';
    record.my_status = model.status + '';
    record.my_tags = model.tags;
    const result = normalizeAnimePayload(model, record);

    expect(result).to.deep.equal({id: 12345, title: 'foo', new: true});
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

describe('parseVoteCell function', () => {
  const cellValue = 'Ep. 01: 3 to 4';
  const expected: ParsedCellInfo = {
    weekIndex: 1,
    episode: 1,
    votesFor: 3,
    votesAgainst: 4,
  };

  it('should include the weekIndex in the result', () => {
    const result = parseVoteCell(5, cellValue);

    expect(result.weekIndex).to.equal(5);
  });

  it('should parse the value of a cell', () => {
    const result = parseVoteCell(1, cellValue);

    expect(result).to.deep.equal(expected);
  });

  it('should produce NaN for for episode if it cannot be parsed', () => {
    const invalidEpisode = 'Ep. ZZ: 3 to 4';

    const result = parseVoteCell(1, invalidEpisode);

    expect(Number.isNaN(result.episode), 'Episode should be NaN');
  });

  it('should produce NaN for for votesFor if it cannot be parsed', () => {
    const invalidVotesFor = 'Ep. 01: ZZ to 4';

    const result = parseVoteCell(1, invalidVotesFor);

    expect(Number.isNaN(result.votesFor), 'VotesFor should be NaN');
  });

  it('should produce NaN for for votesAgainst if it cannot be parsed', () => {
    const invalidVotesAgainst = 'Ep. 01: 3 to ZZ';

    const result = parseVoteCell(1, invalidVotesAgainst);

    expect(Number.isNaN(result.votesAgainst), 'VotesAgainst should be NaN');
  });
});
