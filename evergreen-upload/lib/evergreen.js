'use strict';

const request = require('request-promise');

const EVERGREEN_ENDPOINT = process.env.EVERGREEN_ENDPOINT || 'https://evergreen.jenkins.io';


class Evergreen {
  static async create(context, commit, ingest) {
    return request({
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
    }).then((res) => {
      context.log(res);
      context.res = {
        status: 200,
        body: `Uploaded ${commit} to ${EVERGREEN_ENDPOINT}`,
      };
      context.done();
    }).catch((err) => {
      context.log.error(err);
      context.res = {
        status: 500,
        body: err,
      };
      context.done();
    });
  }

  static async taint(context, commit) {
    return request({
      uri: `${EVERGREEN_ENDPOINT}/update`,
      method: 'PATCH',
      json: true,
      headers: {
        'Authorization' : process.env.EVERGREEN_AUTH,
      },
      body: {
        commit: commit,
        channel: 'general',
        tainted: true,
      },
    }).then((res) => {
      context.log(res);
      context.res = {
        status: 200,
        body: `Tainted ${commit} on ${EVERGREEN_ENDPOINT}`,
      };
    }).catch((err) => {
      context.log.error(err);
      context.res = {
        status: 500,
        body: err,
      };
    });
  }

  static parseTaintedFrom(message) {
    const parts = message.match(/Taint: (\w+)?/);
    if (parts) {
      return parts[1];
    }
    return null;
  }

  /**
   * Return a list of commits which are being marked as tainted
   */
  static findRelevantCommits(webhookPayload) {
    return webhookPayload.commits
      .filter(c => c.modified.includes('services/essentials.yaml'))
      .map(c => Evergreen.parseTaintedFrom(c.message))
      .filter(c => c);
  }
}
module.exports = Evergreen;
