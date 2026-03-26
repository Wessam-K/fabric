const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');
const fs = require('fs');

let logDir = null;
let logger = null;
let auditLogger = null;

// Sensitive fields to redact
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

// Error code taxonomy
const ERROR_CODES = {
  // 1xxx - Application errors
  APP_START_FAILED: { code: 1001, severity: 'critical' },
  APP_CRASH: { code: 1002, severity: 'critical' },
  BACKEND_START_FAILED: { code: 1003, severity: 'critical' },
  BACKEND_CRASH: { code: 1004, severity: 'error' },
  BACKEND_RESTART: { code: 1005, severity: 'warn' },

  // 2xxx - Database errors
  DB_OPEN_FAILED: { code: 2001, severity: 'critical' },
  DB_MIGRATION_FAILED: { code: 2002, severity: 'critical' },
  DB_BACKUP_FAILED: { code: 2003, severity: 'error' },
  DB_BACKUP_SUCCESS: { code: 2004, severity: 'info' },
  DB_QUERY_ERROR: { code: 2005, severity: 'error' },

  // 3xxx - Auth errors
  AUTH_LOGIN_FAILED: { code: 3001, severity: 'warn' },
  AUTH_LOGIN_SUCCESS: { code: 3002, severity: 'info' },
  AUTH_ACCOUNT_LOCKED: { code: 3003, severity: 'warn' },
  AUTH_TOKEN_EXPIRED: { code: 3004, severity: 'info' },

  // 4xxx - Security
  SECURITY_CSP_VIOLATION: { code: 4001, severity: 'warn' },
  SECURITY_NAVIGATION_BLOCKED: { code: 4002, severity: 'warn' },
  SECURITY_DEBUG_ATTEMPT: { code: 4003, severity: 'warn' },

  // 5xxx - IPC
  IPC_INVALID_CHANNEL: { code: 5001, severity: 'warn' },
  IPC_ERROR: { code: 5002, severity: 'error' },
};

/**
 * Initialize the logger. Must be called once with the log directory path.
 */
function initLogger(logsPath) {
  logDir = logsPath;
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  const logFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ timestamp, level, message, code, ...meta }) => {
      const codeStr = code ? ` [${code}]` : '';
      const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(redactSensitive(meta))}` : '';
      return `${timestamp} ${level.toUpperCase()}${codeStr}: ${message}${metaStr}`;
    })
  );

  // Main application logger
  logger = winston.createLogger({
    level: 'info',
    format: logFormat,
    transports: [
      // Combined log — all levels
      new DailyRotateFile({
        dirname: logDir,
        filename: 'wk-hub-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        maxSize: '10m',
        maxFiles: '30d',
        zippedArchive: true,
      }),
      // Error-only log
      new DailyRotateFile({
        dirname: logDir,
        level: 'error',
        filename: 'error-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        maxSize: '10m',
        maxFiles: '60d',
        zippedArchive: true,
      }),
    ],
  });

  // Console transport in development
  if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        logFormat
      ),
    }));
  }

  // Separate audit logger for security-related events
  auditLogger = winston.createLogger({
    level: 'info',
    format: logFormat,
    transports: [
      new DailyRotateFile({
        dirname: logDir,
        filename: 'audit-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        maxSize: '5m',
        maxFiles: '90d',
        zippedArchive: true,
      }),
    ],
  });

  logger.info('Logger initialized', { logDir });
  return { logger, auditLogger };
}

/**
 * Log a categorized error with its error code
 */
function logError(errorKey, message, meta = {}) {
  const errDef = ERROR_CODES[errorKey];
  if (!errDef) {
    getLogger().error(message, { unknownErrorKey: errorKey, ...meta });
    return;
  }
  const lvl = errDef.severity === 'critical' ? 'error' : errDef.severity;
  getLogger().log(lvl, message, { code: errDef.code, errorKey, ...meta });
}

/**
 * Log an audit event (login, security, admin actions)
 */
function logAudit(action, details = {}) {
  getAuditLogger().info(action, redactSensitive(details));
}

function getLogger() {
  if (!logger) {
    // Fallback console logger if not initialized
    return console;
  }
  return logger;
}

function getAuditLogger() {
  if (!auditLogger) return console;
  return auditLogger;
}

function getLogDir() {
  return logDir;
}

module.exports = {
  initLogger,
  getLogger,
  getAuditLogger,
  logError,
  logAudit,
  redactSensitive,
  ERROR_CODES,
  getLogDir,
};
