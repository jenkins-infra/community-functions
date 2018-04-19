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
    github.authenticate({
      type: 'oauth',
      token: GITHUB_TOKEN
    });

    /*
    * Ensure that the commit is actually present in our repository! No sense
    * doing any work with it if it's somehow not published.
    */
    const commit = await github.repos.getCommit({owner, repo, sha});
    return !!commit;
  },
};
