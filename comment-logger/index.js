module.exports = function (context, data) {
    const GithubApi = require('github');
    const http = require('follow-redirects').http;
    const https = require('follow-redirects').https;
    const url  = require('url');

    const event_type = context.req.headers['x-github-event'];
    let github = new GithubApi();

    context.log('GitHub Webhook triggered!', event_type);
    if (event_type != 'status') {
        context.done();
        return;
    }

    /* Read more about status events:
     *  https://developer.github.com/v3/activity/events/types/#statusevent
     */
    if (!((data.state == 'failure') || (data.state == 'error'))) {
        context.done();
        return;
    }

    /* The function must have this Application Setting already created */
    github.authenticate({
            type: 'oauth',
            token: process.env.GITHUB_TOKEN
    });

    /*
     * This is typically going to be the Blue Ocean redirect URL, e.g.:
     *  https://ci.jenkins.io/job/Infra/job/jenkins-infra/job/PR-898/1/display/redirect
     * which much be translated into an ACTUAL URL before we can massage it
     * to get the full `pipeline.log`
     */
    const target_url = data.target_url;

    /*
     * If the URL is not a pull request run (like a branch run), it will
     * look like this:
     *  https://ci.jenkins.io/job/Infra/job/jenkins-infra/job/staging/253/display/redirect
     * and will be a pain in the ass to translate from a commit status to
     * the pull request for commenting, so...we're skipping that for now.
     */
    if (!target_url.match(/PR-(\d+)/)) {
        context.done();
        return;
    }

    context.log('Matched on ' + target_url);

    https.get(target_url, function(r) {
        context.log('The "real" url we\'re working with is: ' + r.responseUrl);
        /*
        * This URL is more useful, something like:
        *  https://ci.jenkins.io/blue/organizations/jenkins/Infra%2Fjenkins-infra/detail/PR-898/1/pipeline
        */
        const blueocean_url = url.parse(r.responseUrl);

        /* At this point url_parts can be joined back together to form the
            * full and proper URL for fetching the logs:
            *  https://ci.jenkins.io/blue/rest/organizations/jenkins/pipelines/Infra/pipelines/jenkins-infra/branches/PR-898/runs/1/log
            */
        let parts = blueocean_url.pathname.match(/.*PR-(\d+)\/(\d+).*/);

        if (!parts) {
            context.done();
            return;
        }
        /* Let's get stupid */
        let pull_request = parts[1];
        let run = parts[2];
        context.log('Processing for pull request ' + pull_request);

        let path_parts = blueocean_url.pathname.split('/');
        /* Mangle that URL! */
        let spliced = path_parts.splice(path_parts.length - 2, 2, 'runs', run, 'log');
        const logs_url =- 'https://' + blueocean_url.host + spliced.join('/');
        context.log('Grabbing logs from: ' + logs_url);

        https.get(logs_url, function(l) {
            let logData = '';
            l.on('data', function(chunk) { logData += chunk; });
            l.on('end', function() {
                let lines = logData.split('\n');

                /* Chop it down if it's too big. */
                if (lines.length > 100) {
                    lines = lines.slice(lines.length - 100);
                }

                github.issues.createComment({
                        owner: data.repository.owner.login,
                        repo: data.repository.name,
                        number: pull_request,
                        body: 'The context from the Jenkins Pipeline run is:\n```\n' + lines.join('\n') + '\n```'
                });

                context.done();
            });
        }).on('error', function(e) {
            context.log('Failed to fetch the log data for: ' + logs_url + ' due to: ' + e.message);
            context.done();
        });
    }).on('error', function(e) {
        context.log('Failed to process URI: ' + target_url + ' due to: ' + e.message);
        context.done();
    });
};
