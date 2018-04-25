const assert = require('assert');
const simple = require('simple-mock');
const fun    = require('../index.js');

describe('Handling incremental publisher webhook events', () => {
  let ctx = {};
  let data = {
    body: {}
  };
  let run = () => {
    ctx.res = {};
    fun(ctx, data).catch(err => console.log('Caught', err));
  };

  beforeEach(() => {
      ctx.log = simple.mock();
      simple.mock(ctx.log, 'info', (...args) => console.log('[INFO]', args));
      simple.mock(ctx.log, 'error', (...args) => console.log('[ERROR]', args));
  });
  afterEach(() => { simple.restore() });

  describe('without parameters', () => {
    it('should require a parameter', () => {
      run();
      assert.equal(ctx.res.status, 400);
      assert.equal(ctx.res.body, 'The incrementals-publisher invocation was missing the build_url attribute');
    });
  });

  describe('without a build_url matching JENKINS_HOST', () => {
    it('should return a 400', () => {
      data.body.build_url = 'https://example.com/foo/bar';
      run();
      assert.equal(ctx.res.status, 400);
      assert.equal(ctx.res.body, 'This build_url is not supported');
    });
  });

  describe('with a weird build_url', () => {
    it('should return a 400', () => {
      data.body.build_url = 'https://ci.jenkins.io/junk/';
      run();
      assert.equal(ctx.res.status, 400);
      assert.equal(ctx.res.body, 'This build_url is malformed');
    });
  });
});
