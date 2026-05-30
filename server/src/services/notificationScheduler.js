const { notifyOverdueActions } = require('./emailService');
const { logger } = require('../utils/logger');

exports.scheduleOverdueNotifications = async () => {
  logger.info('Checking for overdue incident action items...');
  await notifyOverdueActions();
};
