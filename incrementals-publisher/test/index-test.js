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
    it('should run without any parameters', () => {
      fun(ctx, {});
      assertCalledDone(ctx);
    });

    it('should return a 400', () => {
      fun(ctx, {});
      assert.equal(ctx.res.status, 400);
      assertCalledDone(ctx);
    });
  });

  describe('with a valid payload', () => {
    let data = {
      build_url: 'https://ci.jenkins.io/job/structs-plugin/job/PR-36/3/'
    };

    it('should return a 201 on success', () => {
      fun(ctx, data);
      assertCalledDone(ctx);
      assert.equal(ctx.res.status, 201);
    });
  });
});
