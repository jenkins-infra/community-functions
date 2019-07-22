const assert      = require('assert');
const simple      = require('simple-mock');
const fetch       = require('node-fetch');
const path        = require('path');

const fun         = require('../index.js');
const permissions = require('../lib/permissions');

const urlResults = {
  'https://ci.jenkins.io/job/Plugins/job/gitlab-branch-source-plugin/view/change-requests/job/PR-7/4/api/json?tree=actions[revision[hash,pullHash]]': {
    status: 200,
    results: require('./fixtures-processBuildMetadata.json')
  },
  'https://ci.jenkins.io/job/Plugins/job/gitlab-branch-source-plugin/view/change-requests/job/PR-7/4/../../../api/json?tree=sources[source[repoOwner,repository]]': {
    status: 200,
    results: require('./fixtures-folderMetadataJSON.json')
  },
  'https://fake-repo.jenkins-ci.org/incrementals/io/jenkins/plugins/gitlab-branch-source/0.0.4-rc287.b56548afdc8b/gitlab-branch-source-0.0.4-rc287.b56548afdc8b.pom': {
    status: 404,
    results: 'Not found'
    //status: 200,
    //results: fs.readFileSync(path.resolve('./test/fixtures-good-pom.xml'))
  }
}

describe('Handling incremental publisher webhook events', () => {
  let ctx = {};
  let data = {
    body: {}
  };
  let run = () => {
    ctx.res = {};
    return fun(ctx, data).catch(err => console.log('Caught', err));
  };

  beforeEach(() => {
    ctx.log = simple.mock();
    simple.mock(ctx.log, 'info', (...args) => console.log('[INFO]', ...args));
    simple.mock(ctx.log, 'error', (...args) => console.log('[ERROR]', ...args));
    simple.mock(fun.IncrementalsPlugin.prototype, 'downloadFile', async () => path.resolve('./test/fixtures-good-archive.zip'));
    simple.mock(fun.IncrementalsPlugin.prototype.github, 'commitExists', async () => true );
    simple.mock(fun.IncrementalsPlugin.prototype.github, 'createStatus', async () => true );
    simple.mock(fun.IncrementalsPlugin.prototype, 'uploadToArtifactory', async () => { return {
      status: 200,
      statusText: 'Success'
    }; } );
    simple.mock(fun.IncrementalsPlugin.prototype, 'fetch', async (url, opts) => {
      if (!urlResults[url]) {
        console.warn("Mock URL is not found, fetching real url", url);
        return fetch(url, opts);
      }
      return {
        status: urlResults[url].status,
        json: () => urlResults[url].results
      };
    });
  });
  afterEach(() => { simple.restore() });

  describe('without parameters', () => {
    it('should require a parameter', async () => {
      await run();
      assert.equal(ctx.res.status, 400);
      assert.equal(ctx.res.body, 'The incrementals-publisher invocation was missing the build_url attribute');
    });
  });

  describe('without a build_url matching JENKINS_HOST', () => {
    it('should return a 400', async () => {
      data.body.build_url = 'https://example.com/foo/bar';
      await run();
      assert.equal(ctx.res.status, 400);
      assert.equal(ctx.res.body, 'This build_url is not supported');
    });
  });

  describe('with a weird build_url', () => {
    it('should return a 400', async () => {
      data.body.build_url = 'https://ci.jenkins.io/junk/';
      await run();
      assert.equal(ctx.res.status, 400);
      assert.equal(ctx.res.body, 'This build_url is malformed');
    });
  });

  describe('with a bogus build_url', () => {
    for (let u of [
        'https://ci.jenkins.io/job/hack?y/123/',
        'https://ci.jenkins.io/job/hack#y/123/',
        // There may be legitimate use cases for, say, %20, but validation might be tricky and YAGNI.
        'https://ci.jenkins.io/job/hack%79/123/',
        'https://ci.jenkins.io/job/../123/',
        'https://ci.jenkins.io/job/./123/',
        'https://ci.jenkins.io/job/ok/123//',
    ]) {
      it(u + ' should return a 400', async () => {
        data.body.build_url = u;
        await run();
        assert.equal(ctx.res.status, 400);
        assert.equal(ctx.res.body, 'This build_url is malformed');
      });
    }
  });
  describe('error verifying permissions', () => {
    beforeEach(() => {
      simple.mock(permissions, 'verify', () => {
        return new Promise(function(resolve, reject) {
          reject(new Error("This is my error"));
        });
      });
    });
    it('should output an error', async () => {
      data.body.build_url = 'https://ci.jenkins.io/job/Plugins/job/gitlab-branch-source-plugin/view/change-requests/job/PR-7/4/';
      await run();
      assert.equal(ctx.res.body, 'Invalid archive retrieved from Jenkins, perhaps the plugin is not properly incrementalized?\nError: This is my error from https://ci.jenkins.io/job/Plugins/job/gitlab-branch-source-plugin/view/change-requests/job/PR-7/4/artifact/**/*-rc*.b56548afdc8b/*-rc*.b56548afdc8b*/*zip*/archive.zip');
      assert.equal(ctx.res.status, 400);
    });
  });
  describe('success', () => {
    it('should claim all is a sucess', async () => {
      data.body.build_url = 'https://ci.jenkins.io/job/Plugins/job/gitlab-branch-source-plugin/view/change-requests/job/PR-7/4/';
      await run();
      assert.equal(ctx.res.body, 'Response from Artifactory: Success\n');
      assert.equal(ctx.res.status, 200);
    });
  });
});
