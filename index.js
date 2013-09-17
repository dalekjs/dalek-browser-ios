/*!
 *
 * Copyright (c) 2013 Sebastian Golasch
 *
 * Permission is hereby granted, free of charge, to any person obtaining a
 * copy of this software and associated documentation files (the "Software"),
 * to deal in the Software without restriction, including without limitation
 * the rights to use, copy, modify, merge, publish, distribute, sublicense,
 * and/or sell copies of the Software, and to permit persons to whom the
 * Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included
 * in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
 * OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL
 * THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
 * DEALINGS IN THE SOFTWARE.
 *
 */

'use strict';

// ext. libs
var Q = require('q');
var os = require('os');
var cp = require('child_process');
var appium = require('appium/server');
var portscanner = require('portscanner');

/**
 * This module is a browser plugin for [DalekJS](//github.com/dalekjs/dalek).
 * It provides all a WebDriverServer & browser launcher for Safari on iOS.
 * 
 * At the moment this only works with the IPhone 
 *
 * The browser plugin can be installed with the following command:
 *
 * ```bash
 * $ npm install dalek-browser-ios --save-dev
 * ```
 *
 * You can use the browser plugin by adding a config option to the your Dalekfile
 *
 * ```javascript
 * "browsers": ["ios"]
 * ```
 *
 * Or you can tell Dalek that it should test in this browser via the command line:
 *
 * ```bash
 * $ dalek mytest.js -b ios
 * ```
 *
 * The Webdriver Server tries to open Port 9003 by default,
 * if this port is blocked, it tries to use a port between 9004 & 9093
 * You can specifiy a different port from within your [Dalekfile](/pages/config.html) like so:
 *
 * ```javascript
 * "browsers": {
 *   "ios": {
 *     "port": 5555 
 *   }
 * }
 * ```
 *
 * It is also possible to specify a range of ports:
 *
 * ```javascript
 * "browsers": {
 *   "ios": {
 *     "portRange": [6100, 6120] 
 *   }
 * }
 * ```
 *
 * If you would like to test on the IPad (IPhone) emulator, you can simply apply a snd. argument,
 * which defines the browser type:
 *
 * ```bash
 * $ dalek mytest.js -b ios:ipad
 * ```
 * 
 * @module DalekJS
 * @class IosDriver
 * @namespace Browser
 * @part iOS
 * @api
 */

