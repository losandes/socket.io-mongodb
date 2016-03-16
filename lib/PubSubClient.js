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

    return mubsub(uri, options);
};
