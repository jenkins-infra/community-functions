'use strict';

const fs = require('fs');
const Evergreen = require('../lib/evergreen');

describe('Evergreen backend integration', () => {
  beforeEach(() => {
    this.payload = JSON.parse(fs.readFileSync('./test/fixtures/webhook.payload.json'));
  });

  describe('parseTaintedFrom()', () => {
    it('should parse the right message out', () => {
      const r = Evergreen.parseTaintedFrom("Lower log level from error to debug\n\nTaint: d8aaee640ebdb2255c77f7795a6f90c79176f8c6\n\nTest");
      expect(r).toEqual('d8aaee640ebdb2255c77f7795a6f90c79176f8c6');
    });
    it('should return null when the message does not match', () => {
      const r = Evergreen.parseTaintedFrom('This is a normal commit!');
      expect(r).toBeFalsy();
    });
  });

  describe('findRelevantCommits()', () => {
    it('should find commits with essentials.yaml modified', () => {
      const commits = Evergreen.findRelevantCommits(this.payload);
      expect(commits).toHaveLength(1);
      expect(commits[0]).toEqual('d8aaee640ebdb2255c77f7795a6f90c79176f8c6');
    });
  });
});
