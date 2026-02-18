class Projectile {
  constructor(config, type, pos, dir) {
    this.type = config.type;
    this.prevPos = {
      x: pos.x,
      y: pos.y,
    };
    this.pos = {
      x: pos.x,
      y: pos.y,
    };
    this.size = {
      r: 0.2,
    };
    this.direction = {
      x: dir.x,
      y: dir.y,
    };
    this.speed = config.speed;
    this.damage = config.damage;
    this.type = type;

    this.debugFill = "#AAFFAA";
  }
  update() {
    if (this.type == "bullet") {
      this.prevPos.x = this.pos.x;
      this.prevPos.y = this.pos.y;

      let velX = this.direction.x * this.speed;
      let velY = this.direction.y * this.speed;

      this.pos.y += velY;
      this.pos.x += velX;
    }
  }
}
class AttackHandler {
  constructor(config, position, projectileArrayRef) {
    // Weapon configuration
    this.type = config.attack.type;
    this.spatial = structuredClone(config.attack.spatial);
    this.firing = structuredClone(config.attack.firing);
    this.projectile = structuredClone(config.attack.projectile);
    this.timing = structuredClone(config.attack.timing);

    // Weapon states: ready, windup, fire, cooldown
    this.currentState = "ready";

    // Timer for the next state
    this.timer = 0;

    // Current weapon release position
    this.pos = position;

    this.projectileArrayRef = projectileArrayRef;

    this.spiralPauseTimer = 0;
    this.spiralNumber = 0;
  }
  tryAttack() {
    if (this.currentState == "ready") {
      this.currentState = "windup";
      this.timer = this.timing.windup;
      return true;
    } else {
      return false;
    }
  }
  fire(grid, playerPos) {
    if (this.spatial.type == "single") {
      let distToPlayer = Math.sqrt(
        (playerPos.x - this.pos.x) * (playerPos.x - this.pos.x) +
          (playerPos.y - this.pos.y) * (playerPos.y - this.pos.y),
      );

      this.projectileArrayRef.push(
        new Projectile(
          this.projectile,
          this.type,
          {
            x: this.pos.x,
            y: this.pos.y,
          },
          {
            x: (playerPos.x - this.pos.x) / distToPlayer,
            y: (playerPos.y - this.pos.y) / distToPlayer,
          },
        ),
      );

      this.currentState = "cooldown";
      this.timer = this.timing.cooldown;
    } else if (this.spatial.type == "radial") {
      let angleTo = 0;
      if (this.spatial.aimed) {
        angleTo = Math.atan2(
          playerPos.y - this.pos.y,
          playerPos.x - this.pos.x,
        );
      }

      for (let i = 0; i < this.spatial.number; i++) {
        this.projectileArrayRef.push(
          new Projectile(
            this.projectile,
            this.type,
            {
              x: this.pos.x,
              y: this.pos.y,
            },
            {
              x: Math.cos(angleTo + i * ((2 * Math.PI) / this.spatial.number)),
              y: Math.sin(angleTo + i * ((2 * Math.PI) / this.spatial.number)),
            },
          ),
        );
      }

      this.currentState = "cooldown";
      this.timer = this.timing.cooldown;
    } else if (this.spatial.type == "spiral") {
      if (this.spiralPauseTimer <= 0) {
        let angleTo = 0;
        if (this.spatial.aimed) {
          angleTo = Math.atan2(
            playerPos.y - this.pos.y,
            playerPos.x - this.pos.x,
          );
        }

        if (this.spiralNumber < this.spatial.number) {
          this.projectileArrayRef.push(
            new Projectile(
              this.projectile,
              this.type,
              {
                x: this.pos.x,
                y: this.pos.y,
              },
              {
                x: Math.cos(
                  angleTo +
                    this.spiralNumber * ((2 * Math.PI) / this.spatial.number),
                ),
                y: Math.sin(
                  angleTo +
                    this.spiralNumber * ((2 * Math.PI) / this.spatial.number),
                ),
              },
            ),
          );

          this.spiralNumber++;
          this.spiralPauseTimer = this.spatial.spiralPause;
        } else {
          this.currentState = "cooldown";
          this.timer = this.timing.cooldown;
          this.spiralPauseTimer = 0;
          this.spiralNumber = 0;
        }
      } else {
        this.spiralPauseTimer--;
      }
    } else if (this.spatial.type == "shotgun") {
      let angleTo = 0;
      angleTo =
        Math.atan2(playerPos.y - this.pos.y, playerPos.x - this.pos.x) -
        this.spatial.shotgunAngleRange / 2 +
        this.spatial.shotgunAngleRange / (2 * this.spatial.number);

      for (let i = 0; i < this.spatial.number; i++) {
        this.projectileArrayRef.push(
          new Projectile(
            this.projectile,
            this.type,
            {
              x: this.pos.x,
              y: this.pos.y,
            },
            {
              x: Math.cos(
                angleTo +
                  i * (this.spatial.shotgunAngleRange / this.spatial.number),
              ),
              y: Math.sin(
                angleTo +
                  i * (this.spatial.shotgunAngleRange / this.spatial.number),
              ),
            },
          ),
        );
      }

      this.currentState = "cooldown";
      this.timer = this.timing.cooldown;
    }
  }
  update(grid, playerPos) {
    if (this.currentState == "windup") {
      if (this.timer <= 0) {
        this.currentState = "fire";
      }
    } else if (this.currentState == "fire") {
      this.fire(grid, playerPos);
    } else if (this.currentState == "cooldown") {
      if (this.timer <= 0) {
        this.currentState = "ready";
      }
    }

    this.timer--;
  }
}
