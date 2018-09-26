const AWS = require('aws-sdk');
const path = require('path');

const getEnv = () => process.env.NODE_ENV || process.env.STAGE || 'local';
const configFile = require(path.join(__dirname, `${getEnv()}.json`));

AWS.config.update(configFile.aws);

module.exports = configFile;
module.exports.asFunction = () => configFile;
