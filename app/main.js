'use strict';

const _ = require('lodash');
const config = require('../config');
const Voxa = require('voxa');
const voxaGA = require('voxa-ga');
const voxaDashbot = require('voxa-dashbot');
const Storage = require('../services/Storage');
// const User = require('../services/User');
const debug = require('debug')('voxa');
const Promise = require('bluebird');
const Raven = require('raven');
const api = require('../services/api');
const log = require('lambda-log');

// Array of states to be use in the app
const states = [
  require('./states/launch.states'),
  require('./states/exit.states'),
  require('./states/help.states'),
  require('./states/unsupported.states'),
];

function register(app) {
  states.forEach(state => state.register(app));

  app.onRequestStarted(logStart);
  app.onIntentRequest(logIntent);
  app.onAfterStateChanged(logTransition);
  app.onBeforeReplySent(logReply);

  app.onRequestStarted(startTimer);
  app.onBeforeReplySent(clearTimer);

  // Init app handlers
  app.onRequestStarted(getUserFromDB);
  // app.onRequestStarted(initUser);

  app.onIntentRequest(sendEventIntent);

  app.onUnhandledState(onUnhandledState);

  // Error Handler
  app.onError(errorHandler);

  app.onBeforeReplySent(saveLastReply);
  app.onBeforeReplySent(saveLastVisit);
  app.onBeforeReplySent(saveUserToDynamo);

  Voxa.plugins.stateFlow(app);
  Voxa.plugins.replaceIntent(app);

  // Analytics
  // voxaGA(app, config.googleAnalytics);
  // voxaDashbot(app, config.dashbot);

  function startTimer(voxaEvent, reply) {
    const context = voxaEvent.executionContext;
    if (!context.getRemainingTimeInMillis) { return; }
    const timeRemaining = context.getRemainingTimeInMillis();
    voxaEvent.timeoutError = setTimeout(async () => {
      const { user } = voxaEvent.model;
      const replies = {
        ACCOUNT_SUBSCRIBED: 'TimeOut_AuthSub',
        AUTH_FREE: 'TimeOut_AuthFree',
        NO_AUTH: 'TimeOut_Unsubscribed',
      };

      const statement = await voxaEvent.renderer.renderPath(`${replies[user.userType]}.ask`, voxaEvent);
      const reprompt = await voxaEvent.renderer.renderPath(`${replies[user.userType]}.reprompt`, voxaEvent);

      reply.clear();
      reply.addStatement(statement);
      reply.addReprompt(reprompt);

      context.succeed(reply);
    }, Math.max(timeRemaining - 500, 0));
  }

  function clearTimer(voxaEvent) {
    if (voxaEvent.timeoutError) {
      clearTimeout(voxaEvent.timeoutError);
    }
  }

  async function getUserFromDB(voxaEvent) {
    const store = new Storage(config.dynamoDB.tables.users);
    const userId = _.get(voxaEvent, 'context.System.user.userId') || voxaEvent.user.userId;
    const user = await store.get({ userId });
    _.set(voxaEvent, 'model.user', user);
  }

  // Handler functions
  async function errorHandler(event, err, reply) {
    event.log.error(err);
    await Promise.promisify(Raven.captureException, { context: Raven })(err);
    const statement = await event.renderer.renderPath('Exit_Msg.tell', event);
    reply.clear();
    reply.addStatement(statement);
    reply.terminate();
    return reply;
  }

  function saveLastVisit(voxaEvent) {
    if (voxaEvent.intent.name !== 'ResetIntent') {
      _.set(voxaEvent, 'model.user.lastVisit', voxaEvent.model.nowISO);
    }
  }

  function saveUserToDynamo(voxaEvent) {
    const store = new Storage(config.dynamoDB.tables.users);
    const userId = voxaEvent.user.userId;
    _.set(voxaEvent, 'model.user.userId', userId);
    _.unset(voxaEvent, 'model.user.accessToken');

    const intentName = voxaEvent.intent.name;
    const excludedIntents = [
      'TestReset',
      'AlexaSkillEvent.SkillDisabled',
      'AlexaSkillEvent.SkillEnabled',
    ];

    if (!_.includes(excludedIntents, intentName)) {
      return store.put(voxaEvent.model.user);
    }
  }

  function saveLastReply(request, reply, transition) {
    debug(JSON.stringify(reply, null, 2));
    const directives = _.get(reply, 'msg.directives');

    request.model.reply = _.pickBy({
      say: transition.say,
      to: transition.to.name,
      flow: transition.flow,
    });

    if (transition.dialogFlowMediaResponse) {
      request.model.reply.dialogFlowMediaResponse = transition.dialogFlowMediaResponse;
      request.model.reply.dialogFlowSuggestions = transition.dialogFlowSuggestions;
    }
  }

  // async function initUser(request) {
  //   if (request.intent && _.includes(audioPlayerRequest, request.intent.name)) {
  //     _.set(request, 'session.new', true);
  //   }

  //   const userId = _.get(request, 'context.System.user.userId') || request.user.userId;
  //   const accessToken = _.get(request, 'context.System.user.accessToken') || request.user.accessToken;

  //   const user = new User(request.model.user);
  //   _.set(user, 'userId', userId);
  //   _.set(user, 'accessToken', accessToken);

  //   await user.loadUserType(request);
  //   _.set(request, 'model.user', user);
  // }


  function sendEventIntent(request) {
    return api.event('INTENT', request);
  }

  function onUnhandledState(voxaEvent, reply) {
    debug('unhandled', voxaEvent.intent.name);
    const directives = _.get(voxaEvent, 'session.attributes.reply.directives');
    const context = _.get(voxaEvent, 'rawEvent.result.contexts');
    const isMediaStatus = _.find(context, { name: 'actions_intent_media_status' });

    if (voxaEvent.intent && _.includes(audioPlayerRequest, voxaEvent.intent.name)) {
      return { flow: 'terminate' };
    }

    if (isMediaStatus && isMediaStatus.parameters.MEDIA_STATUS.status === 'FINISHED') {
      return { to: 'MEDIA_STATUS' };
    }

    if (isMediaStatus) {
      return { to: 'LaunchIntent' };
    }

    if (voxaEvent.session.new) {
      return { to: 'LaunchIntent' };
    }

    if (voxaEvent.intent.name === 'Display.ElementSelected') return { to: 'Display.ElementSelected' };

    // Close on negation/cancel/stop intents
    if (_.includes(['NoIntent'], voxaEvent.intent.name)) {
      return { to: 'exit' };
    }

    const lastReply = voxaEvent.model.reply.ask;
    reply = _.isArray(lastReply) ? _.last(lastReply) : lastReply;

    const response = {
      to: voxaEvent.model.reply.to,
      ask: _.filter(_.concat('Error.BadInput.say', reply)),
      directives,
    };

    return response;
  }
}

function logIntent(voxaEvent) {
  voxaEvent.log.info('Intent Request', { intent: voxaEvent.intent.name, params: voxaEvent.intent.params });
}

function logStart(voxaEvent) {
  const debugEnabled = _.includes(process.env.DEBUG, 'voxa');
  voxaEvent.log = new log.LambdaLog({
    requestId: voxaEvent.executionContext.awsRequestId,
    sessionId: voxaEvent.session.id,
  });

  voxaEvent.log.config.debug = debugEnabled;
  voxaEvent.log.config.dev = config.env === 'local';

  const event = _.cloneDeep(voxaEvent.rawEvent);

  voxaEvent.log.info('Got new event', { event });
  voxaEvent.log.debug('DEBUG is enabled');
}

function logReply(voxaEvent, reply) {
  const renderedReply = _.cloneDeep(reply);
  delete renderedReply.sessionAttributes;
  voxaEvent.log.info('Sent reply', { reply: renderedReply });
}

function logTransition(voxaEvent, reply, transition) {
  const clonedTransition = _.cloneDeep(transition);
  voxaEvent.log.info('Transition', { transition: clonedTransition });
}

module.exports.register = register;
