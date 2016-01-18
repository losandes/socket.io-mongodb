# socket.io-mongodb
A MongoDB Adapter for socket.io, based on [socket.io-redis](https://github.com/socketio/socket.io-redis).

This adapter:
* Implements the full socket.io-adapter, including rooms and room deletion
* Supports SSL connections to the database
* Leverages [mubsub](https://github.com/scttnlsn/mubsub)

## How to use

```JavaScript
var io = require('socket.io')(3000),
    mongoAdapter = require('socket.io-mongodb');

io.adapter(mongoAdapter('mongodb://localhost:27017/socket-io'));
```

By running socket.io with the `socket.io-mongodb` adapter you can run
multiple socket.io instances in different processes or servers that can
all broadcast and emit events to and from each other.

If you need to emit events to socket.io instances from a non-socket.io
process, you should use [socket.io-emitter](https://github.com/socketio/socket.io-emitter).


## API

### adapter(uri[, opts])
The first argument, `uri`, expects a MongoDB connection string (i.e. `mongodb://localhost:27017/socket-io`). The options argument is explained below.

### adapter(opts)
The options described here can be passed in as the first argument, or as the second argument, when the first argument is your MongoDB connection string.

* **uri** (_required_ string or object): a MongoDB connection string, or a URI object that can be parsed by [mongodb-uri](https://github.com/mongolab/mongodb-uri-node)
* **prefix** (_optional_ string): a prefix to be used when publishing events (default is _socket-io_)
* **collectionName** (_optional_ string): the name of the MongoDB collection that mubsub should create/use (default is _pubsub_). This is ignored if the `mongoClient` or `pubsubClient` properties are defined.
* **mongoClient** (_optional_ instance of MongoDB node driver): the MongoDB driver to use. This is ignored if the `pubsubClient` is defined.
* **pubsubClient** (_optional_ instance of mubsub): the mubsub client to use. This can be replaced by another library that implements the `channel`, `channel.subscribe`, and `channel.publish` interfaces.
* **channel** (_optional_ mubsub channel): the mubsub channel to use. This is only respected if the `pubsubClient` is also defined.

> The options that are described here are passed through to [mubsub](https://github.com/scttnlsn/mubsub), which in turn passes them to the [native MongoDB driver](https://github.com/mongodb/node-mongodb-native). So you can include options that are relevant to those libraries. Also, if you pass an object in as the `uri` property, it is processed by [mongodb-uri](https://github.com/mongolab/mongodb-uri-node).


## Client error handling
This adapter exposes the `pubsubClient` property (mubsub), as well as the `channel` that was created. You can listen for events on each of these resources:

```
var io = require('socket.io')(3000),
    mongoAdapter = require('socket.io-mongodb'),
    adapter = mongoAdapter('mongodb://localhost:27017/socket-io');

io.adapter(adapter);
adapter.pubsubClient.on('error', console.error);
adapter.channel.on('error', console.error);
```

## Custom client
You can inject your own pubsub client (i.e. if you already have an instance of mubsub you wish to use), using the `pubsubClient` property of the options.

```
var io = require('socket.io')(3000),
    mubsub = require('mubsub'),
    mongoAdapter = require('socket.io-mongodb'),
    client;

client = mubsub('mongodb://localhost:27017/io-example');
channel = client.channel('test');   // the channel is optional

io.adapter(mongoAdapter({
    pubsubClient: mubsub,
    channel: channel                // optional
}));
```

## Existing DB connection
You can inject an existing database connection, if you are _not_ injecting the `pubsubClient`.

```
var io = require('socket.io')(3000),
    MongoClient = require('mongodb').MongoClient,
    mongoAdapter = require('socket.io-mongodb'),
    client;

MongoClient.connect('mongodb://localhost:27017/io-example', function(err, db) {
    io.adapter(mongoAdapter({
        mongoClient: db
    }));
});
```

## Protocol
The `socket.io-mongodb` adapter broadcasts and receives messages on particularly named channels. For global broadcasts the channel name is:
```
prefix + '#' + namespace + '#'
```

In broadcasting to a single room the channel name is:
```
prefix + '#' + namespace + '#' + room + '#'
```

* **prefix**: a prefix to be used when publishing events (default is _socket-io_). You can change this by setting the `prefix` value in the constructor `options`
* **namespace**: see https://github.com/socketio/socket.io#namespace.
* **room** : used if targeting a specific room.


## License
MIT
