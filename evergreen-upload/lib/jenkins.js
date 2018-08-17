'use strict';

const request = require('request-promise');

const JENKINS_AUTH           = process.env.JENKINS_AUTH;
const EVERGREEN_PIPELINE_URL = process.env.EVERGREEN_PIPELINE_URL || 'https://ci.jenkins.io/job/Infra/job/evergreen/job/master/lastSuccessfulBuild';

const commitApiUrl = '/api/json'
const artifactUrl  = '/artifact/services/ingest.json';

class Jenkins {
  constructor(context) {
    this.context = context;
  }

  getHttpHeaders() {
    if (JENKINS_AUTH) {
      return {
        'Authorization': 'Basic ' + new Buffer(JENKINS_AUTH, 'utf8').toString('base64')
      };
    }
    return {};
  }

  async fetchCommitData() {
    const data = await request({
      uri: `${EVERGREEN_PIPELINE_URL}${commitApiUrl}`,
      qa: 'tree=actions[revision[hash,pullHash]]',
      json: true,
      headers: this.getHttpHeaders()
    });
    return this.commitFromData(data);
  }

  async fetchIngest() {
    return await request({
      uri: `${EVERGREEN_PIPELINE_URL}${artifactUrl}`,
      headers: this.getHttpHeaders(),
      json: true
    });
  }

  commitFromData(data) {
    if ((!data) || (!data.actions)) {
      throw new Error('commitFromData should be passed data');
    }

    let commit = null;

    data.actions.forEach((action) => {
      if (action._class == 'hudson.plugins.git.util.BuildData') {
        commit = action.buildsByBranchName.master.revision.SHA1;
      }
    });

    if (!commit) {
      throw new Error('commitFromData could not find any relevant actions');
    }
    return commit;
  }
}

module.exports = Jenkins;
