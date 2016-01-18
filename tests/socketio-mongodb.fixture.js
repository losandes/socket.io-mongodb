module.exports = function (db, makeServer, expect, mongoAdapter, async, next) {
    var makeSocketIOServer;

    // Setup
    (function () {
        makeSocketIOServer = function (namespace, callback) {
            var adapter;

            if (db.connx) {
                adapter = mongoAdapter(db.connx, db.options);
            } else {
                adapter = mongoAdapter(db);
            }

            makeServer(adapter, namespace, callback);
        };
    }());

    describe('socket.io-mongodb', function () {
        var serverTask;

        this.timeout(30000);

        serverTask = function (callback) {
            makeSocketIOServer(function (server, client) {
                callback(null, {
                    server: server,
                    client: client
                });
            });
        };

        after(function() {
            next();
        });        

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

        it('should broadcast on a specific namespace', function (done) {
            makeSocketIOServer('/myns', function (server1, client1) {
                makeSocketIOServer('/myns', function (server2, client2) {
                    client1.on('test', function(a, b){

                        expect(Array.isArray(a)).to.equal(true);
                        expect(a.length).to.equal(0);
                        expect(b.b).to.equal('b');
                        done();
                    });

                    server2.on('connection', function(c2){
                        c2.broadcast.emit('test', [], { b: 'b' });
                    });
                });
            });
        }); // /it

        it('should broadcast to rooms on the default namespace', function (done) {
            async.parallel([serverTask, serverTask, serverTask], function (err, results) {
                results[0].server.on('connection', function(client){
                    client.join('test');
                });

                results[1].server.on('connection', function(client){
                    // does not join, performs broadcast
                    client.on('do broadcast', function(){
                        client.broadcast.to('test').emit('broadcast', [], { c: 'c' });
                    });
                });

                results[2].server.on('connection', function(client){
                    results[0].client.on('broadcast', function(a, b){
                        expect(Array.isArray(a)).to.equal(true);
                        expect(a.length).to.equal(0);
                        expect(b.c).to.equal('c');

                        results[0].client.disconnect();
                        results[1].client.disconnect();
                        results[2].client.disconnect();

                        setTimeout(done, 100);
                    });

                    results[1].client.on('broadcast', function(){
                        throw new Error('Not in room');
                    });

                    results[2].client.on('broadcast', function(){
                        throw new Error('Not in room');
                    });

                    // does not join, signals broadcast
                    results[1].client.emit('do broadcast');
                });
            }); // /async

        }); // /it

        it('should NOT broadcast to rooms that have been left', function (done) {
            async.parallel([serverTask, serverTask, serverTask], function (err, results) {
                results[0].server.on('connection', function (client) {
                    client.join('leavetest');
                    client.leave('leavetest');
                });

                results[1].server.on('connection', function (client) {
                    client.on('do broadcast', function () {
                        client.broadcast.to('leavetest').emit('broadcast', [], { d: 'd' });

                        setTimeout(function () {
                            results[0].client.disconnect();
                            results[1].client.disconnect();
                            results[2].client.disconnect();
                            done();
                        }, 100);
                    });
                });

                results[2].server.on('connection', function (client) {
                    results[1].client.emit('do broadcast');
                });

                results[0].client.on('broadcast', function () {
                    throw new Error('Not in room');
                });
            }); // /async
        }); // /it

        it('should delete rooms upon disconnection', function () {
            async.parallel([serverTask], function (err, results) {
                results[0].server.on('connection', function (client) {
                    client.join('leavealltest');
                    client.on('disconnect', function () {
                        expect(client.adapter.sids[c.id]).to.be.empty();
                        expect(client.adapter.rooms).to.be.empty();
                        client.disconnect();
                        done();
                    });
                    client.disconnect();
                });
            }); // /async
        }); // /it

    });
};
