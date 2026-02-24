var Player = (function () {
  /*
          Configuration options for an player:

          {
            attack: {
              type: "bullet",
              spatial: {
                type: "single" | "shotgun" | "radial",
                number: number,
                aimed: boolean,
                spiralPause: number,
                shotgunAngleRange: number
              },
              firing: {
                type: "constant" | "burst",
                frequency: number,
                burstNumber: number,
                burstPause: number,
              },
              projectile: {
                speed: number,
                modifiers: "none" | "bounce" | "split" | "pierce",
                damage: number
              },
              timing: {
                windup: number,
                cooldown: number
              }
            },
          }
        */
  class Player {
    constructor(config, position, projectileArray) {
      this.pos = {
        x: position.x,
        y: position.y,
      };
      this.size = {
        w: 0.8,
        h: 0.8,
        r: 0.4,
      };

      this.firing = config.attack.firing;

      this.attack = new AttackHandler(config, this.pos, projectileArray);
      this.backupTiming = structuredClone(config.attack.timing);

      this.projectileArrayRef = projectileArray;

      this.attackTimer = 0;
      this.shotsThisRound = 0;
      this.burstTimer = 0;

      this.hearts = config.totalHearts;
      this.totalHearts = config.totalHearts;

      this.speed = config.speed;
      this.dir = { x: 0, y: 0 };
      this.rotation = Math.PI / 2;
      this.camHeight = 2;
      this.justDamaged = false;
    }
    handleUserInput() {
      this.dir.x = 0;
      this.dir.y = 0;

      if (events.KeyW) {
        this.dir.y = -1;
      }
      if (events.KeyS) {
        this.dir.y = 1;
      }
      if (events.KeyA) {
        this.dir.x = -1;
      }
      if (events.KeyD) {
        this.dir.x = 1;
      }
      if (events.ArrowLeft) {
        this.rotation += 0.05;
      }
      if (events.ArrowRight) {
        this.rotation -= 0.05;
      }
      if (events.ArrowDown) {
        this.camHeight -= 0.05;
        if (this.camHeight < 1.5) {
          this.camHeight = 1.5;
        }
      }
      if (events.ArrowUp) {
        this.camHeight += 0.05;
      }
    }
    move(grid) {
      if (this.dir.x != 0 && this.dir.y != 0) {
        this.dir.x *= 0.71;
        this.dir.y *= 0.71;
      }

      // Used Claude to help me work out correct rotated movement code

      let cos = Math.cos(-this.rotation);
      let sin = Math.sin(-this.rotation);

      let inputX = this.dir.x;
      let inputY = this.dir.y;

      this.dir.x = -inputY * cos + -inputX * sin;
      this.dir.y = -inputY * sin - -inputX * cos;

      this.pos.x += this.dir.x * this.speed;
      handleGridCollision(grid, this, "x");

      this.pos.y += this.dir.y * this.speed;
      handleGridCollision(grid, this, "y");

      this.centerX = this.pos.x + this.size.w / 2;
      this.centerY = this.pos.y + this.size.h / 2;
    }
    update(grid, enemies, attackOn) {
      this.justDamaged = false;
      let closestEnemyPos = { x: 0, y: 0 };
      let closestEnemyDistSq = Infinity;
      if (enemies.length > 0) {
        for (let enemy of enemies) {
          let enemyDistSq =
            (enemy.pos.x - this.pos.x) * (enemy.pos.x - this.pos.x) +
            (enemy.pos.y - this.pos.y) * (enemy.pos.y - this.pos.y);
          if (enemyDistSq < closestEnemyDistSq) {
            closestEnemyPos = enemy.pos;
            closestEnemyDistSq = enemyDistSq;
          }
        }
      } else {
        closestEnemyPos.x = this.pos.x + Math.random() - 0.5;
        closestEnemyPos.y = this.pos.y + Math.random() - 0.5;
      }

      this.move(grid);

      this.attack.update(grid, closestEnemyPos);

      if (attackOn) {
        if (this.attackTimer <= 0) {
          if (this.firing.type == "constant") {
            if (this.attack.tryAttack())
              this.attackTimer = this.firing.frequency;
          } else if (this.firing.type == "burst") {
            console.log(
              this.attack.spatial.type,
              this.shotsThisRound,
              this.attack.spatial.number,
            );
            if (
              (this.attack.spatial.type != "single" &&
                this.shotsThisRound < this.firing.burstNumber) ||
              (this.attack.spatial.type == "single" &&
                this.shotsThisRound < this.attack.spatial.number)
            ) {
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
  }

  return Player;
})();
