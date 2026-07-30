module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [
      2,
      'always',
      [
        'web', // apps/web changes
        'shared', // packages/shared changes
        'db', // database migrations
        'auth', // authentication feature
        'loads', // loads feature
        'trucks', // trucks feature
        'bookings', // booking workflow
        'messages', // messaging feature
        'notifications', // notifications
        'payments', // Stripe, invoicing
        'verify', // carrier verification
        'analytics', // analytics/reporting
        'ci', // CI/CD changes
        'docs', // documentation
        'deps', // dependency updates
        'config', // configuration files
      ],
    ],
    'scope-empty': [1, 'never'],
  },
};
