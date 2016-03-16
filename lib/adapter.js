/*jshint bitwise: false*/
var Adapter = require('socket.io-adapter'),
    async = require('async'),
    PubSubClient = require('./PubSubClient.js'),
    messageEncoder = require('./messageEncoder'),
    makeUid;

makeUid = function () {
    'use strict';

    var templateString = 'xxxxxxxx';

    return templateString.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c === 'x' ? r : r & 3 | 8;
        return v.toString(16);
    });
};

module.exports = function (uri, options) {
    'use strict';

    var pubsubCli,
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
    options.collectionName = options.collectionName || 'pubsub';
    options.messageEncoder = options.messageEncoder || messageEncoder;

    pubsubCli = new PubSubClient(options);
    // only accept the channel if the pubsubClient was also defined
    channel = (options.pubsubClient && options.channel) || pubsubCli.channel(options.collectionName);

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

        self.uid = serverId;
        self.prefix = options.prefix;
        self.pubsubClient = pubsubCli;
        self.channel = channel;
        self.db = pubsubCli.db;

        self.channel.subscribe(makeChannelName(namespace.name), self.onmessage.bind(self));
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

        packet = options.messageEncoder.decode(msg.packet);
        opts = options.messageEncoder.decode(msg.options);

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
                    self.channel.publish(
                        makeChannelName(packet.nsp, room),
                        {
                            uid: serverId,
                            packet: options.messageEncoder.encode(packet),
                            options: options.messageEncoder.encode(opts)
                        }
                    );
                });
            } else {
                self.channel.publish(
                    makeChannelName(packet.nsp),
                    {
                        uid: serverId,
                        packet: options.messageEncoder.encode(packet),
                        options: options.messageEncoder.encode(opts)
                    }
                );
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

        channels[channelName] = self.channel.subscribe(channelName, self.onmessage.bind(self));

        if (typeof callback === 'function') {
            process.nextTick(callback.bind(null, null));
        }
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
            rooms = self.sids[clientId];

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
                    self.emit('error', err); //adapter.emit('error', err);
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

    MongoAdapter.uid = serverId;
    MongoAdapter.prefix = options.prefix;
    MongoAdapter.pubsubClient = pubsubCli;
    MongoAdapter.channel = channel;
    MongoAdapter.db = pubsubCli.db;

    return MongoAdapter;
};
