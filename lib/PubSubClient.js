var mubsub = require('mubsub'),
    mongodbUri = require('mongodb-uri');

module.exports = function (options) {
    'use strict';
    
    var uri;

    if (options.pubsubClient) {
        return options.pubsubClient;
    }

    if (options.mongoClient) {
        return mubsub(options.mongoClient);
    }


    if (typeof options.uri === 'string') {
        uri = options.uri;
    } else {
        uri = (mongodbUri.format(options.uri));
    }
    
    var mongoDBO = Object.assign({}, options);
    
    delete mongoDBO.uri;
    delete mongoDBO.prefix;
    delete mongoDBO.channel;
    delete mongoDBO.collectionName;
    delete mongoDBO.messageEncoder;

    return mubsub(uri, mongoDBO);
};
