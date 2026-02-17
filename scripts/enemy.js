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

class MovementHandler {
  constructor(config, position, size) {
    this.type = config.movement.type;
    this.speed = config.movement.speed;

    this.pos = position;
    this.size = size;

    this.dir = {
      x: 0,
      y: 0,
    };
    this.vel = {
      x: 0,
      y: 0,
    };
    this.isCorrectingRadius = false;
  }

  calculateDistTo(pos) {
    return Math.sqrt(
      (pos.x - this.pos.x) * (pos.x - this.pos.x) +
        (pos.y - this.pos.y) * (pos.y - this.pos.y),
    );
  }

  blindChaseToward(pos, distance) {
    let dist = distance || this.calculateDistTo(pos);
    this.dir.x = (pos.x - this.pos.x) / dist;
    this.dir.y = (pos.y - this.pos.y) / dist;
  }
  blindChaseAway(pos, distance) {
    let dist = distance || this.calculateDistTo(pos);
    this.dir.x = -(pos.x - this.pos.x) / dist;
    this.dir.y = -(pos.y - this.pos.y) / dist;
  }
  blindChaseNeutral(pos, distance) {
    this.dir.x = 0;
    this.dir.y = 0;
  }

  // Used AI to help me work out how to do spirals correctly, esp. w/o using trig or angles.
  blindOrbitToward(pos, distance) {
    const SPIRAL_STRENGTH = 0.5;

    let r = distance;
    let rx = (pos.x - this.pos.x) / r;
    let ry = (pos.y - this.pos.y) / r;

    let px = -ry;
    let py = rx;

    this.dir.x = px + rx * SPIRAL_STRENGTH;
    this.dir.y = py + ry * SPIRAL_STRENGTH;
  }

  blindOrbitAway(pos, distance) {
    const SPIRAL_STRENGTH = 0.5;

    let r = distance;
    let rx = (pos.x - this.pos.x) / r;
    let ry = (pos.y - this.pos.y) / r;

    let px = -ry;
    let py = rx;

    this.dir.x = px - rx * SPIRAL_STRENGTH;
    this.dir.y = py - ry * SPIRAL_STRENGTH;
  }
  blindOrbitNeutral(pos, distance) {
    let r = distance;

    let rx = (pos.x - this.pos.x) / r;
    let ry = (pos.y - this.pos.y) / r;

    let px = -ry;
    let py = rx;

    this.dir.x = px;
    this.dir.y = py;
  }

  blindWander() {
    const DIST = 5;
    const R = 1;
    let circleX = this.pos.x + this.dir.x * DIST;
    let circleY = this.pos.y + this.dir.y * DIST;

    let randomTheta = Math.random() * 2 * Math.PI;
    let randomPointX = circleX + Math.cos(randomTheta) * R;
    let randomPointY = circleY + Math.sin(randomTheta) * R;

    let dist = this.calculateDistTo({
      x: randomPointX,
      y: randomPointY,
    });
    this.dir.x = (randomPointX - this.pos.x) / dist;
    this.dir.y = (randomPointY - this.pos.y) / dist;
  }

  handleMovement(grid, dist, playerPos, prefDist, towards, away, neutral) {
    if (this.isCorrectingRadius) {
      if (floatsEqual(dist, prefDist, this.speed)) {
        this.isCorrectingRadius = false;
      } else {
        if (dist > prefDist) {
          towards(playerPos, dist);
        } else if (dist < prefDist) {
          away(playerPos, dist);
        }
      }
    } else {
      neutral(playerPos, dist);
    }
  }

  update(grid, playerPos, engagement) {
    let distToPlayer = this.calculateDistTo(playerPos);
    if (
      !this.isCorrectingRadius &&
      (distToPlayer > engagement.maxDist || distToPlayer < engagement.minDist)
    )
      this.isCorrectingRadius = true;

    if (this.type == "chase") {
      this.handleMovement(
        grid,
        distToPlayer,
        playerPos,
        engagement.preferredDist,
        (p, d) => this.blindChaseToward(p, d),
        (p, d) => this.blindChaseAway(p, d),
        (p, d) => this.blindChaseNeutral(p, d),
      );
    } else if (this.type == "orbit") {
      // AI helped me work out how to do this correctly and efficiently.
      // Avoids using trig functions and angle calculations. Very nice.

      this.handleMovement(
        grid,
        distToPlayer,
        playerPos,
        engagement.preferredDist,
        (p, d) => this.blindOrbitToward(p, d),
        (p, d) => this.blindOrbitAway(p, d),
        (p, d) => this.blindOrbitNeutral(p, d),
      );
    } else if (this.type == "wander") {
      this.blindWander();
    }

    this.pos.x += this.dir.x * this.speed;
    handleGridCollision(grid, this, "x");

    this.pos.y += this.dir.y * this.speed;
    handleGridCollision(grid, this, "y");
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

class Enemy {
  constructor(config, position, projectileArray) {
    this.pos = {
      x: position.x,
      y: position.y,
    };
    this.size = {
      w: config.size.w,
      h: config.size.h,
      r: config.size.r,
    };
    this.movement = new MovementHandler(config, this.pos, this.size);
    this.firing = structuredClone(config.attack.firing);
    this.engagement = structuredClone(config.engagement);

    this.attack = new AttackHandler(config, this.pos, projectileArray);
    this.backupTiming = structuredClone(config.attack.timing);

    this.projectileArrayRef = projectileArray;

    this.debugFill = "#FF000080";

    this.attackTimer = 0;
    this.shotsThisRound = 0;
    this.burstTimer = 0;
  }
  update(grid, player) {
    if (this.attack.currentState == "windup") this.debugFill = "#0000AA80";
    else if (this.attack.currentState == "cooldown")
      this.debugFill = "#00AA0080";
    else this.debugFill = "#FF000080";

    this.movement.update(grid, player.pos, this.engagement);
    this.attack.update(grid, player.pos);

    if (this.attackTimer <= 0) {
      if (this.firing.type == "constant") {
        if (this.attack.tryAttack()) this.attackTimer = this.firing.frequency;
      } else if (this.firing.type == "burst") {
        if (this.shotsThisRound < this.firing.burstNumber) {
          if (this.attack.tryAttack()) {
            this.shotsThisRound++;
            this.attack.timing.windup = 0;
            this.attack.timing.cooldown = this.firing.burstPause;
          }
        } else {
          this.attackTimer = this.firing.frequency;
          this.shotsThisRound = 0;
          this.attack.timing.windup = this.backupTiming.windup;
        }
      }
    } else {
      this.attackTimer--;
    }
  }
}
