function floatsEqual(n1, n2, tolerance) {
  return Math.abs(n1 - n2) < tolerance + Number.EPSILON;
}
