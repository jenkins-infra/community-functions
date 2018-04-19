
const fetch     = require('node-fetch');

const pipeline  = require('./lib/pipeline');
const github    = require('./lib/github');

const JENKINS_HOST     = process.env.JENKINS_HOST || 'https://ci.jenkins.io';
const INCREMENTAL_REPO = process.env.INCREMENTAL_URL || 'https://repo.jenkins-ci.org/incrementals/'

module.exports = async (context, data) => {
  const build_url = data.body.build_url;
  /* If we haven't received any valid data, just bail early
   * */
  if (!build_url) {
    context.res = {
      status: 400,
      body: 'The incrementals-publisher invocation was poorly formed and missing attributes'
    };
    context.done();
    return;
  }

  /*
   * The first step is to take the build_url and fetch some metadata about this
   * specific Pipeline Run
   */
  let metdata_url = pipeline.getApiUrl(build_url);
  if (process.env.METADATA_URL) {
    metadata_url = process.env.METADATA_URL;
    context.log.info('Using an override for the metadata URL:', metadata_url);
  }
  let metadata = await fetch(metadata_url);

  if (metadata.status != 200) {
    context.log.error('Failed to fetch Pipeline metadata', metadata.body);
  }
  metadata = await metadata.json();

  if (!metadata) {
    context.log.error('I was unable to parse any JSON metadata', metadata);
    context.done();
    return;
  }
  metadata = pipeline.processMetadata(metadata);

  if ( (!metadata.hash) || (!metadata.remote_url)) {
    context.log.error('Unable to retrieve a hash or remote_url');
    context.done();
    return;
  }

  let repoInfo = pipeline.getRepoFromUrl(metadata.remote_url);

  if (!github.commitExists(repoInfo.owner, repoInfo.repo, metadata.hash)) {
    context.log.error('This request was using a commit which does not exist on GitHub!', commit);
    context.done();
    return;
  }

  let archive_url = pipeline.getArchiveUrl(build_url);
  if (process.env.ARCHIVE_URL) {
    archive_url = process.env.ARCHIVE_URL;
    context.log.info('Using an override for the archive URL:', archive_url);
  }

  /*
   * Once we have some data about the Pipeline, we can fetch the actual
   * `archive.zip` which has all the right data within it
   */
  return fetch(archive_url)
    .then((res) => {
      if (res.status != 200) {
        context.log.error('Failed to get a 200 response from', build_url);
      }
      context.res = {
        status: 201,
        body: 'Published!'
      };
      context.log('Returning a 201 after getting the zip');
      return context.done();
    })
    .catch(err => context.log.error(err));
  return;

};
