'use strict';

var http = require('http'),
    io = require('socket.io'),
    socketioClient = require('socket.io-client'),
    chaiBdd = require('chai'),
    expect = chaiBdd.expect,
    mubsub = require('mubsub'),
    MongoClient = require('mongodb').MongoClient,
    async = require('async'),
    mongoAdapter = require('../index.js'),
    nconf = require('nconf'),
    env = nconf.env().argv().file('environment', './environment/env.json'),
    fixture01 = require('./socketio-mongodb.fixture.js'),
    fixture02 = require('./mubsubCli.fixture.js'),
    fixture03 = require('./mongoCli.fixture.js'),
    fixture04 = require('./messageEncoder.fixture.js'),
    db = env.get('db') || {
        connx: 'mongodb://localhost:27017/socket-io-tests',
        options: null
    },
    makeServer;

console.log('Connecting to:', db.connx || db.hosts);

makeServer = function (adapter, namespace, callback) {
    var server = http.Server(),
        sio = io(server);

    sio.adapter(adapter);

    server.listen(function (err) {
        var address,
            url;

        if (err) {
            throw err;
        }

        if (typeof namespace === 'function') {
            callback = namespace;
            namespace = '/';
        }

        namespace = namespace || '/';
        address = server.address();
        url = 'http://localhost:' + address.port + namespace;

        if (typeof callback === 'function') {
            callback(sio.of(namespace), socketioClient(url), adapter);
        }
    });
};

async.series([
    function (callback) {
        fixture02(mubsub, makeServer, expect, mongoAdapter, async, callback);
    },
    function (callback) {
        fixture03(MongoClient, makeServer, expect, mongoAdapter, async, callback);
    },
    function (callback) {
        fixture04(makeServer, expect, mongoAdapter, async, callback);
    },
    function (callback) {
        fixture01(db, makeServer, expect, mongoAdapter, async, callback);
    }
], function () {});
