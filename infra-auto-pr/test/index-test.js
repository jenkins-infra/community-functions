const assert = require('assert');
const simple = require('simple-mock');
const fun    = require('../index.js');

describe('Handling webhook events', () => {
    var ctx = simple.mock();
    beforeEach(() => {
        simple.mock(ctx, 'log', (...args) => { /* console.log(args); */ });
        simple.mock(ctx, 'done', () => {});
    });
    afterEach(() => { simple.restore() });

    describe('Non-push events', () => {
        it('should do nothing and return', () => {
            simple.mock(ctx, 'req', {
                headers: { 'x-github-event' : 'status' }
            });
            fun(ctx, {});
            assert(ctx.done.called);
        });
    });

    describe('Push-events', () => {
        var github = simple.mock();

        beforeEach(() => {
            simple.mock(github, 'authenticate', (d) => { });
            ctx.github = github;
            ctx.req = {
                headers: { 'x-github-event' : 'push' }
            };
        });

        describe('on jenkins-infra/jenkins-infra', () => {
            it('should authenticate and create a pull request if the branch is `staging`', () => {
                let pr = simple.mock();
                simple.mock(pr, 'create', (d) => {});
                github.pullRequests = pr;

                fun(ctx, {
                    repository: {
                        full_name: 'jenkins-infra/jenkins-infra'
                    },
                    ref: 'refs/heads/staging'
                });

                assert.equal(github.authenticate.callCount, 1);
                assert.equal(pr.create.callCount, 1);
                assert(ctx.done.called);
            });

            it('should not do anything if the branch is not `staging`', () => {
                fun(ctx, {
                    repository: {
                        full_name: 'jenkins-infra/azure'
                    },
                    ref: 'refs/heads/master'
                });

                assert.equal(github.authenticate.callCount, 0);
                assert(ctx.done.called);
            });
        });

        describe('on repos that are not jenkins-infra/jenkins-infra', () => {
            it('empty data; should not authenticate and return', () => {
                fun(ctx, {});
                assert.equal(github.authenticate.callCount, 0);
            });
        });
    });
});
