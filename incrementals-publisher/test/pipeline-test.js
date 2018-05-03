const assert   = require('assert');
const pipeline = require('../lib/pipeline.js');

describe('The Pipeline helpers', () => {
  let build_url = 'https://ci.jenkins.io/job/structs-plugin/job/PR-36/3/';

  describe('processBuildMetadata', () => {
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
          "_class" : "hudson.plugins.git.util.BuildData"
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
      const value = pipeline.processBuildMetadata(metadata);
      assert.equal(value.hash, "abc131cc3bf56309a05b3fe8b086b265d14f2a61");
    });

    let metadata2 = { // https://ci.jenkins.io/job/Core/job/jenkins/job/master/888/api/json?tree=actions[revision[hash,pullHash]]&pretty
      "_class" : "org.jenkinsci.plugins.workflow.job.WorkflowRun",
      "actions" : [
        {
          "_class" : "hudson.model.CauseAction"
        },
        {
          "_class" : "jenkins.metrics.impl.TimeInQueueAction"
        },
        {

        },
        {
          "_class" : "jenkins.scm.api.SCMRevisionAction",
          "revision" : {
            "_class" : "jenkins.plugins.git.AbstractGitSCMSource$SCMRevisionImpl"
          }
        },
        {

        },
        {
          "_class" : "hudson.plugins.git.util.BuildData"
        },
        {
          "_class" : "hudson.plugins.git.GitTagAction"
        },
        {

        },
        {
          "_class" : "hudson.plugins.git.util.BuildData"
        },
        {
          "_class" : "org.jenkinsci.plugins.workflow.cps.EnvActionImpl"
        },
        {
          "_class" : "hudson.plugins.git.util.BuildData"
        },
        {

        },
        {

        },
        {
          "_class" : "hudson.tasks.junit.TestResultAction"
        },
        {

        },
        {

        },
        {

        },
        {

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

    it('should return no hash', () => {
      const value = pipeline.processBuildMetadata(metadata2);
      assert.equal(value.hash, null);
    });

    it('gracefully tolerates lack of any authentication', () => {
      const value = pipeline.processBuildMetadata({});
      assert.equal(value.hash, null);
    });
  });

  describe('getBuildApiUrl', () => {
    it('should generate an api/json URL', () => {
      const url = pipeline.getBuildApiUrl(build_url);
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

});
