const Queue = require('bull');

const redisOptions = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT) : 6379
};

const emailQueue = new Queue('emailQueue', { connection: redisOptions });

module.exports = emailQueue;
