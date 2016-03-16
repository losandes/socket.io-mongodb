/*globals describe, it, after*/
'use strict';

module.exports = function (mubsub, makeServer, expect, mongoAdapter, async, next) {
    var channelName = 'mubsubclitest',
        makeSocketIOServer;

    // Setup
    (function () {
        makeSocketIOServer = function (namespace, callback) {
            var client,
                channel,
                adapter;

            client = mubsub('mongodb://localhost:27017/socket-io-tests');
            channel = client.channel(channelName);
            adapter = mongoAdapter({
                pubsubClient: client,
                channel: channel
            });

            makeServer(adapter, namespace, callback);
        };
    }());

    describe('when injecting a pubsubClient', function () {
        var serverTask;

        this.timeout(30000);

        after(function() {
            next();
        });

        serverTask = function (callback) {
            makeSocketIOServer('/mubsub', function (server, client, adapter) {
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

                    expect(results[0].adapter.pubsubClient.channels[channelName].name).to.equal(channelName);
                    expect(results[0].adapter.channel.name).to.equal(channelName);

                    done();
                });

                results[1].server.on('connection', function(client){
                    client.broadcast.emit('test', [], { a: 'a' });
                });
            }); // /async
        }); // /it
    });
};
