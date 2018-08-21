/*
 * This webhook-based Azure Function is responsible for taking a built
 * ingest.json and uploading it to the Evergreen backend service layer,
 * effectively kicking off the upgrade process for evergreen-clients
 *
 * https://issues.jenkins-ci.org/browse/JENKINS-52762
 */

const Jenkins   = require('./lib/jenkins');
const GithubApi = require('@octokit/rest');
const request   = require('request-promise');

const EVERGREEN_ENDPOINT = process.env.EVERGREEN_ENDPOINT || 'https://evergreen.jenkins.io';

module.exports = async (context, data) => {
    const event_type = context.req.headers['x-github-event'];
    context.log('Entering function with data:', data);
    context.log('GitHub Webhook triggered!', event_type);
    let github = context.github || new GithubApi();

    /*
     * Read more about push events:
     *  https://developer.github.com/v3/activity/events/types/#pushevent
     */
    if (event_type != 'push') {
        context.res = {
          status: 400,
          body: 'Invalid event type',
        };
        context.done();
        return;
    }

    /*
     * Only support deploying merges into the master branch
     */
    if (('refs/heads/master' != data.body.ref) ||
        (data.body.repository.full_name != 'jenkins-infra/evergreen')) {
        context.res = {
          status: 400,
          body: 'Incorrect branch and repository information',
        };
        context.done();
        return;
    }

    /* The function must have this Application Setting already created */
    github.authenticate({
            type: 'oauth',
            token: process.env.GITHUB_TOKEN
    });

    context.log('Valid request, fetching information');

    const jenkins = new Jenkins(context);
    const ingest = await jenkins.fetchIngest();
    const commit = await jenkins.fetchCommitData();

    context.log(`Preparing ingest for commit ${commit}`);

    try {
      const response = await request({
        uri: `${EVERGREEN_ENDPOINT}/update`,
        method: 'POST',
        json: true,
        headers: {
          'Authorization' : process.env.EVERGREEN_AUTH,
        },
        body: {
          commit: commit,
          manifest: ingest,
        },
      });
      context.log(res);
      context.res = {
        status: 200,
        body: `Uploaded ${commit} to ${EVERGREEN_ENDPOINT}`,
      };
      context.done();
      return;
    } catch (err) {
      context.log.error(err);
      context.res = {
        status: 500,
        body: err,
      };
      context.done();
      return;
    }
};
