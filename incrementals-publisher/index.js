/*
 * This Azure Function is responsible for processing information related to an
 * incrementals release and bouncing the artifacts into Artifactory
 */

const fs    = require('fs');
const fetch = require('node-fetch');
const os    = require('os');
const path  = require('path');
const util  = require('util');
const url   = require('url');

const github      = require('./lib/github');
const pipeline    = require('./lib/pipeline');
const permissions = require('./lib/permissions');

const JENKINS_HOST     = process.env.JENKINS_HOST || 'https://ci.jenkins.io/';
const INCREMENTAL_URL  = process.env.INCREMENTAL_URL || 'https://repo.jenkins-ci.org/incrementals/'
const ARTIFACTORY_KEY  = process.env.ARTIFACTORY_KEY || 'invalid-key';
const JENKINS_AUTH     = process.env.JENKINS_AUTH;

const TEMP_ARCHIVE_DIR = path.join(os.tmpdir(), 'incrementals-');
const mkdtemp          = util.promisify(fs.mkdtemp);

/*
 * Small helper function to make failing a request more concise
 */
class ExtendableError extends Error {
  constructor(message) {
    super(message);
    this.name = this.constructor.name;
    if (typeof Error.captureStackTrace === 'function') {
      Error.captureStackTrace(this, this.constructor);
    } else {
      this.stack = (new Error(message)).stack;
    }
  }
}

class FailRequestError extends ExtendableError {
  constructor(message, code = 400) {
    super(message);
    this.code = code;
  }
}

class SuccessRequestError extends ExtendableError {
  // ignorable, error, don't fail the build
  constructor(message, code = 200) {
    super(message);
    this.code = code;
  }
}


class IncrementalsPlugin {
  constructor(context, data) {
    this.context = context;
    this.data = data;
  }

  get permissions() {
    return permissions;
  }

  get github() {
    return github
  }

  get pipeline() {
    return pipeline
  }

  // wrapper for easier mocking
  fetch(...args) {
    return fetch(...args);
  }

  async uploadToArtifactory(archivePath) {
    const upload = await this.fetch(util.format('%sarchive.zip', INCREMENTAL_URL),
      {
        headers: {
          'X-Explode-Archive' : true,
          'X-Explode-Archive-Atomic' : true,
          'X-JFrog-Art-Api' : ARTIFACTORY_KEY,
        },
        method: 'PUT',
        body: fs.createReadStream(archivePath)
    });
    this.context.log.info('Upload status', upload.status, await upload.text());
    return upload;
  }


  async downloadFile(archiveUrl, fetchOpts) {
    let tmpDir = await mkdtemp(TEMP_ARCHIVE_DIR);
    this.context.log.info('Prepared a temp dir for the archive', tmpDir);
    const archivePath = path.join(tmpDir, 'archive.zip');

    const res = await fetch(archiveUrl, fetchOpts)
    await new Promise((resolve, reject) => {
      const fileStream = fs.createWriteStream(archivePath);
      res.body.pipe(fileStream);
      res.body.on("error", (err) => {
        fileStream.close();
        reject(err);
      });
      fileStream.on("finish", function() {
        fileStream.close();
        resolve();
      });
    });

    return archivePath
  }

  isValidUrl(buildUrl) {
    const parsedUrl = url.parse(buildUrl);
    const parsedJenkinsHost = url.parse(JENKINS_HOST);

    if (`${parsedUrl.protocol}//${parsedUrl.host}` != `${parsedJenkinsHost.protocol}//${parsedJenkinsHost.host}`) {
      throw new FailRequestError('This build_url is not supported');
    }
    if (!parsedUrl.path.match('/(job/[a-zA-Z0-9._-]+/)+[0-9]+/$') || buildUrl.includes('/../') || buildUrl.includes('/./')) {
      throw new FailRequestError('This build_url is malformed');
    }
  }

