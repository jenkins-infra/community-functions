const assert = require('assert');
const simple = require('simple-mock');
const fun    = require('../index.js');

describe('Handling incremental publisher webhook events', () => {
  var ctx = simple.mock();
  beforeEach(() => {
      simple.mock(ctx, 'log', (...args) => { /* console.log(args); */ });
      simple.mock(ctx, 'done', () => {});
  });
  afterEach(() => { simple.restore() });

  let assertCalledDone = (context) => {
    assert(context.done.called);
  };

  describe('without parameters', () => {
    let data = {
      body: {}
    };
    it('should run without any parameters', () => {
      fun(ctx, data);
      assertCalledDone(ctx);
    });

    it('should return a 400', () => {
      fun(ctx, data);
      assert.equal(ctx.res.status, 400);
      assertCalledDone(ctx);
    });
  });
});
