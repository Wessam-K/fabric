/**
 * Backend Logger — lightweight structured logger for server.js
 * Uses console with structured output. No external dependencies.
 */
const fs = require('fs');
const path = require('path');

const LOG_LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const LEVEL = LOG_LEVELS[process.env.LOG_LEVEL || 'info'] ?? 2;

function timestamp() {
  return new Date().toISOString();
}

function formatMessage(level, msg, meta) {
  const base = `[${timestamp()}] [${level.toUpperCase()}] ${msg}`;
  if (meta && Object.keys(meta).length > 0) {
    return `${base} ${JSON.stringify(meta)}`;
  }
  return base;
}

const logger = {
  info(msg, meta) {
    if (LEVEL >= LOG_LEVELS.info) console.log(formatMessage('info', msg, meta));
  },
  warn(msg, meta) {
    if (LEVEL >= LOG_LEVELS.warn) console.warn(formatMessage('warn', msg, meta));
  },
  error(msg, meta) {
    if (LEVEL >= LOG_LEVELS.error) console.error(formatMessage('error', msg, meta));
  },
  debug(msg, meta) {
    if (LEVEL >= LOG_LEVELS.debug) console.log(formatMessage('debug', msg, meta));
  },
};

module.exports = logger;
