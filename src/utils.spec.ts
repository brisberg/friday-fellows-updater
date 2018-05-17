import 'mocha';

import {expect} from 'chai';

import {daysBetween, formatMalDate} from './utils';

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
