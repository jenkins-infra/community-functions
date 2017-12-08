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

    describe('Non-status events', () => {
        it('should do nothing and return', () => {
            simple.mock(ctx, 'req', {
                headers: { 'x-github-event' : 'push' }
            });

            fun(ctx, {});

            assert(ctx.done.called);
        });
    });

    describe('Status events', () => {
        beforeEach(() => {
            simple.mock(ctx, 'req', {
                headers: { 'x-github-event' : 'status' }
            });
        });

        it('should do nothing on `success`', () => {
            fun(ctx, {state: 'success'});
            assert(ctx.done.called);
        });
    });
});
