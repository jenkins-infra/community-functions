// Please visit http://go.microsoft.com/fwlink/?LinkID=761099&clcid=0x409 for more information on settting up Github Webhooks
module.exports = function (context, data) {
    const github = require('github');
    context.log('GitHub Webhook triggered!', data.name);
    context.log(data.context);
    context.done();
};
