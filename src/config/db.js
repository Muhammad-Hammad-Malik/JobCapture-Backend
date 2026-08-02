const mongoose = require('mongoose');

let connectionPromise = null;

function connectDb() {
  if (mongoose.connection.readyState === 1) {
    return Promise.resolve(mongoose.connection);
  }
  if (!connectionPromise) {
    connectionPromise = mongoose
      .connect(process.env.MONGODB_URI, {
        // Cap pool size per serverless instance — under concurrent Vercel invocations each
        // warm container holds its own pool, so this bounds total connections across instances
        // rather than letting each one open mongoose's default (larger) pool.
        maxPoolSize: 5,
        serverSelectionTimeoutMS: 10000,
      })
      .then(() => mongoose.connection)
      .catch((err) => {
        // Don't cache a rejected promise — otherwise a transient failure (e.g. Atlas briefly
        // unreachable) would permanently break every request on this warm container.
        connectionPromise = null;
        throw err;
      });
  }
  return connectionPromise;
}

module.exports = { connectDb };
