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

```JavaScript
var io = require('socket.io')(3000),
    mongoAdapter = require('socket.io-mongodb'),
    adapter;

adapter = mongoAdapter('mongodb://localhost:27017/socket-io', {
    prefix: 'myprefix',
    collectionName: 'mypubsub'
});

io.adapter(adapter);
```

### adapter(opts)
The options described here can be passed in as the first argument, or as the second argument, when the first argument is your MongoDB connection string.

* **uri** (_required_ string or object): a MongoDB connection string, or a URI object that can be parsed by [mongodb-uri](https://github.com/mongolab/mongodb-uri-node)
* **prefix** (_optional_ string): a prefix to be used when publishing events (default is _socket-io_)
* **collectionName** (_optional_ string): the name of the MongoDB collection that mubsub should create/use (default is _pubsub_). This is ignored if the `mongoClient` or `pubsubClient` properties are defined.
* **mongoClient** (_optional_ instance of MongoDB node driver): the MongoDB driver to use. This is ignored if the `pubsubClient` is defined. @alsoSee [Existing database connection](https://github.com/losandes/socket.io-mongodb#existing-database-connection)
* **pubsubClient** (_optional_ instance of mubsub): the mubsub client to use. This can be replaced by another library that implements the `channel`, `channel.subscribe`, and `channel.publish` interfaces. @alsoSee [Custom client](https://github.com/losandes/socket.io-mongodb#custom-client)
* **channel** (_optional_ mubsub channel): the mubsub channel to use. This is only respected if the `pubsubClient` is also defined. @alsoSee [Custom client](https://github.com/losandes/socket.io-mongodb#custom-client)
* **messageEncoder** (_optional_ object): an object with `encode` and `decode` functions, to be used when encoding/decoding pubsub messages. The default uses `JSON.stringify` and `JSON.parse` to encode and decode, respectively. @alsoSee: [Overriding the messageEncoder](https://github.com/losandes/socket.io-mongodb#overriding-the-messageencoder)

```JavaScript
var io = require('socket.io')(3000),
    mongoAdapter = require('socket.io-mongodb'),
    adapter;
    //fs = require('fs'),
    //sslCA = [fs.readFileSync(__dirname + '/mySSLCA.pem')]; // you may want to switch this to `readFile` so as not to block - it's just here for example

adapter = mongoAdapter({
    "uri": {
        "hosts": [
            {
                "host": "db01.mysite.com",
                "port": 27017
            },
            {
                "host": "db02.mysite.com",
                "port": 27017
            }
        ],
        "username": "admin",
        "password": "password",
        "database": "socket-io",
        "options": {
            "authSource": "admin",
            "replicaSet": "myreplset",
            "ssl": true
        }
    },
    "server": {
        //"sslCA": sslCA
        "sslValidate": false
    },
    "replSet": {
        //"sslCA": sslCA
        "sslValidate": false
    }
    "prefix": 'myprefix',
    "collectionName": 'mypubsub'
});

io.adapter(adapter);
```

> The options that are described here are passed through to [mubsub](https://github.com/scttnlsn/mubsub), which in turn passes them to the [native MongoDB driver](https://github.com/mongodb/node-mongodb-native). So you can include options that are relevant to those libraries. Also, if you pass an object in as the `uri` property, it is processed by [mongodb-uri](https://github.com/mongolab/mongodb-uri-node).


## Client error handling
This adapter exposes the `pubsubClient` property (mubsub), as well as the `channel` that was created. You can bind to events on each of these resources:

```JavaScript
var io = require('socket.io')(3000),
    mongoAdapter = require('socket.io-mongodb'),
    adapter = mongoAdapter('mongodb://localhost:27017/socket-io');

io.adapter(adapter);
adapter.pubsubClient.on('error', console.error);
adapter.channel.on('error', console.error);
```


## Custom client
You can inject your own pubsub client (i.e. if you already have an instance of mubsub you wish to use), using the `pubsubClient` property of the options.

```JavaScript
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

## Existing database connection
You can inject an existing database connection, if you are _not_ injecting the `pubsubClient`.

```JavaScript
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

> The MongoClient is exposed as `db` on the adapter, so you can leverage it if you need to: `myAdapter.db`


## Overriding the messageEncoder
If you don't want or need to be able to read the message data in the database, you may benefit from overriding the messageEncoder. The following example uses `msgpack-js` to encode/decode the message data.

```JavaScript
var io = require('socket.io')(3000),
    mongoAdapter = require('socket.io-mongodb'),
    msgpack = require('msgpack-js');

io.adapter(mongoAdapter({
    uri: 'mongodb://localhost:27017/socket-io',
    messageEncoder: {
        encode: function (data) {
            return msgpack.encode(data);
        },
        decode: function (data) {
            return msgpack.decode(data.buffer);
        }
    }
}));
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
