const { PrismaClient } = require('@prisma/client');
const { logger } = require('./logger');

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development'
    ? [{ emit: 'event', level: 'error' }]
    : [{ emit: 'event', level: 'error' }],
});

prisma.$on('error', (e) => logger.error('Prisma error:', e));

module.exports = prisma;
