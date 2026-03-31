/**
 * Phase 3.7: WebSocket support for real-time notifications
 * Broadcasts events to connected clients (work order updates, notifications, etc.)
 */
const { WebSocketServer } = require('ws');
const crypto = require('crypto');

let wss = null;
const clients = new Map(); // ws -> { userId, username, connectedAt }

function initWebSocket(server) {
  wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    const clientId = crypto.randomUUID();
    clients.set(ws, { clientId, connectedAt: new Date().toISOString() });

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        // Handle auth message to associate user
        if (msg.type === 'auth' && msg.userId) {
          const client = clients.get(ws);
          if (client) {
            client.userId = msg.userId;
            client.username = msg.username;
          }
        }
      } catch {
        // Ignore malformed messages
      }
    });

    ws.on('close', () => {
      clients.delete(ws);
    });

    ws.on('error', () => {
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
