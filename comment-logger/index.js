module.exports = function (context, data) {
    const GithubApi = require('github');
    const http = require('follow-redirects').http;
    const https = require('follow-redirects').https;

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
    let matches = target_url.match(/PR-(\d+)/);
    let pull_request = matches[1];

    if (!pull_request) {
        context.done();
        return;
    }
    context.log('Matched on ' + target_url);

    /*
     * The Blue Ocean URL for fetching the whole log goes through the REST
     * API which is hugely different and inconsistent:
     *   Redirect URL:
     *       https://ci.jenkins.io/job/Infra/job/jenkins-infra/job/PR-898/1/display/redirect
     *   Detail URL:
     *       https://ci.jenkins.io/blue/organizations/jenkins/Infra%2Fjenkins-infra/detail/PR-898/1/pipeline
     *   Pipeline Raw Output URL
     *       https://ci.jenkins.io/blue/rest/organizations/jenkins/pipelines/Infra/pipelines/jenkins-infra/branches/PR-898/runs/1/log
     *
     * Compared to the classic URL
     *       https://ci.jenkins.io/job/Infra/job/jenkins-infra/job/PR-903/1/consoleText
     */
    const logs_url = target_url.replace('display\/redirect', 'consoleText');
    context.log('Grabbing logs from: ' + logs_url);

    https.get(logs_url, function(l) {
        let logData = '';
        l.on('data', function(chunk) { logData += chunk; });
        l.on('end', function() {
            let lines = logData.split('\n');

            /* Chop it down if it's too big. */
            if (lines.length > 50) {
                lines = lines.slice(lines.length - 50);
            }

            github.issues.createComment({
                    owner: data.repository.owner.login,
                    repo: data.repository.name,
                    number: pull_request,
                    body: 'Build failed; the context from the [latest run](' + target_url + ') is:\n' +
                            '<details><summary>Expand to view</summary>\n\n' + // Extra newline required within <details> tag
                            '```\n' +
                            lines.join('\n') +
                            '\n```\n' +
                            '</details>\n' +
                            '[Powered by the Comment Logger](https://github.com/jenkins-infra/community-functions/tree/master/comment-logger)'
            });

            context.done();
        });
    }).on('error', function(e) {
        context.log('Failed to fetch the log data for: ' + logs_url + ' due to: ' + e.message);
        context.done();
    });
};
