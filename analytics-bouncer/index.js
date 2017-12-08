module.exports = function(context, req) {
    context.log('Node.js HTTP trigger function processed a request. RequestUri=%s', req.originalUrl);
    context.res = {
        body: 'Hello World'
    };
    context.done()
};
