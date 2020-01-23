const path        = require('path');
const assert      = require('assert');
const Permissions = require('../lib/permissions');

describe('The Permissions helpers', function() {
  it('Fails with bad url error', async () => {
    const folderMetadataParsed = {
      owner: 'jenkinsci',
      repo: 'bom'
    }
    const buildMetadataParsed = {
      hash: '149af85f094da863ddc294e50b5d8caaab549f95'
    }

    const repoPath = path.join(folderMetadataParsed.owner, folderMetadataParsed.repo);
    const entries = [];
    let perms = {
      status: 200,
      json: () => require('./fixtures-permissions.json')
    }
    assert.rejects(
      () =>  Permissions.verify(
        { info: () => true },
        repoPath,
        path.resolve('./test/fixtures-bad-scm-url-archive.zip'),
        entries,
        perms,
        folderMetadataParsed.owner,
        folderMetadataParsed.repo,
        buildMetadataParsed.hash
      ),
      {
        name: 'Error',
        message: 'ZIP error: Error: Wrong URL in /project/scm/url'
      }
    )
  })
});