var IosDriver = {

  /**
   * Verbose version of the browser name
   *
   * @property longName
   * @type string
   * @default Mobile Safari iOS
   */

  longName: 'Mobile Safari iOS (iPhone)',

  /**
   * Default port of the Appium WebDriverServer
   * The port may change, cause the port conflict resolution
   * tool might pick another one, if the default one is blocked
   *
   * @property port
   * @type integer
   * @default 4723
   */

  port: 4723,

  /**
   * WebHook port
   *
   * @property webhookPort
   * @type integer
   * @default 9003
   */

  webhookPort: 9003,

  /**
   * Default host of the Appium WebDriverServer
   * The host may be overridden with
   * a user configured value
   *
   * @property host
   * @type string
   * @default localhost
   */

  host: 'localhost',

  /**
   * Root path of the appium webdriver server
   *
   * @property path
   * @type string
   * @default /wd/hub
   */

  path: '/wd/hub',

  /**
   * Default desired capabilities that should be
   * transferred when the browser session gets requested
   *
   * @property desiredCapabilities
   * @type object
   */

  desiredCapabilities: {
    device: 'iPhone Emulator',
    name: 'Safari remote via WD',
    app: 'safari',
    version: '6.1',
    browserName: ''
  },

  /**
   * Driver defaults, what should the driver be able to access.
   *
   * @property driverDefaults
   * @type object
   */

  driverDefaults: {
    viewport: true,
    status: {
      os: {
        arch: os.arch(),
        version: os.release(),
        name: 'Mac OSX'
      }
    },
    sessionInfo: true
  },

  /**
   * Special arguments that are needed to invoke
   * appium. These are the defaults, they need to be modified later on 
   *
   * @property appiumArgs
   * @type object
   */

  appiumArgs: {
    app: null,
    ipa: null,
    quiet: true,
    udid: null,
    keepArtifacts: false,
    noSessionOverride: false,
    fullReset: false,
    noReset: false,
    launch: false,
    log: false,
    nativeInstrumentsLib: false,
    safari: false,
    forceIphone: false,
    forceIpad: false,
    orientation: null,
    useKeystore: false,
    address: '0.0.0.0',
    nodeconfig: null,
    port: null,
    webhook: null
  },

  /**
   * Different browser types (iPhone / iPad)
   *
   * @property browserTypes
   * @type object
   */

  browserTypes: {

    /**
     * IPad emulator
     *
     * @property ipad
     * @type object
     */

    ipad: {
      name: 'iPad'
    }

  },

  /**
   * Resolves the driver port
   *
   * @method getPort
   * @return {integer} port WebDriver server port
   */

  getPort: function () {
    return this.port;
  },

  /**
   * Resolves the maximum range for the driver port
   *
   * @method getMaxPort
   * @return {integer} port Max WebDriver server port range
   */

  getMaxPort: function () {
    return this.maxPort;
  },

  /**
   * Resolves the webhook port
   *
   * @method getWebhookPort
   * @return {integer} WebHook server port
   */

  getWebhookPort: function () {
    return this.webhookPort;
  },

  /**
   * Resolves the maximum range for the webhook port
   *
   * @method getWebhookPort
   * @return {integer} WebHook Max WebHook port
   */

  getMaxWebhookPort: function () {
    return this.maxWebhookPort;
  },

  /**
   * Returns the driver host
   *
   * @method getHost
   * @return {string} host WebDriver server hostname
   */

  getHost: function () {
    return this.host;
  },

  /**
   * Launches appium & corresponding emulator or device,
   * kicks off the portscanner
   *
   * @method launch
   * @param {object} configuration Browser configuration
   * @param {EventEmitter2} events EventEmitter (Reporter Emitter instance)
   * @param {Dalek.Internal.Config} config Dalek configuration class
   * @return {object} promise Browser promise
   */

  launch: function (configuration, events, config) {
    var deferred = Q.defer();

    // store injected configuration/log event handlers
    this.reporterEvents = events;
    this.configuration = configuration;
    this.config = config;

    // check if the user wants to run the iPad emulator
    if (configuration && configuration.type === 'ipad') {
      this.longName = this.longName.replace('iPhone', 'iPad');
      this.appiumArgs.forceIpad = true;
    }

    // check for a user set port
    var browsers = this.config.get('browsers');
    if (browsers && Array.isArray(browsers)) {
      browsers.forEach(this._checkUserDefinedPorts.bind(this));
    }

    // check if the current port is in use, if so, scan for free ports
    portscanner.findAPortNotInUse(this.getPort(), this.getMaxPort(), this.getHost(), this._checkPorts.bind(this, deferred));
    return deferred.promise;
  },

  /**
   * Kills the Appium Server process,
   * kills simulator processses
   * with a slight timeout to prevent 
   * appium from throwing errors
   * 
   * @method kill
   * @chainable
   */

  kill: function () {
    // kill appium servers
    this.appiumServer.webSocket.server.close();
    this.appiumServer.rest.listen().close();
    // slight timeout for process killing
    setTimeout(this._processes.bind(this, this._kill.bind(this)), 1000);
    return this;
  },

  /**
   * Kills the non blacklisted simulator processes & restores
   * the stderr handler
   *
   * @method _kill
   * @param {object|null} err Error or null
   * @param {array} result List of currently running simulator processes
   * @chainable
   * @private
   */

  _kill: function (err, result) {
    // kill simulator processes
    result.forEach(this._killProcess.bind(this));
    // (re)establish stderr stream
    process.stderr.write = this.oldWriteErr;
    return this;
  },

  /**
   * Checks a blacklist & kills the process when
   * not found
   *
   * @method _killProcess
   * @param {integer} processID Process ID
   * @chainable
   * @private
   */

  _killProcess: function (processID) {
    var kill = true;

    // walk through the list of processes that are
    // open before the driver started
    this.openProcesses.forEach(function (pid) {
      if (pid === processID) {
        kill = false;
      }
    });

    if (kill === true) {
      cp.spawn('kill', [processID]);
    }

    return this;
  },

  /**
   * Checks & switches the appium server port,
   * scans the range for the webhook port
   *
   * @method _listProcesses
   * @param {object} deferred Promise
   * @param {object|null} err Error or null
   * @param {integer} port Appium server port to use
   * @chainable
   * @private
   */

  _checkPorts: function (deferred, error, port) {
    // check if the port was blocked & if we need to switch to another port
    if (this.port !== port) {
      this.reporterEvents.emit('report:log:system', 'dalek-browser-ios: Switching to port: ' + port);
      this.port = port;
    }

    // check if the current webhook port is in use, if so, scan for free ports
    portscanner.findAPortNotInUse(this.getWebhookPort(), this.getMaxWebhookPort(), this.getHost(), this._launch.bind(this, deferred));
    return this;
  },

  /**
   * Checks & switches the webhook port,
   * loads a list of running simulator processes
   *
   * @method _listProcesses
   * @param {object} deferred Promise
   * @param {object|null} err Error or null
   * @param {integer} port Webhook port to use
   * @chainable
   * @private
   */

  _launch: function (deferred, error, port) {
    // check if the port was blocked & if we need to switch to another port
    if (this.webhookPort !== port) {
      this.reporterEvents.emit('report:log:system', 'dalek-browser-ios: Switching to webhook port: ' + port);
      this.webhookPort = port;
    }

    // launch appium & the emulator
    this._processes(this._listProcesses.bind(this, deferred));
    return this;
  },

  /**
   * Stores open processes,
   * suppresses stdout logs,
   * starts appium
   *
   * @method _listProcesses
   * @param {object} deferred Promise
   * @param {object|null} err Error or null
   * @param {array} result List of currently running simulator processes
   * @chainable
   * @private
   */

  _listProcesses: function (deferred, err, result) {
    // save list of open emulator processes, before we launched it
    this.openProcesses = result;
    // nasty hack to surpress socket.io debug reports from appium
    this._suppressAppiumLogs();
    // run appium
    appium.run(this._loadAppiumArgs(this.appiumArgs), this._afterAppiumStarted.bind(this, deferred));
    return this;
  },

  /**
   * Stores the appium server reference,
   * restores the stdout logs
   *
   * @method _afterAppiumStarted
   * @param {object} deferred Promise
   * @param {object} appiumServer Appium server instance
   * @chainable
   * @private
   */

  _afterAppiumStarted: function (deferred, appiumServer) {
    this.appiumServer = appiumServer;
    this._reinstantiateLog();
    deferred.resolve();
    return this;
  },

  /**
   * Configures appium
   *
   * @method _loadAppiumArgs
   * @param {object} appiumArgs Appium specific configuration
   * @return {object} Modified appium configuration
   * @private
   */

  _loadAppiumArgs: function (appiumArgs) {
    appiumArgs.port = this.getPort();
    appiumArgs.webhook = this.getHost() + ':' + this.getWebhookPort();
    return appiumArgs;
  },

  /**
   * Process user defined ports
   *
   * @method _checkUserDefinedPorts
   * @param {object} browser Browser configuration
   * @chainable
   * @private
   */

  _checkUserDefinedPorts: function (browser) {
    this._checkAppiumPorts(browser);
    this._checkWebhookPorts(browser);
    return this;
  },

  /**
   * Process user defined appium ports
   *
   * @method _checkAppiumPorts
   * @param {object} browser Browser configuration
   * @chainable
   * @private
   */

  _checkAppiumPorts: function (browser) {
    // check for a single defined port
    if (browser.ios && browser.ios.port) {
      this.port = parseInt(browser.ios.port, 10);
      this.maxPort = this.port + 90;
      this.reporterEvents.emit('report:log:system', 'dalek-browser-ios: Switching to user defined port: ' + this.port);
    }

    // check for a port range
    if (browser.ios && browser.ios.portRange && browser.ios.portRange.length === 2) {
      this.port = parseInt(browser.ios.portRange[0], 10);
      this.maxPort = parseInt(browser.ios.portRange[1], 10);
      this.reporterEvents.emit('report:log:system', 'dalek-browser-ios: Switching to user defined port(s): ' + this.port + ' -> ' + this.maxPort);
    }

    return this;
  },

  /**
   * Process user defined webhook ports
   *
   * @method _checkWebhookPorts
   * @param {object} browser Browser configuration
   * @chainable
   * @private
   */

  _checkWebhookPorts: function (browser) {
    // check for a single defined webhook port
    if (browser.ios && browser.ios.webhookPort) {
      this.webhookPort = parseInt(browser.ios.webhookPort, 10);
      this.maxWebhookPort = this.webhookPort + 90;
      this.reporterEvents.emit('report:log:system', 'dalek-browser-ios: Switching to user defined webhook port: ' + this.webhookPort);
    }

    // check for a webhook port range
    if (browser.ios && browser.ios.webhookPortRange && browser.ios.webhookPortRange.length === 2) {
      this.webhookPort = parseInt(browser.ios.webhookPortRange[0], 10);
      this.maxWebhookPort = parseInt(browser.ios.webhookPortRange[1], 10);
      this.reporterEvents.emit('report:log:system', 'dalek-browser-ios: Switching to user defined webhook port(s): ' + this.webhookPort + ' -> ' + this.maxWebhookPort);
    }

    return this;
  },

  /**
   * Tracks running simulator processes
   *
   * @method _processes
   * @param {function} fn Callback
   * @chainable
   * @private
   */

  _processes: function (fn) {
    var cmd = ['ps -ax', '|', 'grep "iPhone Simulator.app"'];
    cp.exec(cmd.join(' '), this._transformProcesses.bind(this, fn));
    return this;
  },

  /**
   * Transforms the process list output into
   * a json structure
   * 
   * @method _transformProcesses
   * @param {function} fn Callback
   * @param {null|object} err Error if error, null if not
   * @param {string} stdout Terminal output
   * @chainable
   * @private
   */

  _transformProcesses: function(fn, err, stdout){
    var result = [];
    stdout.split('\n').forEach(this._scanProcess.bind(this, result));
    fn(err, result);
    return this;
  },

  /**
   * Scans and transforms the process list
   *
   * @method _scanProcess
   * @param {array} result Transformed result
   * @param {string} line Process list entry
   * @chainable
   * @private
   */

  _scanProcess: function (result, line){
    var data = line.split(' ');
    data = data.filter(this._filterProcessItem);

    if (data[1] === '??') {
      result.push(data[0]);
    }

    return this;
  },

  /**
   * Filters process list items
   *
   * @method _filterProcessItem
   * @param {string} item Process list entry
   * @return {bool|string} Process item or false
   * @private
   */

  _filterProcessItem: function (item) {
    if (item !== '') {
      return item;
    }

    return false;
  },

  /**
   * Overwrite default stdout & stderr handler
   * to suppress some appium logs 
   *
   * @method _suppressAppiumLogs
   * @chainable
   * @private
   */

  _suppressAppiumLogs: function () {
    var noop = function () {};
    this.oldWrite = process.stdout.write;
    this.oldWriteErr = process.stderr.write;
    process.stdout.write = noop;
    process.stderr.write = noop;
    return this;
  },

  /**
   * Reinstantiate stdout handler after appium has
   * been started
   *
   * @method _reinstantiateLog
   * @chainable
   * @private
   */

  _reinstantiateLog: function () {
    process.stdout.write = this.oldWrite;
    return this;
  }

};

// expose the module
module.exports = IosDriver;
