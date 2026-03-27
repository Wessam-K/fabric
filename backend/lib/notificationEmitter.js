const EventEmitter = require('events');

class NotificationEmitter extends EventEmitter {}
const emitter = new NotificationEmitter();
emitter.setMaxListeners(100);

module.exports = emitter;
