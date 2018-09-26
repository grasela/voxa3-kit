'use strict';

const AWS = require('aws-sdk');
const debug = require('debug')('storage');
const moment = require('moment-timezone');


class Storage {
  constructor(table) {
    this.client = new AWS.DynamoDB.DocumentClient();
    this.table = table;
    debug('UserStorage Table: %s', this.table);
  }

  get(user) {
    debug('get', user);
    const userId = user.userId;
    return this.client.get({
      TableName: this.table,
      Key: { userId },
    }).promise().then(item => item.Item);
  }

  put(data) {
    debug('put', JSON.stringify(data, null, 2));
    if (!data.createdDate) {
      data.createdDate = moment().toISOString();
    }

    data.modifiedDate = moment().toISOString();

    return this.client.put({
      TableName: this.table,
      Item: data,
    }).promise();
  }

  delete(data) {
    debug('delete', JSON.stringify(data, null, 2));

    return this.client.delete({
      TableName: this.table,
      Key: data,
    }).promise();
  }
}

module.exports = Storage;