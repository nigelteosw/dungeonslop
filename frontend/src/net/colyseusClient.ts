import { Client } from 'colyseus.js';

// VITE_SERVER_URL is the source of truth; the localhost fallback exists only
// so local dev works without a .env file, per the "never hardcode, env
// default only" rule.
const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'ws://localhost:2567';

export const colyseusClient = new Client(SERVER_URL);
