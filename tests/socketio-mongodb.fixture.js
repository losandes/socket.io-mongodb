var create,
    mongoConnxStr = 'mongodb://localhost:27017/socket-io-tests';

module.exports = function (http, io, socketioClient, expect, mubsub, adapter) {
    // Setup
    (function () {
        create = function (nsp, callback) {
            var server = http(),
                sio = io(server);

            sio.adapter(adapter(mongoConnxStr));

            server.listen(function (err) {
                var address,
                    url;

                if (err) {
                    throw err;
                }

                if (typeof nsp === 'function') {
                    callback = nsp;
                    nsp = '';
                }

                nsp = nsp || '/';
                address = server.address();
                url = 'http://localhost:' + address.port + nsp;

                if (typeof callback === 'function') {
                    callback(sio.of(nsp), socketioClient(url));
                }
            });
        };
    }());

    describe('socket.io-mongodb', function () {
        beforeEach(function (done) {
            var cli = mubsub(mongoConnxStr),
                channel = cli.channel('socket-io-tests');

            channel.publish('socket-io-tests', 'init', done);
        });

        it('should broadcast', function (done) {
            this.timeout(5000);

            create(function (server1, client1) {
                create(function (server2, client2) {
                    client1.on('woot', function(a, b){

                        expect(Array.isArray(a)).to.equal(true);
                        expect(a.length).to.equal(0);
                        expect(b.a).to.equal('b');
                        done();
                    });

                    server2.on('connection', function(c2){
                        c2.broadcast.emit('woot', [], { a: 'b' });
                    });
                });
            });
        });
    });
};
