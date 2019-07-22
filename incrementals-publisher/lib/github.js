/*
 * This module provides some helpers for working with GitHub for the
 * incrementals publishing
 */

const GitHubApi = require('@octokit/rest');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || 'invalid-dummy-secret';

module.exports = {
  commitExists: async (owner, repo, sha) => {
    let github = new GitHubApi();
    /* The function must have this Application Setting already created */
    await github.authenticate({
      type: 'oauth',
      token: GITHUB_TOKEN
    });

    /*
    * Ensure that the commit is actually present in our repository! No sense
    * doing any work with it if it's somehow not published.
    */
    const commit = await github.repos.getCommit({owner, repo, sha});
    // Here is where you could port https://github.com/jglick/incrementals-downstream-publisher/blob/10073f484d35edc3928f7808419c81a6eb48df62/src/main/java/io/jenkins/tools/incrementals_downstream_publisher/Main.java#L107-L111
    // so as to print information about commit signatures, or even enforce them.
    return !!commit;
  },

  createStatus: async (owner, repo, sha, target_url) => {
    let github = new GitHubApi();
    await github.authenticate({
      type: 'oauth',
      token: GITHUB_TOKEN
    });
    return github.repos.createStatus({owner, repo, sha, state: 'success', target_url, description: 'Deployed to Incrementals.', context: 'continuous-integration/jenkins/incrementals'});
  }
};
