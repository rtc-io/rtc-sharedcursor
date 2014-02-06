/* jshint node: true */
'use strict';

var point = require('point');
var EventEmitter = require('events').EventEmitter;
var throttle = require('cog/throttle');
var eventCodes = [
  'over',
  'start',
  'move',
  'end'
];

/**
  # rtc-sharedcursor

  The `rtc-sharedcursor` module makes it simple to share and touch
  mouse events for a target element across the wire one or more
  peers across a data channel connection.

  ## Example Usage

  <<< examples/simple.js

  Running the example in a few different windows, should display 
  something similar to what is shown below:

  ![Screenshot](https://raw.github.com/rtc-io/rtc-sharedcursor/master/screenshot.png)

**/

module.exports = function(qc, opts) {
  // create the cursor event emitter
  var emitter = new EventEmitter();
  var channels = [];
  var peers = [];
  var currentTarget;
  var targetX = 0;
  var targetY = 0;
  var targetWidth = 0;
  var targetHeight = 0;
  var MAXVAL = Math.pow(2, 16) - 1;

  function updateTargetBounds() {
    var rect = currentTarget && currentTarget.getBoundingClientRect();

    targetX = rect ? rect.left : 0;
    targetY = rect ? rect.top : 0;
    targetWidth = rect ? rect.width : 0;
    targetHeight = rect ? rect.height : 0;
  }

  function handleNewChannel(dc, id) {
    channels.push(dc);
    peers.push(id);

    dc.onmessage = function(evt) {
      var payload = evt.data && new Uint16Array(evt.data);

      if (payload) {
        emitter.emit(
          'data',
          id,
          eventCodes[payload[0]],
          (payload[1] / MAXVAL * targetWidth) | 0,
          (payload[2] / MAXVAL * targetHeight) | 0
        );
      }
    }
  }

  function removeCursor(id) {
  }

  // listen for window resize events
  window.addEventListener('resize', updateTargetBounds);

  // bind the attach function to the emitter
  emitter.attach = function(target) {
    var stop;

    // detatch from the previous target
    emitter.detach();

    // update the current target
    currentTarget = target;

    // get the current target size
    updateTargetBounds();

    // listen for pointer events on the target
    stop = point(target, { over: true })(function(args) {
      var code;
      var relX;
      var relY;

      if (! args) {
        return;
      }

      code = eventCodes.indexOf(args[2].type);
      if (code >= 0) {
        // calculate the relative x and y
        relX = (((args[0] - targetX) / targetWidth) * MAXVAL) | 0;
        relY = (((args[1] - targetY) / targetHeight) * MAXVAL) | 0;

        channels.forEach(function(dc) {
          // send the mouse data payload
          dc.send(new Uint16Array([
            code,
            relX,
            relY
          ]));
        })
      }
    });

    // patch in the detach handler
    emitter.detach = function() {
      stop(); 
    };

    return emitter;
  };

  // bind a noop function to the emitter for detatch
  emitter.detach = function() {};

  // if the provided object does not have a 'createDataChannel' method
  // then we aren't going to be doing very much
  if ((! qc) || typeof qc.createDataChannel != 'function') {
    throw Error('rtc-sharedcursor requires a quickconnect object');
  }

  // create the data channel and listen for peer data channels opening
  qc.createDataChannel('cursor')
    .on('cursor:open', handleNewChannel)
    .on('cursor:close', removeCursor);

  return emitter;
};