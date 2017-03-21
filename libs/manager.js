const _ = require('lodash');
const wswrapper = require('./ws_wrapper');
const wsUrl = 'wss://api2.poloniex.com';
const Market = require('./market');
const debug = require('debug')('polobook:manager');
const EventEmitter = require('events');

//if heartbeat is older than TIMEOUT,
// treat it as socket has died
//const SOCKET_TIMEOUT = 5000;

class PoloManager extends EventEmitter {
  constructor() {
    super();
    this.markets = {};
  }

  /**
   *
   * @param {String} pair
   * @returns {Market}
   */
  market(pair) {
    if (!(pair in this.markets)) {
      debug('make market', pair);
      this.markets[pair] = new Market(pair, this);
      this.socket.subscribe(pair);
    }

    return this.markets[pair];
  }

  /**
   *
   * @param pair
   */
  remove(pair) {
    if (pair in this.markets) {
      if (this.markets[pair].validPair) {
        this.socket.unsubscribe(pair);
      }
      delete this.markets[pair].manager;
      delete this.markets[pair];
    }
  }

  /**
   *
   * @returns {PoloManager}
   */
  connect() {
    debug('connect');

    this.socket = new wswrapper(wsUrl);

    const manager = this;
    const proxyMethod = (method) => function (pair) {
      const market = manager.markets[pair];
      market && market[method].apply(market, arguments);
    };

    this.socket.on('initialize', proxyMethod('initialize'));
    this.socket.on('order', proxyMethod('order'));
    //this.socket.on('history', proxyMethod('history'));

    //this.socket.on('unsubscribed', _.noop)

    this.socket.on('error', msg => {
      if (msg.error === 'Invalid channel.') {
        const markets = _.filter(this.markets, m => m.validPair === null);

        // there is only one market awaited validation
        if (markets.length === 1) {
          markets.pop().setValid(false);
        }
      }
    });

    return this;
  }

  /**
   *
   * @returns {PoloManager}
   */
  disconnect() {
    debug('disconnect');

    this.socket.close();
    this.socket.removeAllListeners();
    return this;
  }

  /**
   *
   */
  restartConnection() {
    this.disconnect().connect();

    _.keys(this.markets).forEach(channel => {
      this.socket.subscribe(channel);
    })
  }
}

module.exports = PoloManager;