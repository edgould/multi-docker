const keys = require('./keys');

//Express app setup
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

// Create a new express application
// responds to any http requests from react application
const app = express();
//Cross Origin Resource Sharing
// Allows requests from one domain (react) to a different domain or port, as we are
// doing in this application, than the express api is hosted on
app.use(cors());
// Parses requests from react app and turn the body of the post request
// into a json value that the express api can work with easily
app.use(bodyParser.json());

// Postgres Client setup
const {Pool} = require('pg');
const pgClient = new Pool ({
    user: keys.pgUser,
    host : keys.pgHost,
    database : keys.pgDatabase,
    password : keys.pgPassword,
    port : keys.pgPort
});

// Create table to hold the values
pgClient.on('connect',() => {
pgClient.query('CREATE TABLE IF NOT EXISTS values (number INT)')
        .catch((err)=> console.log('Could not create table: ' + err));
});

// Redis Client setup
const redis = require('redis');
const redisClient = redis.createClient({
    host: keys.redisHost,
    port: keys.redisPort,
    retry_strategy : () => 1000

});

// Needed by doc, if you have a client that is listening or publishing, you have to make a duplicate
// for you can't use the same channel for both listening and publishing
const redisPublisher = redisClient.duplicate();

// Express route handlers

//Test route
app.get('/', (req,res) => {
    res.send('Hi');
});

// retrieve all values submitted to postgres
app.get('/values/all',async(req, res) => {
    const values = await pgClient.query('Select * from values')
                                  .catch((err)=> console.log('Could not select all values from table: ' + err));


    res.send(values.rows);
});

// calls redis to get all indices and the calculated values
app.get('/values/current',async(req,res) =>{
    // redis does not support promise (await as does postgres) so we have
    // to use callbacks
    // retrieve the all hash table values entries
    redisClient.hgetall('values',(err,values) => {
        res.send(values);
    });
});

// receive new values from the react app
app.post('/values',async(req,res) =>{
    const index = req.body.index;
    // To reduce time constraints, don't allow for index > 40
    if (parseInt(index) > 40) {
        return res.status(422).send('index too large');
    }

    // Use 'Nothing yet!' as a place holder to show that the 
    // Fib is being calculated
    redisClient.hset('values',index, 'Nothing yet!');
    // Wakes up worker process
    redisPublisher.publish('insert',index);

    pgClient.query('INSERT INTO values(number) VALUES($1)', [index]);

    // send a status back to react app
    res.send({working : true});
});

// Set app to listen on a port
app.listen(5000,err => {
    console.log('Listening');
});
