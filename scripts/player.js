var Player = (function () {
  class Player {
    constructor(x, y) {
      this.pos = {
        x: x,
        y: y,
      };
      this.size = {
        w: 0.8,
        h: 0.8,
        r: 0.4,
      };

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
      if (this.dir.x != 0 && this.dir.y != 0) {
        this.dir.x *= 0.71;
        this.dir.y *= 0.71;
      }

      this.pos.x += this.dir.x * this.speed;
      handleGridCollision(grid, this, "x");

      this.pos.y += this.dir.y * this.speed;
      handleGridCollision(grid, this, "y");

      this.centerX = this.pos.x + this.size.w / 2;
      this.centerY = this.pos.y + this.size.h / 2;
    }
  }

  return Player;
})();
