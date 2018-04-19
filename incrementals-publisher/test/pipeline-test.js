const assert   = require('assert');
const pipeline = require('../lib/pipeline.js');

describe('The Pipeline helpers', () => {
  let build_url = 'https://ci.jenkins.io/job/structs-plugin/job/PR-36/3/';

  describe('processMetadata', () => {
    let metadata = {
      "_class" : "org.jenkinsci.plugins.workflow.job.WorkflowRun",
      "actions" : [
        {
          "_class" : "hudson.model.CauseAction"
        },
        {
          "_class" : "jenkins.scm.api.SCMRevisionAction",
          "revision" : {
            "_class" : "jenkins.plugins.git.AbstractGitSCMSource$SCMRevisionImpl",
            "hash" : "abc131cc3bf56309a05b3fe8b086b265d14f2a61"
          }
        },
        {
          "_class" : "hudson.plugins.git.util.BuildData",
          "remoteUrls" : [
            "https://github.com/jglick/structs-plugin.git"
          ]
        },
        {
          "_class" : "hudson.plugins.git.GitTagAction"
        },
        {

        },
        {
          "_class" : "org.jenkinsci.plugins.workflow.cps.EnvActionImpl"
        },
        {

        },
        {

        },
        {
          "_class" : "org.jenkinsci.plugins.workflow.job.views.FlowGraphAction"
        },
        {

        },
        {

        }
      ]
    };

    it('should return the right hash', () => {
      const value = pipeline.processMetadata(metadata);
      assert.equal(value.hash, "abc131cc3bf56309a05b3fe8b086b265d14f2a61");
    });

    it('should return the right remote_url', () => {
      const value = pipeline.processMetadata(metadata);
      assert.equal(value.remote_url, "https://github.com/jglick/structs-plugin.git");
    });
  });

  describe('getApiUrl', () => {
    it('should generate an api/json URL', () => {
      const url = pipeline.getApiUrl(build_url);
      assert.ok(url);
      assert.ok(url.match('api/json'));
    });
  });

  describe('getArchiveUrl', () => {
    it('should generate an archive.zip URL', () => {
      let hash = 'acbd4';
      const url = pipeline.getArchiveUrl(build_url, hash);
      assert.ok(url);
      assert.ok(url.match('archive.zip$'));
    });
  });

  describe('getRepoFromUrl', () => {
    it('should return a valid object', () => {
      const value = pipeline.getRepoFromUrl('https://github.com/jenkinsci/blueocean-plugin.git');

      assert.equal(value.owner, 'jenkinsci');
      assert.equal(value.repo, 'blueocean-plugin');
    });

    it('should raise on non-github.com URLs', () => {
      const url = 'https://bitbucket.org/lolz/yeahright.hg';
      let value = null
      try {
        value = pipeline.getRepoFromUrl(url);
      }
      catch (err) {
      }
      if (value) {
        assert.fail('Should not have returned a value');
      }

    });
  });

});
