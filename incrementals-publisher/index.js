/*
 * This Azure Function is responsible for processing information related to an
 * incrementals release and bouncing the artifacts into Artifactory
 */

const fs    = require('fs');
const fetch = require('node-fetch');
const os    = require('os');
const path  = require('path');
const util  = require('util');

const github      = require('./lib/github');
const pipeline    = require('./lib/pipeline');
const permissions = require('./lib/permissions');

const JENKINS_HOST     = process.env.JENKINS_HOST || 'https://ci.jenkins.io';
const INCREMENTAL_URL  = process.env.INCREMENTAL_URL || 'https://repo.jenkins-ci.org/incrementals/'
const ARTIFACTORY_KEY  = process.env.ARTIFACTORY_KEY || 'invalid-key';

const TEMP_ARCHIVE_DIR = path.join(os.tmpdir(), 'incrementals-');
const mktemp           = util.promisify(fs.mkdtemp);

/*
 * Small helper function to make failing a request more concise
 */
const failRequest = (context, body) => {
  context.res = {
    status: 500,
    body: body || 'Unknown error'
  };
};


module.exports = async (context, data) => {
  const buildUrl = data.body.build_url;
  /* If we haven't received any valid data, just bail early
   */
  if (!buildUrl) {
    context.res = {
      status: 400,
      body: 'The incrementals-publisher invocation was missing the build_url attribute'
    };
    return;
  }
  if (!buildUrl.startsWith(JENKINS_HOST)) {
    context.log.error('Misplaced build_url', buildUrl, JENKINS_HOST);
    return failRequest(context, 'This build_url is not supported');
  }
  // Starting some async operations early which we will need later
  let tmpDir = mktemp(TEMP_ARCHIVE_DIR);
  let perms = permissions.fetch();

  /*
   * The first step is to take the buildUrl and fetch some metadata about this
   * specific Pipeline Run
   */
  let metadataUrl = pipeline.getApiUrl(buildUrl);
  if (process.env.METADATA_URL) {
    metadataUrl = process.env.METADATA_URL;
    context.log.info('Using an override for the metadata URL:', metadataUrl);
  }
  let metadata = await fetch(metadataUrl);

  if (metadata.status != 200) {
    context.log.error('Failed to fetch Pipeline metadata', metadata.body);
  }
  metadata = await metadata.json();

  if (!metadata) {
    context.log.error('I was unable to parse any JSON metadata', metadata);
    return failRequest(context);
  }
  metadata = pipeline.processMetadata(metadata);

  if ( (!metadata.hash) || (!metadata.remoteUrl)) {
    context.log.error('Unable to retrieve a hash or remote_url');
    return failRequest(context, 'Unable to retrieve a hash or remote_url');
  }

  let repoInfo = pipeline.getRepoFromUrl(metadata.remoteUrl);

  if (!github.commitExists(repoInfo.owner, repoInfo.repo, metadata.hash)) {
    context.log.error('This request was using a commit which does not exist, or was ambiguous, on GitHub!', metadata);
    return failRequest(context, 'Could not find commit (non-existent or ambiguous)');
  }

  /*
   * Once we have some data about the Pipeline, we can fetch the actual
   * `archive.zip` which has all the right data within it
   */
  let archiveUrl = pipeline.getArchiveUrl(buildUrl);
  if (process.env.ARCHIVE_URL) {
    archiveUrl = process.env.ARCHIVE_URL;
    context.log.info('Using an override for the archive URL:', archiveUrl);
  }

  tmpDir = await tmpDir;
  context.log.info('Prepared a temp dir for the archive', tmpDir);
  const archivePath = path.join(tmpDir, 'archive.zip');

  const archive = await fetch(archiveUrl)
    .then((res) => {
      const dest = fs.createWriteStream(archivePath, { autoClose: true });
      res.body.pipe(dest);
      return archivePath;
    })
    .catch(err => context.log.error(err));
  context.log.info('Should be ready to upload', archive);


  /*
   * Once we have an archive.zip, we need to check our permissions based off of
   * the repository-permissions-updater results
   */
  perms = await perms;
  if (perms.status != 200) {
    context.log.error('Failed to get our permissions', perms);
    return failRequest(context, 'Failed to retrieve permissions');
  }
  const repoPath = util.format('%s/%s', repoInfo.owner, repoInfo.repo);
  const verified = await permissions.verify(repoPath, archivePath, perms);

  /*
   * Finally, we can upload to Artifactory
   */

  const upload = await fetch(util.format('%s/archive.zip', INCREMENTAL_URL),
    {
      headers: {
        'X-Explode-Archive' : true,
        'X-Explode-Archive-Atomic' : true,
        'X-JFrog-Art-Api' : ARTIFACTORY_KEY,
      },
      method: 'PUT',
      body: fs.createReadStream(archivePath)
  });
  context.log.info('Upload status', upload);

  context.res = {
    status: upload.status,
    body: 'Response from Artifactory: ' + upload.statusText
  };
};
