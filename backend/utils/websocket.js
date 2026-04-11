/**
 * Phase 3.7: WebSocket support for real-time notifications
 * Broadcasts events to connected clients (work order updates, notifications, etc.)
 * Phase 1.3: Auth timeout (5s), IP rate limiting (10 conn/min), unauthenticated logging
 */
const { WebSocketServer } = require('ws');
const crypto = require('crypto');
const logger = require('./logger');
const jwt = require('jsonwebtoken');

const AUTH_TIMEOUT_MS = 5000;      // 5 seconds to authenticate
const MAX_CONN_PER_IP = 10;        // max connections per minute per IP
const RATE_WINDOW_MS = 60 * 1000;  // 1 minute
const MAX_MSG_PER_MIN = 30;        // V59: max messages per client per minute

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

  // Periodic cleanup of stale IP rate-limit entries (every 5 minutes)
  setInterval(() => {
    const now = Date.now();
    for (const [ip, entries] of ipConnections.entries()) {
      const active = entries.filter(e => now - e.ts < RATE_WINDOW_MS);
      if (active.length === 0) ipConnections.delete(ip);
      else ipConnections.set(ip, active);
    }
  }, 5 * 60 * 1000);

  wss.on('connection', (ws, req) => {
    const ip = getClientIP(req);

    // IP rate limiting
    if (!checkIPRate(ip)) {
      logger.warn('WebSocket IP rate limit exceeded', { ip });
      ws.close(1008, 'Rate limit exceeded');
      return;
    }

    const clientId = crypto.randomUUID();
    clients.set(ws, { clientId, connectedAt: new Date().toISOString(), authenticated: false, ip, msgCount: 0, msgWindowStart: Date.now() });

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
      // V59: Per-client message rate limiting
      const client = clients.get(ws);
      if (client) {
        const now = Date.now();
        if (now - client.msgWindowStart > RATE_WINDOW_MS) { client.msgCount = 0; client.msgWindowStart = now; }
        client.msgCount++;
        if (client.msgCount > MAX_MSG_PER_MIN) {
          logger.warn('WebSocket message rate limit exceeded', { clientId, ip });
          ws.close(1008, 'Message rate limit exceeded');
          return;
        }
      }
      try {
        const msg = JSON.parse(data.toString());
        // Handle auth message — require JWT token, not just userId
        if (msg.type === 'auth') {
          const client = clients.get(ws);
          if (client) {
            if (msg.token) {
              try {
                const { JWT_SECRET } = require('../middleware/auth');
                const decoded = jwt.verify(msg.token, JWT_SECRET);
                client.userId = decoded.id;
                client.username = decoded.username;
                client.authenticated = true;
                clearTimeout(authTimer);
              } catch {
                ws.close(1008, 'Invalid token');
              }
            } else if (msg.userId) {
              // V59: Always require JWT — no plaintext userId fallback
              ws.close(1008, 'Authentication token required');
            }
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
