/*
 * This module just has some helpers to make checking permissions easier
 */

const fetch     = require('node-fetch');
const StreamZip = require('node-stream-zip');
const util      = require('util');

const PERMISSIONS_URL = process.env.PERMISSIONS_URL || 'https://ci.jenkins.io/job/Infra/job/repository-permissions-updater/job/master/lastSuccessfulBuild/artifact/json/github-index.json'

module.exports = {
  fetch: () => {
    return fetch(PERMISSIONS_URL);
  },

  verify: (target, archive, permsResponse) => {
    return new Promise(async (resolve, reject) => {
      const permissions = await permsResponse.json();
      const applicable = permissions[target];

      if (!applicable) {
        reject(util.format('No applicable permissions for %s', target));
      }

      const zip = new StreamZip({file: archive});
      zip.on('entry', (entry) => {
        applicable.forEach((path) => {
          if (entry.name.startsWith(path)) {
            resolve(path);
          }
        });
        reject(util.format('No permissions for %s', entry.name));
      });

      zip.on('ready', () => {
        zip.close();
        resolve(true);
      });

      zip.on('error', (err) => { reject(err); });
    });
  },
};
