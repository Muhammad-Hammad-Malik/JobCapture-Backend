const mongoose = require('mongoose');

let connectionPromise = null;

function connectDb() {
  if (mongoose.connection.readyState === 1) {
    return Promise.resolve(mongoose.connection);
  }
  if (!connectionPromise) {
    connectionPromise = mongoose.connect(process.env.MONGODB_URI).then(() => mongoose.connection);
  }
  return connectionPromise;
}

module.exports = { connectDb };
