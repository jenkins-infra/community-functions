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
  context.done();
};


module.exports = async (context, data) => {
  const buildUrl = data.body.build_url;
  /* If we haven't received any valid data, just bail early
   */
  if ((!buildUrl) || (!buildUrl.match(JENKINS_HOST))) {
    context.res = {
      status: 400,
      body: 'The incrementals-publisher invocation was poorly formed and missing attributes'
    };
    context.done();
    return;
  }
  // Starting some async operations early which we will need later
  let tmpDir = mktemp(TEMP_ARCHIVE_DIR);
  let perms = permissions.fetch();

  /*
   * The first step is to take the buildUrl and fetch some metadata about this
   * specific Pipeline Run
   */
  let metdata_url = pipeline.getApiUrl(buildUrl);
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
    context.done();
    return;
  }

  let repoInfo = pipeline.getRepoFromUrl(metadata.remoteUrl);

  if (!github.commitExists(repoInfo.owner, repoInfo.repo, metadata.hash)) {
    context.log.error('This request was using a commit which does not exist on GitHub!', commit);
    return failRequest(context, 'Could not find commit');
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
    return failRequest(context, 'Failed to retriev permissions');
  }
  const repoPath = util.format('%s/%s', repoInfo.owner, repoInfo.repo);
  const verified = await permissions.verify(repoPath, archivePath, perms);

  /*
   * Finally, we can upload to Artifactory
   */

  const upload = await fetch(INCREMENTAL_URL,
    {
      headers: {
        'X-Explode-Archive' : true,
        'X-Explode-Archive-Atomic' : true,
        'X-JFrog-Art-Api' : ARTIFACTORY_KEY,
      },
      method: 'PUT',
      body: fs.createReadStream(archivePath)
  });
  context.log.info('Uploaded', upload);

  context.res = {
    status: upload.status,
    body: 'Response from Artifactory: ' + upload.statusText
  };
};
