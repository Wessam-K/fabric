/**
 * Backend Logger — Winston-based structured logger with daily rotation
 * Falls back to console in test mode to avoid file I/O during tests
 */
const path = require('path');

const SENSITIVE_KEYS = ['password', 'token', 'jwt', 'secret', 'authorization', 'cookie'];

function redactSensitive(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const result = Array.isArray(obj) ? [...obj] : { ...obj };
  for (const key of Object.keys(result)) {
    if (SENSITIVE_KEYS.some(s => key.toLowerCase().includes(s))) {
      result[key] = '[REDACTED]';
    } else if (typeof result[key] === 'object' && result[key] !== null) {
      result[key] = redactSensitive(result[key]);
    }
  }
  return result;
}

let logger;

if (process.env.NODE_ENV === 'test') {
  // Lightweight console logger for tests
  const LOG_LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
  const LEVEL = LOG_LEVELS[process.env.LOG_LEVEL || 'info'] ?? 2;
  function timestamp() { return new Date().toISOString(); }
  function fmt(level, msg, meta) {
    const base = `[${timestamp()}] [${level.toUpperCase()}] ${msg}`;
    return meta && Object.keys(meta).length ? `${base} ${JSON.stringify(redactSensitive(meta))}` : base;
  }
  logger = {
    info(msg, meta) { if (LEVEL >= 2) console.log(fmt('info', msg, meta)); },
    warn(msg, meta) { if (LEVEL >= 1) console.warn(fmt('warn', msg, meta)); },
    error(msg, meta) { console.error(fmt('error', msg, meta)); },
    debug(msg, meta) { if (LEVEL >= 3) console.log(fmt('debug', msg, meta)); },
  };
} else {
  const winston = require('winston');
  const DailyRotateFile = require('winston-daily-rotate-file');
  const logDir = path.join(process.env.WK_DB_DIR || path.join(__dirname, '..'), 'logs');
  const fs = require('fs');
  if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

  const logFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ timestamp, level, message, requestId, ...meta }) => {
      const rid = requestId ? ` [${requestId}]` : '';
      const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(redactSensitive(meta))}` : '';
      return `${timestamp} ${level.toUpperCase()}${rid}: ${message}${metaStr}`;
    })
  );

  logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: logFormat,
    transports: [
      new DailyRotateFile({
        dirname: logDir,
        filename: 'wk-backend-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        maxSize: '10m',
        maxFiles: '30d',
        zippedArchive: true,
      }),
      new DailyRotateFile({
        dirname: logDir,
        level: 'error',
        filename: 'error-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        maxSize: '10m',
        maxFiles: '60d',
        zippedArchive: true,
      }),
      new winston.transports.Console({
        format: winston.format.combine(winston.format.colorize(), logFormat),
      }),
    ],
  });
}

module.exports = logger;
