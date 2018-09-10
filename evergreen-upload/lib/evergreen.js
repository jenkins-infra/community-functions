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
}
module.exports = Evergreen;
