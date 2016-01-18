var mubsub = require('mubsub'),
    Adapter = require('socket.io-adapter'),
    mongodbUri = require('mongodb-uri'),
    async = require('async'),
    encodeMessage,
    decodeMessage,
    makeUid;

encodeMessage = JSON.stringify;
decodeMessage = JSON.parse;

makeUid = function () {
    templateString = 'xxxxxxxx';

    return templateString.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c === 'x' ? r : r & 3 | 8;
        return v.toString(16);
    });
};

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
//      prefix: (the prefix to be used when creating rooms)
//      collectionName: (the name of the collection/mubsub channel )
//      mubsubOptions: (mubsub passthru)
//}

module.exports = function (uri, options) {
    var connxStr,
        mubsubCli,
        serverId = makeUid(),
        channel,
        MongoAdapter,
        makeChannelName,
        channels = {};

    // handle options only
    if (typeof uri === 'object') {
        options = uri;
        uri = null;
    } else {
        options = options || {};
        options.uri = uri;
    }

    options.prefix = options.prefix || 'socket-io';
    options.collectionName = options.collectionName || 'io';

    if (typeof options.uri === 'string') {
        connxStr = options.uri;
    } else {
        connxStr = (mongodbUri.format(options.uri));
    }

    if (options.client) {
        mubsubCli = options.client;
    } else if (options.mongodbDriver) {
        mubsubCli = mubsub(options.mongodbDriver);
    } else {
        mubsubCli = mubsub(connxStr, options.mubsubOptions);
    }

    channel = mubsubCli.channel(options.collectionName);

    makeChannelName = function (namespaceName, roomName) {
        var name = options.prefix + '::' + (!namespaceName || namespaceName === '/' ? '' : (namespaceName + '::'));

        if (roomName) {
            name += roomName + '::';
        }

        return name;
    };

    /**
    // Adapter constructor
    //
    // @param namespace (string): The namespace for this adapter
    */
    MongoAdapter = function (namespace) {
        var self = this;

        Adapter.call(self, namespace);
        channel.subscribe(makeChannelName(namespace.name), self.onmessage.bind(self));
    };

    /**
    // MongoAdapter inherits Adapter
    */
    MongoAdapter.prototype.__proto__ = Adapter.prototype;

    /**
    // Subscriber callback is called when a new message is inserted into the collection
    */
    MongoAdapter.prototype.onmessage = function (msg) {
        var self = this, packet, opts;

        if (msg.uid === serverId || !msg.uid) {
            // 'the message is from this server - ignoring'
            return false;
        }

        packet = decodeMessage(msg.packet);
        opts = decodeMessage(msg.options);

        packet.nsp = packet.nsp || '/';

        if (packet.nsp !== self.nsp.name) {
            // 'the message is for a different namespace - ignoring'
            return false;
        }

        // make sure to add remote=true to the args, so broadcast doesn't cause an infinite loop
        self.broadcast.apply(self, [packet, opts, true /*remote*/]);
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
                    channel.publish(makeChannelName(packet.nsp, room), { uid: serverId, packet: encodeMessage(packet), options: encodeMessage(opts) });
                });
            } else {
                channel.publish(makeChannelName(packet.nsp), { uid: serverId, packet: encodeMessage(packet), options: encodeMessage(opts) });
            }
        }
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
            channelName;

        //debug('adding %s to %s ', clientId, roomName);
        Adapter.prototype.add.call(self, clientId, roomName);
        channelName = makeChannelName(self.nsp.name, roomName);

        channels[channelName] = channel.subscribe(channelName, self.onmessage.bind(self));
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
            channelName,
            hasRoom;

        //debug('removing %s from %s', clientId, roomName);
        hasRoom = self.rooms.hasOwnProperty(roomName);
        Adapter.prototype.del.call(self, clientId, roomName);

        if (hasRoom && !self.rooms[roomName]) {
          channelName = makeChannelName(self.nsp.name, roomName);

          if (channels[channelName]) {
              channels[channelName].unsubscribe();
          }
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
            rooms = self.sids[clientId],
            deleteRoom,
            deleteSids;

        //debug('removing %s from all rooms', clientId);
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
