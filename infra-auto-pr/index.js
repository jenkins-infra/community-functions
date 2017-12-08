// Please visit http://go.microsoft.com/fwlink/?LinkID=761099&clcid=0x409 for more information on settting up Github Webhooks
module.exports = function (context, data) {
    const GithubApi = require('github');
    const event_type = context.req.headers['x-github-event'];
    context.log('GitHub Webhook triggered!', event_type);
    let github = context.github || new GithubApi();

    /* Read more about push events:
     *  https://developer.github.com/v3/activity/events/types/#pushevent
     */
    if (event_type != 'push') {
        context.done();
        return;
    }

    /* Presently we're only supporting an auto pull request for the
     * jenkins-infra/jenkins-infra repository
     */
    if (('refs/heads/staging' != data.ref) ||
        (data.repository.full_name != 'jenkins-infra/jenkins-infra')) {
        context.done();
        return;
    }

    /* Create a pull request automatically from staging to
        * production
        */
    const description = 'This is an [automated pull request](https://github.com/jenkins-infra/community-functions/tree/master/infra-auto-pr) to deploy changes to production';
    /* The function must have this Application Setting already created */
    github.authenticate({
            type: 'oauth',
            token: process.env.GITHUB_TOKEN
    });

    github.pullRequests.create({
        owner: 'jenkins-infra',
        repo:  'jenkins-infra',
        title: 'Automated deployment to production',
        head:  'staging',
        base:  'production',
        body: description
    });

    context.done();
};
