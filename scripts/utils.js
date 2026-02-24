function floatsEqual(n1, n2, tolerance) {
  return Math.abs(n1 - n2) < tolerance + Number.EPSILON;
}

function pointCircle(px, py, cx, cy, cr) {
  return (px - cx) * (px - cx) + (py - cy) * (py - cy) <= cr * cr;
}
// FROM AI
function base64ToBlob(base64, mimeType) {
  // Decode the Base64 string into a binary string
  var binaryString = window.atob(base64);
  var len = binaryString.length;
  // Create a Uint8Array to hold the binary data
  var bytes = new Uint8Array(len);

  // Populate the Uint8Array with the character codes from the binary string
  for (var i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  // Create the Blob object from the Uint8Array
  return new Blob([bytes], { type: mimeType });
}
function createPlaceholderTexture(size = 64) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext("2d");

  // Example: magenta debug texture
  ctx.fillStyle = "magenta";
  ctx.fillRect(0, 0, size, size);

  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, size / 2, size / 2);
  ctx.fillRect(size / 2, size / 2, size / 2, size / 2);

  return canvas;
}
// END AI
