const winston = require('winston');

const { combine, timestamp, printf, colorize, errors } = winston.format;

const fmt = printf(({ level, message, timestamp: ts, stack }) =>
  `${ts} [${level}]: ${stack || message}`
);

exports.logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'warn' : 'info',
  format: combine(errors({ stack: true }), timestamp(), colorize(), fmt),
  transports: [new winston.transports.Console()],
});
