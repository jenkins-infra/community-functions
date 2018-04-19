
const GitHubApi = require('@octokit/rest');
const fetch     = require('node-fetch');

const JENKINS_HOST     = process.env.JENKINS_HOST || 'https://ci.jenkins.io';
const GITHUB_TOKEN     = process.env.GITHUB_TOKEN || 'invalid-dummy-secret';
const INCREMENTAL_REPO = process.env.INCREMENTAL_URL || 'https://repo.jenkins-ci.org/incrementals/'

module.exports = function (context, data) {
  /* If we haven't received any valid data, just bail early */
  if ((!data) || (!data.build_url)) {
    context.res = {
      status: 400,
      body: 'The incrementals-publisher invocation was poorly formed and missing attributes'
    };
    context.done();
    return;
  }

  let github = context.github || new GitHubApi();

  /* The function must have this Application Setting already created */
  github.authenticate({
    type: 'oauth',
    token: GITHUB_TOKEN
  });


  context.res = {
    status: 201,
    body: 'Published!'
  };

  context.done();
};
