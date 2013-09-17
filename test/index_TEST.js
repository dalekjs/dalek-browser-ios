'use strict';

var expect = require('chai').expect;
var IosDriver = require('../index');

describe('dalek-browser-ios', function() {

  it('should get default webdriver port', function(){
    expect(IosDriver.port).to.equal(4723);
  });

  it('should get default webhook port', function(){
    expect(IosDriver.webhookPort).to.equal(9003);
  });

});
