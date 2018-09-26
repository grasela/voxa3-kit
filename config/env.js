'use strict';

function getEnv() {
  return process.env.NODE_ENV || 'local';
}

module.exports = getEnv();
