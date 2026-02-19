function floatsEqual(n1, n2, tolerance) {
  return Math.abs(n1 - n2) < tolerance + Number.EPSILON;
}

function pointCircle(px, py, cx, cy, cr) {
  return (px - cx) * (px - cx) + (py - cy) * (py - cy) <= cr * cr;
}
