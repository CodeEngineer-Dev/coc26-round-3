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
    console.log(this);
    let rx = (pos.x - this.pos.x) / r;
    let ry = (pos.y - this.pos.y) / r;

    let px = -ry;
    let py = rx;

    this.dir.x = px;
    this.dir.y = py;
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
      console.log(playerPos);

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
        engagement.prefDist,
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
        engagement.prefDist,
        (p, d) => this.blindOrbitToward(p, d),
        (p, d) => this.blindOrbitAway(p, d),
        (p, d) => this.blindOrbitNeutral(p, d),
      );
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
