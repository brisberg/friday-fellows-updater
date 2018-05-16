import 'mocha';

import {expect} from 'chai';

import {formatMalDate} from './utils';

describe('formatMalDate function', () => {
  it('should return a formatted date', () => {
    const result = formatMalDate(new Date(2014, 0, 4));
    expect(result).to.equal('2014-01-04');
  });
});
