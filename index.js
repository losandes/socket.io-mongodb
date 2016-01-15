var uid2 = require('uid2'),
    mubsub = require('mubsub'),
    msgpack = require('msgpack-js'),
    Adapter = require('socket.io-adapter'),
    debug = require('debug')('socket.io-mongodb'),
    mongodbUri = require('mongodb-uri'),
    async = require('async');

console.log('Adapter', Adapter);
//options blueprint
// {
//     uri: @string or @object
    // { // uri object properties
    //     username: 'usern@me',
    //     password: 'p@ssword',
    //     hosts: [
    //         {
    //             host: 'host',
    //             port: 1234
    //         }
    //     ],
    //     database: 'd@tabase',
    //     options: {
    //         authSource: '@dmin'
    //     }
    // }
//      client: (mubsub client)
//      mongodbDriver: (an existing native mongodb driver)
//      key: (the prefix to be used when creating rooms)
//      mubsubOptions: (mubsub passthru)
//}

module.exports = function (uri, options) {
    var connxStr,
        mubsubCli,
        serverId = uid2(6),
        channel,
        MongoAdapter,
        makeRoomName,
        onChannelSubscriptionChange;

    // handle options only
    if (typeof uri === 'object') {
        options = uri;
        uri = null;
    } else {
        options = options || {};
        options.uri = uri;
    }

    options.key = options.key || 'socket-io';

    if (typeof options.uri === 'string') {
        connxStr = options.uri;
        options.key = mongodbUri.parse(uri).database || options.key;
    } else {
        options.key = options.uri.database || options.key;
        options.uri.database = options.uri.database || options.key;
        connxStr = (mongodbUri.format(options.uri));
    }

    if (options.client) {
        mubsubCli = options.client;
    } else if (options.mongodbDriver) {
        mubsubCli = mubsub(options.mongodbDriver);
    } else {
        mubsubCli = mubsub(connxStr, options.mubsubOptions);
    }

    makeRoomName = function (nsp, roomName) {
        if (roomName) {
            return options.key + nsp.name + '-' + roomName;
        } else {
            return options.key + (!nsp.name || nsp.name === '/' ? '' : nsp.name);
        }
    };

    onChannelSubscriptionChange = function (err, adapter, callback) {
        if (err) {
            adapter.emit('error', err);
            if (typeof callback === 'function') {
                callback(err);
            }
        } else if (typeof callback === 'function') {
            callback(null);
        }
    };

    /**
    // Adapter constructor
    //
    // @param namespace (string): The namespace for this adapter
    */
    MongoAdapter = function (namespace) {
        var self = this,
            defaultRoomName = makeRoomName(namespace);
        channel = mubsubCli.channel(defaultRoomName);

        Adapter.call(self, namespace);
        channel.subscribe(defaultRoomName, self.onmessage.bind(self));
    };

    /**
    // MongoAdapter inherits Adapter
    */
    MongoAdapter.prototype.__proto__ = Adapter.prototype;

    /**
    // Subscriber callback is called when a new message is inserted into the collection
    */
    MongoAdapter.prototype.onmessage = function (msg) {
        var self = this,
            args,
            nsp;

        if (msg.uid === serverId || !msg.uid) {
            return debug('the message is from this server - ignoring');
        }

        args = msgpack.decode(msg.data.buffer);
        nsp = args[0] && args[0].nsp === undefined ? '/' : args[0].nsp;

        if (nsp !== self.nsp.name) {
            return debug('the message is for a different namespace - ignoring');
        }

        args.push(true); // add remote=true to the args, so broadcast doesn't cause an infinite loop
        self.broadcast.apply(self, args);
    };

    /**
    // Broadcast a message (packet)
    //
    // @param packet (Object): the message to broadcase
    // @param opts (Object): the options
    // @param remote (Boolean): whether or not the packet is from another node
    */
    MongoAdapter.prototype.broadcast = function (packet, opts, remote) {
        var self = this;

        Adapter.prototype.broadcast.call(self, packet, opts);

        if (!remote) {
            if (opts.rooms) {
                opts.rooms.forEach(function (room) {
                    channel.publish(makeRoomName(packet.nsp, room), { uid: serverId, data: msgpack.encode([packet, opts]) });
                });
            } else {
                channel.publish(makeRoomName(packet.nsp), { uid: serverId, data: msgpack.encode([packet, opts]) });
            }
        }

        // Adapter.prototype.broadcast.call(this, packet, opts);
        // if (!remote) {
        //   var chn = prefix + '#' + packet.nsp + '#';
        //   var msg = msgpack.encode([uid, packet, opts]);
        //   if (opts.rooms) {
        //     opts.rooms.forEach(function(room) {
        //       var chnRoom = chn + room + '#';
        //       pub.publish(chnRoom, msg);
        //     });
        //   } else {
        //     pub.publish(chn, msg);
        //   }
        // }

    };


    /**
    // Subscribe the client to room messages
    //
    // @param clientId (string): the client id
    // @param roomName (string): the room name
    // @param callback (function): optional callback when subscribing to a room
    */
    MongoAdapter.prototype.add = function (clientId, roomName, callback) {
        var self = this,
            namespacedRoomName;

        debug('adding %s to %s ', clientId, roomName);
        Adapter.prototype.add.call(self, clientId, roomName);
        namespacedRoomName = makeRoomName(self.nsp, roomName);

        channel.subscribe(namespacedRoomName, function(err){
            onChannelSubscriptionChange(err, self, callback);
        });
    };

    /**
    // Unsubscribe the client from a room
    //
    // @param clientId (string): the client id
    // @param roomName (string): the room name
    // @param callback (function): optional callback when subscribing to a room
    */
    MongoAdapter.prototype.del = function (clientId, roomName, callback) {
        var self = this,
            namespacedRoomName,
            hasRoom;

        debug('removing %s from %s', clientId, roomName);

        hasRoom = self.rooms.hasOwnProperty(roomName);
        Adapter.prototype.del.call(self, clientId, roomName);

        if (hasRoom && !self.rooms[roomName]) {
          namespacedRoomName = makeRoomName(self.nsp, roomName);

          channel.unsubscribe(namespacedRoomName, function(err){
              onChannelSubscriptionChange(err, self, callback);
          });
        } else if (typeof callback === 'function') {
            process.nextTick(callback.bind(null, null));
        }
    };

    /**
    // Unsubscribe the client from all rooms
    //
    // @param clientId (string): the client id
    // @param callback (function): optional callback when subscribing to a room
    */
    MongoAdapter.prototype.delAll = function (clientId, callback) {
        var self = this,
            rooms = self.sids[clientId];

        debug('removing %s from all rooms', clientId);

        if (!rooms) {
            if (typeof callback === 'function') {
                process.nextTick(callback.bind(null, null));
            }
            return;
        }

        async.forEach(Object.keys(rooms), function (room, next) {
                self.del(clientId, room, next);
            }, function (err) {
                if (err) {
                    adapter.emit('error', err);
                    if (typeof callback === 'function') {
                        callback(err);
                    }
                } else if (typeof callback === 'function') {
                    delete self.sids[clientId];
                    callback(null);
                }
            }
        );
    };

    return MongoAdapter;
};
