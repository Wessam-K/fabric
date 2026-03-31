/**
 * Phase 3.6: Webhook event system
 * Stores webhook subscriptions in DB and fires HTTP callbacks on events
 */
const crypto = require('crypto');
const db = require('../database');

// Ensure webhooks table exists
db.exec(`CREATE TABLE IF NOT EXISTS webhooks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  secret TEXT,
  events TEXT NOT NULL DEFAULT '[]',
  created_by INTEGER,
  created_at TEXT DEFAULT (datetime('now','localtime')),
  status TEXT DEFAULT 'active' CHECK(status IN ('active','inactive')),
  last_triggered_at TEXT,
  failure_count INTEGER DEFAULT 0,
  FOREIGN KEY (created_by) REFERENCES users(id)
)`);

db.exec(`CREATE TABLE IF NOT EXISTS webhook_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  webhook_id INTEGER NOT NULL,
  event TEXT NOT NULL,
  payload TEXT,
  response_status INTEGER,
  response_body TEXT,
  success INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now','localtime')),
  FOREIGN KEY (webhook_id) REFERENCES webhooks(id)
)`);

/**
 * Fire a webhook event — sends POST to all active webhooks subscribed to this event
 * Non-blocking: errors are logged but don't halt the caller
 */
async function fireWebhook(event, payload) {
  try {
    const hooks = db.prepare(
      "SELECT * FROM webhooks WHERE status='active'"
    ).all().filter(h => {
      const events = JSON.parse(h.events || '[]');
      return events.includes(event) || events.includes('*');
    });

    for (const hook of hooks) {
      const body = JSON.stringify({ event, timestamp: new Date().toISOString(), data: payload });
      const headers = { 'Content-Type': 'application/json' };

      // HMAC signing if secret is set
      if (hook.secret) {
        const sig = crypto.createHmac('sha256', hook.secret).update(body).digest('hex');
        headers['X-Webhook-Signature'] = `sha256=${sig}`;
      }

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        const resp = await fetch(hook.url, {
          method: 'POST',
          headers,
          body,
          signal: controller.signal,
        });
        clearTimeout(timeout);

        const respText = await resp.text().catch(() => '');
        db.prepare(`INSERT INTO webhook_logs (webhook_id, event, payload, response_status, response_body, success) VALUES (?,?,?,?,?,?)`)
          .run(hook.id, event, body, resp.status, respText.slice(0, 1000), resp.ok ? 1 : 0);
        db.prepare('UPDATE webhooks SET last_triggered_at=datetime("now","localtime"), failure_count=CASE WHEN ?=1 THEN 0 ELSE failure_count+1 END WHERE id=?')
          .run(resp.ok ? 1 : 0, hook.id);

        // Auto-disable after 10 consecutive failures
        if (!resp.ok) {
          const updated = db.prepare('SELECT failure_count FROM webhooks WHERE id=?').get(hook.id);
          if (updated && updated.failure_count >= 10) {
            db.prepare("UPDATE webhooks SET status='inactive' WHERE id=?").run(hook.id);
          }
        }
      } catch (err) {
        db.prepare(`INSERT INTO webhook_logs (webhook_id, event, payload, response_status, response_body, success) VALUES (?,?,?,?,?,0)`)
          .run(hook.id, event, JSON.stringify({ event, data: payload }), 0, err.message?.slice(0, 500) || 'fetch error');
        db.prepare('UPDATE webhooks SET failure_count=failure_count+1 WHERE id=?').run(hook.id);
      }
    }
  } catch (err) {
    console.error('Webhook fire error:', err.message);
  }
}

/**
 * CRUD helpers for webhook management
 */
function createWebhook(name, url, events, secret, createdBy) {
  const result = db.prepare('INSERT INTO webhooks (name, url, events, secret, created_by) VALUES (?,?,?,?,?)')
    .run(name, url, JSON.stringify(events), secret || null, createdBy);
  return result.lastInsertRowid;
}

function listWebhooks() {
  return db.prepare("SELECT id, name, url, events, status, created_at, last_triggered_at, failure_count FROM webhooks ORDER BY created_at DESC").all();
}

function deleteWebhook(id) {
  db.prepare('DELETE FROM webhook_logs WHERE webhook_id=?').run(id);
  return db.prepare('DELETE FROM webhooks WHERE id=?').run(id);
}

function getWebhookLogs(webhookId, limit = 50) {
  return db.prepare('SELECT * FROM webhook_logs WHERE webhook_id=? ORDER BY created_at DESC LIMIT ?').all(webhookId, limit);
}

module.exports = { fireWebhook, createWebhook, listWebhooks, deleteWebhook, getWebhookLogs };
