const assert = require('assert');
const simple = require('simple-mock');
const fun    = require('../index.js');

describe('Analytics bouncer', () => {
    var ctx = simple.mock();
    beforeEach(() => {
        simple.mock(ctx, 'log', (...args) => { /* console.log(args); */ });
        simple.mock(ctx, 'done', () => {});
    });
    afterEach(() => { simple.restore() });

    describe('with an empty event', () => {
        it('should return a 400', () => {
            fun(ctx, {});
            assert.equal(ctx.res.status, 400);
            assert(ctx.done.called);
        });
    });

    describe('with a valid event but with no records', () => {
        it('should return a 200', () => {
            fun(ctx, {
                    trackRequests: []
            });

            assert.equal(ctx.res.status, 200);
            assert(ctx.done.called);
        });
    });

    describe('with valid events', () => {
        let blueOceanEvent = {
            name: 'someEvent',
            properties: {
                user: 'some-optional-value',
                server: 'some-required-value',
                greeting: 'hello world'
            }
        };
        let keen = simple.mock();

        beforeEach(() => {
            this.recorded = false;
            ctx.keen = keen;
            simple.mock(keen,
                'recordEvents',
                (events, cb) => { recorded = true; cb(null, null); }
            );
        });

        it('should return a 200 for one event', () => {
            fun(ctx, {
                trackRequests: [blueOceanEvent]
            });

            assert(recorded);
            assert.equal(ctx.res.status, 200);
            assert.equal(ctx.res.body, 'Sent 1 events to Keen');
            assert(ctx.done.called);
            assert(keen.recordEvents.called);
        });

        it('should return a 200 for multiple events', () => {
            fun(ctx, {
                trackRequests: [blueOceanEvent, blueOceanEvent]
            });

            assert(recorded);
            assert.equal(keen.recordEvents.callCount, 1);

            assert.equal(ctx.res.status, 200);
            assert(ctx.done.called);
            assert.equal(ctx.res.body, 'Sent 2 events to Keen');
        });
    });
});
