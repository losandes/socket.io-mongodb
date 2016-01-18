# socket.io-mongodb
A MongoDB Adapter for socket.io


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
//      mubsubClient: (mubsub client)
//      mongodbDriver: (an existing native mongodb driver)
//      prefix: (the prefix to be used when creating rooms)
//      collectionName: (the name of the collection/mubsub channel )
//}
