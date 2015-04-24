var quickconnect = require('rtc-quickconnect');
var crel = require('crel');

// initialise quickconnect
var qc = quickconnect('https://switchboard.rtc.io/', {
  room: 'test:sharedcursor'
});

// create the shared cursor
var cursor = require('..')(qc);

// create some test elements
var elements = [
  crel('canvas', { width: 200, height: 200 }),
  crel('canvas', { width: 500, height: 500 }),
  crel('canvas', { width: 20, height: 100 }),
];

// randomly select one of the canvases
var target = elements[(Math.random() * elements.length) | 0];
var context = target.getContext('2d');

// add our test elements to the dom
elements.forEach(function(el) {
  document.body.appendChild(el);
});

// color our target so we know the capture source
context.fillStyle = 'rgb(200, 200, 200)';
context.fillRect(0, 0, target.width, target.height);

// attach the cursor the element now it is in the dom and has
// valid DOM bounds
cursor.attach(target);

// draw on the target
cursor.on('data', function(id, type, x, y) {
  context.fillStyle = 'rgb(200, 200, 200)';
  context.fillRect(0, 0, target.width, target.height);
  context.fillStyle = type === 'move' ? 'green' : 'red';
  context.fillRect(x - 5, y - 5, 10, 10);
});
