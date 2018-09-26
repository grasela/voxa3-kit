'use strict';

const path = require('path');
const env = require('./env').toLowerCase();

const configFile = require(path.join(__dirname, `${env}.json`));
configFile.env = env;

const AWS = require('aws-sdk');

AWS.config.update(configFile.aws);

module.exports = configFile;
module.exports.asFunction = () => configFile;
