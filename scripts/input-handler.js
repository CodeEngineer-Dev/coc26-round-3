// Borrowed some of xyzyyxx's utils from last round

// Canvas and overlay
var overlay = document.querySelector("#overlay");
var boundingRect = overlay.getBoundingClientRect();

// Events (events + mouse)
var events = { dx: 0, dy: 0 };
var eventsPrev = { dx: 0, dy: 0 };
var mouseX = 0;
var mouseY = 0;
var mousePressed = false;

// When key down, mark it as true
document.addEventListener("keydown", (e) => {
  events[e.code] = true;
  // Shift shortcut
  events.Shift = events.ShiftLeft || events.ShiftRight;
});

// Similar to above
document.addEventListener("keyup", (e) => {
  events[e.code] = false;
  events.Shift = events.ShiftLeft || events.ShiftRight;
});

// Courtesy of google's AI Overview
document.addEventListener("mousemove", (e) => {
  mouseX = e.clientX - boundingRect.left;
  mouseY = e.clientY - boundingRect.top;
});

document.addEventListener("mousedown", (e) => {
  mousePressed = true;
});

document.addEventListener("mouseup", (e) => {
  mousePressed = false;
});
