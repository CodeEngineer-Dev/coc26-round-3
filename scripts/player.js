var Player = (function () {
  class Player {
    constructor(x, y) {
      this.x = x;
      this.y = y;
      this.r = 0.5;

      this.speed = 0.25;
      this.velDir = { x: 0, y: 0 };
    }
    handleUserInput() {
      this.velDir.x = 0;
      this.velDir.y = 0;

      if (events.KeyW) this.velDir.y += -1;
      if (events.KeyS) this.velDir.y += 1;

      if (events.KeyA) this.velDir.x += -1;
      if (events.KeyD) this.velDir.x += 1;
    }
    move() {
      if (this.velDir.x != 0 && this.velDir.y != 0) {
        this.velDir.x *= 0.71;
        this.velDir.y *= 0.71;
      }

      this.x += this.velDir.x * this.speed;
      this.y += this.velDir.y * this.speed;
    }
  }

  return Player;
})();
