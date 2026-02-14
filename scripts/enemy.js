/*

Enemies will have different patterns specified by JSON.

Configuration tree
- position
- size
- movement
    - type (options: chase, orbit, wander, strafing, move with player)
    - speed
- pattern 
    - type (options: laser, bomb, bullet)
    - weapon configuration (options: single, shotgun, radial, spiral)
    - projectile configuration
        - speed
        - modifiers (options: pierce, bounce, split, homing, acceleration, slowing)
        - damage done
- timing
    - fire pattern (options: constant, burst)
    - telegraph time
    - cooldown
    - wind up time
    - cancelable
    - recovery
- state based overrides (options: idle, aggressive, retreat; can modify any of it's traits)
- tag (options: charger, turret, swarm, sniper, summoner, support, splitter, zoner)
- health
- engagement rules
    - LOS
    - minDist
    - maxDist
    - prefDist
- onDeath (split, explode, spawn, default)
*/

class MovementHandler {
  constructor(config, position) {
    this.type = config.movement.type;
    this.speed = config.movement.speed;

    this.pos = {
      x: position.x,
      y: position.y,
    };
    this.size = {
      w: config.size.w,
      h: config.size.h,
      r: config.size.r,
    };

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

  blindDirToward(pos, distance) {
    let dist = distance || this.calculateDistTo(pos);
    this.dir.x = (pos.x - this.pos.x) / dist;
    this.dir.y = (pos.y - this.pos.y) / dist;
  }
  blindDirAway(pos, distance) {
    let dist = distance || this.calculateDistTo(pos);
    this.dir.x = -(pos.x - this.pos.x) / dist;
    this.dir.y = -(pos.y - this.pos.y) / dist;
  }

  update(grid, playerPos, engagement) {
    let distToPlayer = this.calculateDistTo(playerPos);
    if (
      !this.isCorrectingRadius &&
      (distToPlayer > engagement.maxDist || distToPlayer < engagement.minDist)
    )
      this.isCorrectingRadius = true;

    if (this.type == "chase") {
      if (this.isCorrectingRadius) {
        if (floatsEqual(distToPlayer, engagement.preferredDist, this.speed)) {
          this.isCorrectingRadius = false;
        } else {
          if (distToPlayer > engagement.preferredDist) {
            this.blindDirToward(playerPos, distToPlayer);
          } else if (distToPlayer < engagement.preferredDist) {
            this.blindDirAway(playerPos, distToPlayer);
          }
        }
      } else {
        this.dir.x = 0;
        this.dir.y = 0;
      }
    } else if (this.type == "orbit") {
      // AI helped me work out how to do this correctly and efficiently.
      // Avoids using trig functions and angle calculations. Very nice.
      let r = distToPlayer;
      let rx = (playerPos.x - this.pos.x) / r;
      let ry = (playerPos.y - this.pos.y) / r;

      let px = -ry;
      let py = rx;

      if (this.isCorrectingRadius) {
        if (floatsEqual(distToPlayer, engagement.preferredDist, this.speed)) {
          this.isCorrectingRadius = false;
        } else {
          /*
          const SPIRAL_STRENGTH = 0.5;
          if (r > engagement.preferredDist) {
            this.dir.x = px + rx * SPIRAL_STRENGTH;
            this.dir.y = py + ry * SPIRAL_STRENGTH;
          } else if (r < engagement.preferredDist) {
            this.dir.x = px - rx * SPIRAL_STRENGTH;
            this.dir.y = py - ry * SPIRAL_STRENGTH;
          }*/
          if (distToPlayer > engagement.preferredDist) {
            this.blindDirToward(playerPos, distToPlayer);
          } else if (distToPlayer < engagement.preferredDist) {
            this.blindDirAway(playerPos, distToPlayer);
          }
        }
      } else {
        this.dir.x = px;
        this.dir.y = py;
      }
    }

    this.pos.x += this.dir.x * this.speed;
    handleGridCollision(grid, this, "x");

    this.pos.y += this.dir.y * this.speed;
    handleGridCollision(grid, this, "y");
  }
}

class Enemy {
  constructor(config, position) {
    this.movement = new MovementHandler(config, position);
    this.engagement = structuredClone(config.engagement);
  }
  update(grid, player) {
    this.movement.update(grid, player.pos, this.engagement);
  }
}
