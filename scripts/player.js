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
      const FLOATING_POINT_MARGIN = 0.001;

      if (this.dir.x != 0 && this.dir.y != 0) {
        this.dir.x *= 0.71;
        this.dir.y *= 0.71;
      }

      this.pos.x += this.dir.x * this.speed;

      if (this.dir.x > 0) {
        let tileX = Math.floor(this.pos.x + this.size.w / 2);
        let minY = Math.floor(this.pos.y - this.size.h / 2);
        let maxY = Math.floor(this.pos.y + this.size.h / 2);

        for (var y = minY; y <= maxY; y++) {
          if (!getGridTile(grid, tileX, y).isFloor) {
            this.pos.x = tileX - this.size.w / 2 - FLOATING_POINT_MARGIN;
            break;
          }
        }
      } else if (this.dir.x < 0) {
        let tileX = Math.floor(this.pos.x - this.size.w / 2);
        let minY = Math.floor(this.pos.y - this.size.h / 2);
        let maxY = Math.floor(this.pos.y + this.size.h / 2);

        for (var y = minY; y <= maxY; y++) {
          if (!getGridTile(grid, tileX, y).isFloor) {
            this.pos.x = tileX + 1 + this.size.w / 2 + FLOATING_POINT_MARGIN;
            break;
          }
        }
      }

      this.pos.y += this.dir.y * this.speed;

      if (this.dir.y > 0) {
        let tileY = Math.floor(this.pos.y + this.size.h / 2);
        let minX = Math.floor(this.pos.x - this.size.w / 2);
        let maxX = Math.floor(this.pos.x + this.size.w / 2);

        for (var x = minX; x <= maxX; x++) {
          if (!getGridTile(grid, x, tileY).isFloor) {
            this.pos.y = tileY - this.size.h / 2 - FLOATING_POINT_MARGIN;
            break;
          }
        }
      } else if (this.dir.y < 0) {
        let tileY = Math.floor(this.pos.y - this.size.h / 2);
        let minX = Math.floor(this.pos.x - this.size.w / 2);
        let maxX = Math.floor(this.pos.x + this.size.w / 2);

        for (var x = minX; x <= maxX; x++) {
          if (!getGridTile(grid, x, tileY).isFloor) {
            this.pos.y = tileY + 1 + this.size.h / 2 + FLOATING_POINT_MARGIN;
            break;
          }
        }
      }

      this.centerX = this.pos.x + this.size.w / 2;
      this.centerY = this.pos.y + this.size.h / 2;
    }
  }

  return Player;
})();
