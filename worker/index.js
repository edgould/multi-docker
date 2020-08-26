// keys holds host names and ports
const keys = require('./keys');
const redis = require('redis');

// retry every second, or 1000 ms
const redisClient = redis.createClient({
    host: keys.redisHost,
    port: keys.redisPort,
    retry_strategy: () => 1000
});

const sub = redisClient.duplicate();

// recursion to produce work
function fib(index) {
    if (index < 2) return 1;
    return fib(index - 1) + fib(index - 2);
}

// get a message
sub.on('message',(channel, message) => {
    //sends a hash with message as key (number we are calculating fibonacci for), 
    // and the fib value as value
    redisClient.hset('values',message,fib(parseInt(message)));
});

// listen for insert events on the redisClient
sub.subscribe('insert');