/**
 * Phase 3.7: WebSocket support for real-time notifications
 * Broadcasts events to connected clients (work order updates, notifications, etc.)
 * Phase 1.3: Auth timeout (5s), IP rate limiting (10 conn/min), unauthenticated logging
 */
const { WebSocketServer } = require('ws');
const crypto = require('crypto');
const logger = require('./logger');

const AUTH_TIMEOUT_MS = 5000;      // 5 seconds to authenticate
const MAX_CONN_PER_IP = 10;        // max connections per minute per IP
const RATE_WINDOW_MS = 60 * 1000;  // 1 minute

let wss = null;
const clients = new Map(); // ws -> { userId, username, connectedAt, clientId, authenticated }
const ipConnections = new Map(); // ip -> [{ ts }]

function getClientIP(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
}

function checkIPRate(ip) {
  const now = Date.now();
  let entries = ipConnections.get(ip) || [];
  entries = entries.filter(e => now - e.ts < RATE_WINDOW_MS);
  ipConnections.set(ip, entries);
  if (entries.length >= MAX_CONN_PER_IP) return false;
  entries.push({ ts: now });
  return true;
}

function initWebSocket(server) {
  wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    const ip = getClientIP(req);

    // IP rate limiting
    if (!checkIPRate(ip)) {
      logger.warn('WebSocket IP rate limit exceeded', { ip });
      ws.close(1008, 'Rate limit exceeded');
      return;
    }

    const clientId = crypto.randomUUID();
    clients.set(ws, { clientId, connectedAt: new Date().toISOString(), authenticated: false, ip });

    // 5-second auth timeout — close if not authenticated
    const authTimer = setTimeout(() => {
      const client = clients.get(ws);
      if (client && !client.authenticated) {
        logger.warn('WebSocket auth timeout — closing unauthenticated connection', { clientId, ip });
        ws.close(1008, 'Authentication timeout');
        clients.delete(ws);
      }
    }, AUTH_TIMEOUT_MS);

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        // Handle auth message to associate user
        if (msg.type === 'auth' && msg.userId) {
          const client = clients.get(ws);
          if (client) {
            client.userId = msg.userId;
            client.username = msg.username;
            client.authenticated = true;
            clearTimeout(authTimer);
          }
        }
      } catch {
        // Ignore malformed messages
      }
    });

    ws.on('close', () => {
      clearTimeout(authTimer);
      clients.delete(ws);
    });

    ws.on('error', () => {
      clearTimeout(authTimer);
      clients.delete(ws);
    });

    // Send welcome message
    ws.send(JSON.stringify({ type: 'connected', clientId }));
  });

  return wss;
}

/**
 * Broadcast an event to all connected clients (or filtered by userId)
 */
function broadcast(event, data, targetUserId) {
  if (!wss) return;
  const message = JSON.stringify({ type: 'event', event, data, timestamp: new Date().toISOString() });

  for (const [ws, client] of clients.entries()) {
    if (ws.readyState !== 1) continue; // OPEN = 1
    if (targetUserId && client.userId !== targetUserId) continue;
    try { ws.send(message); } catch {}
  }
}

/**
 * Get connected client count
 */
function getClientCount() {
  if (!wss) return 0;
  let count = 0;
  for (const ws of clients.keys()) {
    if (ws.readyState === 1) count++;
  }
  return count;
}

module.exports = { initWebSocket, broadcast, getClientCount };