  async main() {
    const buildUrl = this.data.body.build_url;
    /* If we haven't received any valid data, just bail early */
    if (!buildUrl) {
      throw new FailRequestError('The incrementals-publisher invocation was missing the build_url attribute')
    }

    try {
      this.isValidUrl(buildUrl);
    } catch (buildUrlError) {
      this.context.log.error('Malformed', { buildUrl: buildUrl, JENKINS_HOST: JENKINS_HOST });
      throw buildUrlError;
    }

    // Starting some async operations early which we will need later
    let perms = this.permissions.fetch();

    const jenkinsOpts = {};
    if (JENKINS_AUTH) {
      jenkinsOpts.headers = {'Authorization': 'Basic ' + new Buffer.from(JENKINS_AUTH, 'utf8').toString('base64')};
    }

    /*
     * The first step is to take the buildUrl and fetch some metadata about this
     * specific Pipeline Run
     */
    let buildMetadataUrl = process.env.BUILD_METADATA_URL || this.pipeline.getBuildApiUrl(buildUrl);
    this.context.log.info("Retrieving metadata", buildMetadataUrl)
    let buildMetadata = await this.fetch(buildMetadataUrl, jenkinsOpts);
    if (buildMetadata.status !== 200) {
      this.context.log.error('Failed to fetch Pipeline build metadata', buildMetadata);
    }
    let buildMetadataJSON = await buildMetadata.json();

    if (!buildMetadataJSON) {
      this.context.log.error('I was unable to parse any build JSON metadata', buildMetadata);
      throw new FailRequestError();
    }
    let buildMetadataParsed = this.pipeline.processBuildMetadata(buildMetadataJSON);

    if (!buildMetadataParsed.hash) {
      this.context.log.error('Unable to retrieve a hash or pullHash', buildMetadataJSON);
      throw new SuccessRequestError(`Did not find a Git commit hash associated with this build. Some plugins on ${JENKINS_HOST} may not yet have been updated with JENKINS-50777 REST API enhancements. Skipping deployment.\n`)
    }

    let folderMetadata = await this.fetch(process.env.FOLDER_METADATA_URL || this.pipeline.getFolderApiUrl(buildUrl), jenkinsOpts);
    if (folderMetadata.status !== 200) {
      this.context.log.error('Failed to fetch Pipeline folder metadata', folderMetadata);
    }
    let folderMetadataJSON = await folderMetadata.json();
    if (!folderMetadataJSON) {
      this.context.log.error('I was unable to parse any folder JSON metadata', folderMetadata);
      throw new FailRequestError();
    }
    let folderMetadataParsed = this.pipeline.processFolderMetadata(folderMetadataJSON);
    if (!folderMetadataParsed.owner || !folderMetadataParsed.repo) {
      this.context.log.error('Unable to retrieve an owner or repo', folderMetadataJSON);
      throw new FailRequestError('Unable to retrieve an owner or repo');
    }

    if (!await this.github.commitExists(folderMetadataParsed.owner, folderMetadataParsed.repo, buildMetadataParsed.hash)) {
      this.context.log.error('This request was using a commit which does not exist, or was ambiguous, on GitHub!', buildMetadataParsed.hash);
      throw new FailRequestError('Could not find commit (non-existent or ambiguous)');
    }
    this.context.log.info('Metadata loaded', folderMetadataParsed.owner, folderMetadataParsed.repo, buildMetadataParsed.hash);

    /*
     * Once we have some data about the Pipeline, we can fetch the actual
     * `archive.zip` which has all the right data within it
     */
    let archiveUrl = process.env.ARCHIVE_URL || this.pipeline.getArchiveUrl(buildUrl, buildMetadataParsed.hash);

    const archivePath = await this.downloadFile(archiveUrl, jenkinsOpts)
    this.context.log.info('Downloaded', archiveUrl, archivePath);


    /*
     * Once we have an archive.zip, we need to check our permissions based off of
     * the repository-permissions-updater results
     */
    perms = await perms;
    if (perms.status !== 200) {
      this.context.log.error('Failed to get our permissions', perms);
      throw new FailRequestError('Failed to retrieve permissions');
    }
    const repoPath = util.format('%s/%s', folderMetadataParsed.owner, folderMetadataParsed.repo);
    let entries = [];
    this.context.log.info('Downloaded file size', fs.statSync(archivePath).size);
    try {
      await this.permissions.verify(this.context.log, repoPath, archivePath, entries, perms, folderMetadataParsed.owner, folderMetadataParsed.repo, buildMetadataParsed.hash);
    } catch (err) {
      this.context.log.error('Invalid archive');
      this.context.log.error(err);
      throw new FailRequestError(`Invalid archive retrieved from Jenkins, perhaps the plugin is not properly incrementalized?\n${err} from ${archiveUrl}`);
    }

    if (entries.length === 0) {
      this.context.log.error('Empty archive');
      throw new SuccessRequestError(`Skipping deployment as no artifacts were found with the expected path, typically due to a PR merge build not up to date with its base branch: ${archiveUrl}\n`)
    }
    this.context.log.info('Archive entries', entries);

    const pom = entries.find(entry => entry.endsWith('.pom'));
    if (!pom) {
      this.context.log.error('No POM');
      throw new FailRequestError('No POM');
    }
    this.context.log.info('Found a POM', pom);
    const pomURL = INCREMENTAL_URL + pom;
    const check = await this.fetch(pomURL);
    if (check.status === 200) {
      this.context.log.info('Already exists');
      throw new SuccessRequestError(`Already deployed, not attempting to redeploy: ${pomURL}\n`)
    }

    /*
     * Finally, we can upload to Artifactory
     */
    const upload = await this.uploadToArtifactory(archivePath, folderMetadataParsed, buildMetadataParsed, pomURL);
    this.context.log.info('Tried to create Artifactory status', upload);

    const result = await this.github.createStatus(folderMetadataParsed.owner, folderMetadataParsed.repo, buildMetadataParsed.hash, pomURL.replace(/[^/]+$/, ''))
      // ignore any actual errors, just log it
      .catch(err => err);
    this.context.log.info('Tried to create github status', result);

    return {
      status: upload.status,
      body: 'Response from Artifactory: ' + upload.statusText + '\n'
    };
  }
}

module.exports = async (context, data) => {
  context.log.info('Entering function', data);
  try {
    const obj = new IncrementalsPlugin(context, data);
    context.res = await obj.main();
  } catch (err) {
    context.res = {
      status: err.code || 400,
      body: err.message || 'Unknown error'
    };
    if ((process.env.NODE_ENV || 'development') === 'development') {
      context.res.body += "\n";
      context.res.body += err.stack;
    }

    return;
  }
}

module.exports.IncrementalsPlugin = IncrementalsPlugin;
