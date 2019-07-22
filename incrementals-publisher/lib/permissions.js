/*
 * This module just has some helpers to make checking permissions easier
 */

const fetch     = require('node-fetch');
const StreamZip = require('node-stream-zip');
const util      = require('util');
const xml2js    = util.promisify(require('xml2js').parseString);

const PERMISSIONS_URL = process.env.PERMISSIONS_URL || 'https://ci.jenkins.io/job/Infra/job/repository-permissions-updater/job/master/lastSuccessfulBuild/artifact/json/github.index.json'

module.exports = {
  fetch: () => {
    return fetch(PERMISSIONS_URL);
  },

  verify: async (log, target, archive, entries, permsResponse, owner, repo, hash) => {
    const permissions = await permsResponse.json();
    return new Promise((resolve, reject) => {
      const applicable = permissions[target];

      if (!applicable) {
        reject(util.format('No applicable permissions for %s', target));
      }

      const zip = new StreamZip({file: archive});

      zip.on('entry', async function (entry) {
        entries.push(entry.name);
        let ok = !!applicable.find(file => entry.name.startsWith(file));
        if (!ok) {
          this.emit('error', new Error(util.format('No permissions for %s', entry.name)));
          return
        }
        if (entry.name.endsWith('.pom')) {
          const pomXml = zip.entryDataSync(entry.name);
          const result = await xml2js(pomXml);
          if (!result.project.scm) {
            this.emit('error', new Error(util.format('Missing <scm> section in %s', entry.name)));
            return
          }
          const scm = result.project.scm[0];
          if (!scm.url) {
            this.emit('error', new Error(util.format('Missing <url> section in <scm> of %s', entry.name)));
            return
          }
          const url = scm.url[0];
          if (!scm.tag) {
            this.emit('error', new Error(util.format('Missing <tag> section in <scm> of %s', entry.name)));
            return
          }
          const tag = scm.tag[0];
          const groupId = result.project.groupId[0];
          const artifactId = result.project.artifactId[0];
          const version = result.project.version[0];
          log.info('Parsed %s with url=%s tag=%s GAV=%s:%s:%s', entry.name, url, tag, groupId, artifactId, version);
          const expectedPath = groupId.replace(/[.]/g, '/') + '/' + artifactId + '/' + version + '/' + artifactId + '-' + version + '.pom';
          if (tag !== hash) {
            this.emit('error', new Error('Wrong commit hash in /project/scm/tag'));
            return
          } else if (!url.match('^https?://github[.]com/' + owner + '/' + repo + '([.]git)?(/.*)?$')) {
            this.emit('error', new Error('Wrong URL in /project/scm/url'));
            return
          } else if (expectedPath !== entry.name) {
            this.emit('error', new Error(util.format('Wrong GAV: %s vs. %s', expectedPath, entry.name)));
            return
          }
        }
      });

      zip.on('ready', () => {
        zip.close();
        resolve(true);
      });

      zip.on('error', (err) => { reject('ZIP error: ' + err); });
    });
  },
};
