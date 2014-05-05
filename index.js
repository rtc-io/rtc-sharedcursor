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
  var thottleDelay = (opts || {}).throttleDelay || 10;
  var channelOpts = (opts || {}).channelOpts || {
    ordered: true,
    maxRetransmits: 0
  };

  function updateTargetBounds() {
    var rect = currentTarget && currentTarget.getBoundingClientRect();
    var offsetTarget = currentTarget;

    // get the width and height from the client bounding rect
    targetWidth = rect ? rect.width : 0;
    targetHeight = rect ? rect.height : 0;

    // get the offset from offsetLeft and offsetTop
    targetX = 0;
    targetY = 0;
    while (offsetTarget) {
      targetX += offsetTarget.offsetLeft;
      targetY += offsetTarget.offsetTop;

      offsetTarget = offsetTarget.offsetParent;
    }
  }

  function handleNewChannel(id, dc) {
    channels.push(dc);
    peers.push(id);

    dc.onmessage = function(evt) {
      var payload = new Uint16Array(evt.data);

      emitter.emit(
        'data',
        id,
        eventCodes[payload[0]],
        (payload[1] / MAXVAL * targetWidth) | 0,
        (payload[2] / MAXVAL * targetHeight) | 0
      );
    };
  }

  function removeCursor(id) {
    // find the channel that has been removed
    var peerIdx = peers.indexOf(id);

    if (peerIdx >= 0) {
      peers.splice(peerIdx, 1);
      channels.splice(peerIdx, 1);
    }

    // emit a remove event
    emitter.emit('remove', id);
  }

  function takePoint(args) {
    var code;
    var relX;
    var relY;

    if (! args) {
      return;
    }

    code = eventCodes.indexOf(args[2].type);
    if (code >= 0) {
      // update the target bounds :(
      updateTargetBounds();

      // calculate the relative x and y
      relX = (((args[0] - targetX) / targetWidth) * MAXVAL) | 0;
      relY = (((args[1] - targetY) / targetHeight) * MAXVAL) | 0;

      // emit the original event so we can tweak if required
      emitter.emit(args[2].type, args[0], args[1], args[3]);

      // send the data
      channels.forEach(function(dc, idx) {
        try {
          // send the mouse data payload
          dc.send(new Uint16Array([
            code,
            relX,
            relY
          ]));
        }
        catch (e) {
          console.warn('couldn\'t send cursor to peer: ' + peers[idx], e);
        }
      });
    }
  }

  // bind the attach function to the emitter
  emitter.attach = function(target) {
    var stop;

    // detatch from the previous target
    emitter.detach();

    // update the current target
    currentTarget = target;

    // listen for pointer events on the target
    stop = point(target, { over: true })(throttle(takePoint, thottleDelay));

    // patch in the detach handler
    emitter.detach = function() {
      stop();
    };

    // update the target bounds
    updateTargetBounds();

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
  qc.createDataChannel('cursor', channelOpts)
    .on('channel:opened:cursor', handleNewChannel)
    .on('channel:closed:cursor', removeCursor);

  return emitter;
};
