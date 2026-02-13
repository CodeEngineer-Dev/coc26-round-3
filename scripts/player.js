var Player = (function () {
  //https://www.jeffreythompson.org/collision-detection/circle-rect.php
  function circleRect(cx, cy, radius, rx, ry, rw, rh) {
    // temporary variables to set edges for testing
    var testX = cx;
    var testY = cy;

    // which edge is closest?
    if (cx < rx)
      testX = rx; // test left edge
    else if (cx > rx + rw) testX = rx + rw; // right edge
    if (cy < ry)
      testY = ry; // top edge
    else if (cy > ry + rh) testY = ry + rh; // bottom edge

    // get distance from closest edges
    var distX = cx - testX;
    var distY = cy - testY;
    var distanceSq = distX * distX + distY * distY;

    // if the distance is less than the radius, collision!
    if (distanceSq <= radius * radius) {
      return true;
    }
    return false;
  }
  class Player {
    constructor(x, y) {
      this.x = x;
      this.y = y;
      this.w = 0.8;
      this.h = 0.8;
      this.r = 0.4;

      this.speed = 0.05;
      this.dir = { x: 0, y: 0 };
    }
    handleUserInput() {
      this.dir.x = 0;
      this.dir.y = 0;

      if (events.KeyW) this.dir.y += -1;
      if (events.KeyS) this.dir.y += 1;

      if (events.KeyA) this.dir.x += -1;
      if (events.KeyD) this.dir.x += 1;
    }
    move(grid) {
      const FLOATING_POINT_MARGIN = 0.001;

      if (this.dir.x != 0 && this.dir.y != 0) {
        this.dir.x *= 0.71;
        this.dir.y *= 0.71;
      }

      this.x += this.dir.x * this.speed;

      if (this.dir.x > 0) {
        let tileX = Math.floor(this.x + this.w);
        let minY = Math.floor(this.y);
        let maxY = Math.floor(this.y + this.h);

        for (var y = minY; y <= maxY; y++) {
          if (!getGridTile(grid, tileX, y).isFloor) {
            this.x = tileX - this.w - FLOATING_POINT_MARGIN;
            break;
          }
        }
      } else if (this.dir.x < 0) {
        let tileX = Math.floor(this.x);
        let minY = Math.floor(this.y);
        let maxY = Math.floor(this.y + this.h);

        for (var y = minY; y <= maxY; y++) {
          if (!getGridTile(grid, tileX, y).isFloor) {
            this.x = tileX + 1 + FLOATING_POINT_MARGIN;
            break;
          }
        }
      }

      this.y += this.dir.y * this.speed;

      if (this.dir.y > 0) {
        let tileY = Math.floor(this.y + this.h);
        let minX = Math.floor(this.x);
        let maxX = Math.floor(this.x + this.w);

        for (var x = minX; x <= maxX; x++) {
          if (!getGridTile(grid, x, tileY).isFloor) {
            this.y = tileY - this.h - FLOATING_POINT_MARGIN;
            break;
          }
        }
      } else if (this.dir.y < 0) {
        let tileY = Math.floor(this.y);
        let minX = Math.floor(this.x);
        let maxX = Math.floor(this.x + this.w);

        for (var x = minX; x <= maxX; x++) {
          if (!getGridTile(grid, x, tileY).isFloor) {
            this.y = tileY + 1 + FLOATING_POINT_MARGIN;
            break;
          }
        }
      }
    }
  }

  return Player;
})();
