module.exports = function(context, req) {
    const keen = require('keen-tracking');
    const util = require('util');

    /* Allow for a keen mock to be sent in during testing */
    let keenApi = context.keen || new keen({
            projectId: '5950934f3d5e150f5ab9d7be',
            writeKey:  'E6C1FA3407AF4DD3115DBC186E40E9183A90069B1D8BBA78DB3EA6B15EA6182C881E8C55B4D7A48F55D5610AD46F36E65093227A7490BF7A56307047903BCCB16D05B9456F18A66849048F100571FDC91888CAD94F2A271A8B9E5342D2B9404E'
    });

    /*
     * If we don't at least have a `trackRequests` property, then the request
     * is invalid, move on!
     **/
    if (!req.trackRequests) {
        context.log('Received a poorly formed request', req);
        context.res = {
            status: 400,
            body: 'Poorly formed analytics request, I expected a trackRequests property'
        };
        context.done();
        return;
    }

    /* Fail out early if we didn't receive any useful events */
    if (req.trackRequests.length == 0) {
        context.log('Received an empty request?');
        context.res = {
            status: 200,
            body: 'Try sending trackRequests next time'
        };
        context.done();
        return;
    }

    context.log('Received valid request events: ', req.trackRequests.length);

    /* The event batching for keen-tracking requires that we bucket things by
     * event name, see this page for more:
     *  <https://github.com/keen/keen-tracking.js/blob/HEAD/docs/record-events.md>
     */
    let events = {};
    let count = 0;
    req.trackRequests.forEach((item) => {
        if (events[item.name] === undefined) {
            events[item.name] = [];
        }
        events[item.name].push(item.properties);
        count += 1;
    });

    keenApi.recordEvents(events, (err, res) => {
        if (err) {
            context.log('Error sending Keen request', err);
            context.res = {
                status: 500,
                body: err
            };
        }
        else {
            context.res = {
                status: 200,
                body: util.format('Sent %d events to Keen', count)
            };
        }
        context.done()
    });
};
