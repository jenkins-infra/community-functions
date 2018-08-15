'use strict';

const fs = require('fs');
const Jenkins = require('../lib/jenkins');

describe('Jenkins integration', () => {
  const context = {
    log: () => { }
  };

  describe('commitFromData', () => {
    beforeEach(() => {
      this.j = new Jenkins(context);
    });
    it('should throw without data', () => {
      expect(() => {
        this.j.commitFromData(null);
      }).toThrow()
    });

    it('should throw without actions in the data', () => {
      expect(() => {
        this.j.commitFromData({});
      }).toThrow()
    });

    it('should throw without a BuildData action in the data', () => {
      expect(() => {
        this.j.commitFromData({
          'actions' : [
          ],
        });
      }).toThrow()
    });

    it('should return the commit when BuildData is present', () => {
      const data = JSON.parse(fs.readFileSync('./test/fixtures/commit.json'));
      expect(this.j.commitFromData(data)).toEqual('3b804b9f650da6f9b3035ebc3ae80db6367d9551');
    });
  });
});
