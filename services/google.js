'use strict';

const _ = require('lodash');

exports.isGoogle = voxaEvent => voxaEvent.platform !== 'alexa';

exports.isGoogleAssistantDevice = (voxaEvent) => {
  const capabilities = _.get(voxaEvent, 'rawEvent.originalDetectIntentRequest.payload.surface.capabilities');
  return _.find(capabilities, { name: 'actions.capability.SCREEN_OUTPUT' });
};

exports.isGoogleVoiceOnlyDevice = voxaEvent => !exports.isGoogleAssistantDevice(voxaEvent);

exports.getSigninStatus = (voxaEvent) => {
  const payload = _.get(voxaEvent, 'intent.params.SIGN_IN.status');

  return payload;
};

exports.isPersonalResultsEnabled = voxaEvent => !!_.get(voxaEvent.user, 'last.seen');
