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
var util = require('util');
var Q = require('q');
var appium = require('appium/server');

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
 * "browsers": ["ios:safari"]
 * ```
 *
 * Or you can tell Dalek that it should test in this browser via the command line:
 *
 * ```bash
 * $ dalek mytest.js -b ios:safari
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

  longName: 'Mobile Safari iOS',

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
    device: 'iPhone Simulator',
    name: "Appium Hybrid App: with WD",
    app: "safari",
    version: '6.1',
    browserName: ''
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
   * Resolves the driver port
   *
   * @method getPort
   * @return {integer} port WebDriver server port
   */

  getPort: function () {
    return this.port;
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
   * Returns the driver host
   *
   * @method getHost
   * @return {string} host WebDriver server hostname
   */

  getHost: function () {
    return this.host;
  },

  /**
   * Launches appium & corresponding emulator or device
   *
   * @method launch
   * @return {object} promise Browser promise
   */

  launch: function () {
    var deferred = Q.defer();

    // nasty hack to surpress socket.io debug reports from appium
    this.old_write = process.stdout.write;
    process.stdout.write = function () {};

    this._processes(function (err, result) {
      this.openProcesses = result;
      appium.run(this._loadAppiumArgs(this.appiumArgs), function (appiumServer) {
        this.appiumServer = appiumServer;
        process.stdout.write = this.old_write;
        deferred.resolve();
      }.bind(this));
    }.bind(this));

    return deferred.promise;
  },

  /**
   * Kills the ChromeWebDriverServer process
   *
   * @method kill
   * @chainable
   */

  kill: function () {
    this._processes(function (err, result) {

      // kill the appium servers
      this.appiumServer.webSocket.server.close();
      this.appiumServer.rest.listen().close();

      result.forEach(function (processID) {
        var kill = true;
        this.openProcesses.forEach(function (pid) {
          if (pid === processID) {
            kill = false;
          }
        });

        if (kill === true) {
          var killer = require('child_process').spawn;
          killer('kill', [processID]);
        }
      }.bind(this));
    }.bind(this));    
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

  _loadAppiumArgs: function (appiumArgs) {
    appiumArgs.port = this.getPort();
    appiumArgs.webhook = this.getHost() + ':' + this.getWebhookPort();
    return appiumArgs;
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
    var pattern = /^(\d+)\s+([^\s]+)\s+([^\s]+)\s+(.+)/;
    var exec = require('child_process').exec;
    exec(cmd.join(' '), function(err, stdout, stderr){
      var result = [];

      stdout.split('\n').forEach(function(line){
        var data = line.split(' ');
        data = data.filter(function (item) {
          if (item !== '') {
            return item;
          }

          return false;
        });

        if (data[1] === '??') {
          result.push(data[0])
        }
      });

      fn(err, result);
    });

    return this;
  }
};

// expose the module
module.exports = IosDriver;
