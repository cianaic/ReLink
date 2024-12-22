import { Redis } from '@upstash/redis';

// Initialize Redis client
const redis = new Redis({
  url: process.env.REACT_APP_UPSTASH_REDIS_URL,
  token: process.env.REACT_APP_UPSTASH_REDIS_TOKEN,
});

export default redis; 