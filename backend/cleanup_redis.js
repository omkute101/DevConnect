
const { Redis } = require('ioredis');

// Default to localhost if no ENV provided
const url = process.env.REDIS_URL || 'redis://localhost:6379';
console.log('Connecting to Redis at:', url);

const redis = new Redis(url);

async function cleanup() {
  try {
    console.log('Scanning for session keys...');
    const keys = await redis.keys('session:*');
    console.log(`Found ${keys.length} session keys.`);
    
    let deleted = 0;
    for (const key of keys) {
      const type = await redis.type(key);
      console.log(`Key ${key} has type: ${type}`);
      
      // Delete if it's a string (the bad type) OR just delete all to be safe
      // We will delete ALL session keys to ensure a clean slate
      await redis.del(key);
      deleted++;
    }
    console.log(`Successfully deleted ${deleted} session keys.`);

    // Also clear socket keys just in case
    const socketKeys = await redis.keys('socket:*');
    if (socketKeys.length > 0) {
      await redis.del(...socketKeys);
      console.log(`Deleted ${socketKeys.length} socket keys.`);
    }

  } catch (err) {
    console.error('Error during cleanup:', err);
  } finally {
    redis.quit();
  }
}

cleanup();
