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
  orbit(position) {}

  update(grid, playerPos, engagement) {
    let distToPlayer = this.calculateDistTo(playerPos);

    console.log(distToPlayer);
    if (distToPlayer > engagement.maxDist) {
      this.blindDirToward(playerPos, distToPlayer);
    } else if (distToPlayer < engagement.minDist) {
      this.blindDirAway(playerPos, distToPlayer);
    }

    if (floatsEqual(distToPlayer, engagement.preferredDist, this.speed)) {
      this.dir.x = 0;
      this.dir.y = 0;
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
