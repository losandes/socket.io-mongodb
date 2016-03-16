/*globals describe, it, after*/
'use strict';

var msgpack = require('msgpack-js');

module.exports = function (makeServer, expect, mongoAdapter, async, next) {
    var makeSocketIOServer;
    
    // Setup
    (function () {
        makeSocketIOServer = function (namespace, callback) {
            var adapter = mongoAdapter({
                uri: 'mongodb://localhost:27017/socket-io',
                messageEncoder: {
                    encode: function (data) {
                        return msgpack.encode(data);
                    },
                    decode: function (data) {
                        return msgpack.decode(data.buffer);
                    }
                }
            });

            makeServer(adapter, namespace, callback);
        };
    }());

    describe('when injecting a messageEncoder', function () {
        var serverTask;

        this.timeout(30000);

        after(function() {
            next();
        });

        serverTask = function (callback) {
            makeSocketIOServer('/mongo', function (server, client, adapter) {
                callback(null, {
                    server: server,
                    client: client,
                    adapter: adapter
                });
            });
        };

        it('should broadcast on the default namespace', function (done) {
            async.parallel([serverTask, serverTask], function (err, results) {
                results[0].client.on('test', function(a, b){
                    expect(Array.isArray(a)).to.equal(true);
                    expect(a.length).to.equal(0);
                    expect(b.a).to.equal('a');

                    done();
                });

                results[1].server.on('connection', function(client){
                    client.broadcast.emit('test', [], { a: 'a' });
                });
            }); // /async
        }); // /it
    });
};
