const roomConfigs = [
  {
    type: "symmetric",
    symmetryType: "x&y",
    wallNumber: 1,
    holeNumber: 2,
    clusterSize: {
      w: 2,
      h: 2,
    },
  },
];
/*
  Configuration options for an enemy:

  {
    movement: {
      type: "chase" | "orbit" | "wander",
      speed: number
    },
    size: {
      w: number,
      h: number,
      r: number
    },
    engagement: {
      maxDist: number,
      minDist: number,
      preferredDist: number,
      losRequired: boolean
    },
    attack: {
      type: "bullet",
      spatial: {
        type: "single" | "shotgun" | "radial" | "spiral",
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
    tag: string,
    health: number
  }
*/
const enemyConfigs = [
  {
    movement: {
      type: "orbit",
      speed: 0.005,
    },
    size: {
      w: 1,
      h: 1,
      r: 0.5,
    },
    engagement: {
      maxDist: 5,
      minDist: 1,
      preferredDist: 3,
      requiresLOS: false,
    },
    attack: {
      type: "bullet",
      spatial: {
        type: "radial",
        number: 15,
        aimed: true,
        spiralPause: 5,
        shotgunAngleRange: Math.PI / 4,
      },
      firing: {
        type: "burst",
        frequency: 300,
        burstNumber: 3,
        burstPause: 30,
      },
      projectile: {
        speed: 0.05,
        modifiers: "none",
        damage: 5,
      },
      timing: {
        windup: 60,
        cooldown: 30,
      },
    },
    tag: "string",
    health: 100,
  },
  {
    movement: {
      type: "chase",
      speed: 0.01,
    },
    size: {
      w: 0.7,
      h: 0.7,
      r: 0.35,
    },
    engagement: {
      maxDist: 5,
      minDist: 1,
      preferredDist: 3,
      requiresLOS: true,
    },
    attack: {
      type: "bullet",
      spatial: {
        type: "spiral",
        number: 15,
        aimed: true,
        spiralPause: 5,
        shotgunAngleRange: Math.PI / 4,
      },
      firing: {
        type: "burst",
        frequency: 300,
        burstNumber: 3,
        burstPause: 30,
      },
      projectile: {
        speed: 0.05,
        modifiers: "none",
        damage: 5,
      },
      timing: {
        windup: 60,
        cooldown: 30,
      },
    },
    tag: "string",
    health: 100,
  },
];

const currentPlayerConfig = {
  hearts: 3,
  attack: {
    type: "bullet",
    spatial: {
      type: "single",
      number: 6,
      aimed: true,
      spiralPause: 0,
      shotgunAngleRange: Math.PI / 4,
    },
    firing: {
      type: "burst",
      frequency: 240,
      burstNumber: 10,
      burstPause: 30,
    },
    projectile: {
      speed: 0.1,
      modifiers: "none",
      damage: 20,
    },
    timing: {
      windup: 0,
      cooldown: 0,
    },
  },
};

class LevelManager {
  constructor(levelNumber, playerConfig) {
    this.dungeon = generateDungeonLayout(levelNumber).grid;
    this.startingRoom;

    // Set starting room
    for (let i in this.dungeon) {
      if (this.dungeon[i] != 0) {
        if (this.dungeon[i].start) {
          this.startingRoom = Number(i);
          break;
        }
      }
    }

    // Put walls wherever there are open doors
    for (let i = 0; i < this.dungeon.length; i++) {
      let room = this.dungeon[i];
      if (room == 0) continue;
      else {
        room.roomGrid = createRoom(roomConfigs[0]);

        if (i % 10 == 0 || this.dungeon[i - 1] == 0) {
          setGridTile(room.roomGrid, 0, Math.floor((GRID_HEIGHT - 1) / 2), {
            type: "wall",
            blocksLOS: "true",
            blocksMovement: true,
            entitiesContained: [],
          });
          setGridTile(room.roomGrid, 0, Math.ceil((GRID_HEIGHT - 1) / 2), {
            type: "wall",
            blocksLOS: "true",
            blocksMovement: true,
            entitiesContained: [],
          });
        }
        if (i % 10 == 9 || this.dungeon[i + 1] == 0) {
          setGridTile(
            room.roomGrid,
            GRID_WIDTH - 1,
            Math.floor((GRID_HEIGHT - 1) / 2),
            {
              type: "wall",
              blocksLOS: "true",
              blocksMovement: true,
              entitiesContained: [],
            },
          );
          setGridTile(
            room.roomGrid,
            GRID_WIDTH - 1,
            Math.ceil((GRID_HEIGHT - 1) / 2),
            {
              type: "wall",
              blocksLOS: "true",
              blocksMovement: true,
              entitiesContained: [],
            },
          );
        }
        if (Math.floor(i / 10) == 0 || this.dungeon[i - 10] == 0) {
          setGridTile(room.roomGrid, Math.floor((GRID_WIDTH - 1) / 2), 0, {
            type: "wall",
            blocksLOS: "true",
            blocksMovement: true,
            entitiesContained: [],
          });
          setGridTile(room.roomGrid, Math.ceil((GRID_WIDTH - 1) / 2), 0, {
            type: "wall",
            blocksLOS: "true",
            blocksMovement: true,
            entitiesContained: [],
          });
        }
        if (Math.floor(i / 10) == 9 || this.dungeon[i + 10] == 0) {
          setGridTile(
            room.roomGrid,
            Math.floor((GRID_WIDTH - 1) / 2),
            GRID_HEIGHT - 1,
            {
              type: "wall",
              blocksLOS: "true",
              blocksMovement: true,
              entitiesContained: [],
            },
          );
          setGridTile(
            room.roomGrid,
            Math.ceil((GRID_WIDTH - 1) / 2),
            GRID_HEIGHT - 1,
            {
              type: "wall",
              blocksLOS: "true",
              blocksMovement: true,
              entitiesContained: [],
            },
          );
        }
      }
    }

    this.currentRoom = this.startingRoom;
    this.roomGrid = this.dungeon[this.startingRoom].roomGrid;

    this.enemyProjectiles = [];
    this.playerProjectiles = [];

    this.player = new Player(
      playerConfig,
      { x: GRID_WIDTH / 2, y: GRID_HEIGHT / 2 },
      this.playerProjectiles,
    );

    this.enemies = [];

    this.playerAttack = false;
    this.doorsOpen = false;
    this.computerAdded = false;

    this.gridRenderComponentList = [];
    this.initializedRoomRenderComponents = false;
    this.initializedPlayerRenderComponent = false;
    this.playerRenderComponent;

    this.cameraRot = 0;
    this.cameraRad = 2;
  }

  spawnEnemies() {
    let eX = 0;
    let eY = 0;
    while (getGridTile(this.roomGrid, eX, eY).type != "") {
      eX = Math.floor(Math.random() * GRID_WIDTH);
      eY = Math.floor(Math.random() * GRID_HEIGHT);
    }
    this.enemies.push(
      new Enemy(
        enemyConfigs[Math.floor(Math.random() * enemyConfigs.length)],
        { x: eX + 0.5, y: eY + 0.5 },
        this.enemyProjectiles,
      ),
    );
  }
  spawnComputer() {
    let eX = 0;
    let eY = 0;
    while (getGridTile(this.roomGrid, eX, eY).type != "") {
      eX = Math.floor(Math.random() * GRID_WIDTH);
      eY = Math.floor(Math.random() * GRID_HEIGHT);
    }

    let tile = getGridTile(this.roomGrid, eX, eY);

    tile.type = "computer";
    tile.computerUsed = false;
    tile.blocksLOS = true;
    tile.blocksMovement = true;
  }

  switchRooms(direction) {
    this.currentRoom += direction;
    this.roomGrid = this.dungeon[this.currentRoom].roomGrid;

    if (direction == -1)
      this.player.pos.x = GRID_WIDTH - 1 - this.player.size.w / 2;
    else if (direction == 1) this.player.pos.x = 1 + this.player.size.w / 2;
    else if (direction == -10)
      this.player.pos.y = GRID_HEIGHT - 1 - this.player.size.h / 2;
    else if (direction == 10) this.player.pos.y = 1 + this.player.size.h / 2;

    if (!this.dungeon[this.currentRoom].cleared) {
      this.spawnEnemies();
      this.playerAttack = true;
      this.computerAdded = false;
    }

    this.initializedRoomRenderComponents = false;
  }

  update() {
    if (this.enemies.length == 0) this.playerAttack = false;
    this.player.handleUserInput();
    this.player.update(this.roomGrid, this.enemies, this.playerAttack);

    for (let enemy of this.enemies) {
      enemy.update(this.roomGrid, this.player);
    }

    for (let projectile of this.enemyProjectiles) {
      projectile.update();
    }
    for (let projectile of this.playerProjectiles) {
      projectile.update();
    }

    // Empty grid
    clearGridEntities(this.roomGrid);

    // Locate this.enemies in grid
    for (let enemy of this.enemies) {
      let minX = Math.floor(enemy.pos.x - enemy.size.w / 2);
      let maxX = Math.floor(enemy.pos.x + enemy.size.w / 2);

      let minY = Math.floor(enemy.pos.y - enemy.size.h / 2);
      let maxY = Math.floor(enemy.pos.y + enemy.size.h / 2);

      for (let i = minX; i <= maxX; i++) {
        for (let j = minY; j <= maxY; j++) {
          getGridTile(this.roomGrid, i, j).entitiesContained.push(enemy);
        }
      }
    }
    // Locate player in grid
    {
      let minX = Math.floor(this.player.pos.x - this.player.size.w / 2);
      let maxX = Math.floor(this.player.pos.x + this.player.size.w / 2);

      let minY = Math.floor(this.player.pos.y - this.player.size.h / 2);
      let maxY = Math.floor(this.player.pos.y + this.player.size.h / 2);

      for (let i = minX; i <= maxX; i++) {
        for (let j = minY; j <= maxY; j++) {
          getGridTile(this.roomGrid, i, j).entitiesContained.push(this.player);
        }
      }
    }

    // Now for projectile collisions

    // First, player projectiles
    for (let i = this.playerProjectiles.length - 1; i > -1; i--) {
      let bulletGridX = Math.floor(this.playerProjectiles[i].pos.x);
      let bulletGridY = Math.floor(this.playerProjectiles[i].pos.y);
      let gridTile = getGridTile(this.roomGrid, bulletGridX, bulletGridY);
      let projectile = this.playerProjectiles[i];

      if (gridTile.blocksLOS) {
        this.playerProjectiles[i] =
          this.playerProjectiles[this.playerProjectiles.length - 1];
        this.playerProjectiles.pop();
      } else {
        for (let entity of gridTile.entitiesContained) {
          if (
            entity instanceof Enemy &&
            pointCircle(
              projectile.pos.x,
              projectile.pos.y,
              entity.pos.x,
              entity.pos.y,
              entity.size.r,
            )
          ) {
            entity.health -= projectile.damage;
            this.playerProjectiles[i] =
              this.playerProjectiles[this.playerProjectiles.length - 1];
            this.playerProjectiles.pop();
          }
        }
      }
    }

    // Then, enemy projectiles
    for (let i = this.enemyProjectiles.length - 1; i > -1; i--) {
      let bulletGridX = Math.floor(this.enemyProjectiles[i].pos.x);
      let bulletGridY = Math.floor(this.enemyProjectiles[i].pos.y);
      let gridTile = getGridTile(this.roomGrid, bulletGridX, bulletGridY);
      let projectile = this.enemyProjectiles[i];

      if (gridTile.blocksLOS) {
        this.enemyProjectiles[i] =
          this.enemyProjectiles[this.enemyProjectiles.length - 1];
        this.enemyProjectiles.pop();
      } else {
        for (let entity of gridTile.entitiesContained) {
          if (
            entity instanceof Player &&
            pointCircle(
              projectile.pos.x,
              projectile.pos.y,
              entity.pos.x,
              entity.pos.y,
              entity.size.r,
            )
          ) {
            entity.health -= projectile.damage;
            this.enemyProjectiles[i] =
              this.enemyProjectiles[this.enemyProjectiles.length - 1];
            this.enemyProjectiles.pop();
          }
        }
      }
    }

    // Now handle removing dead enemies
    for (let i = this.enemies.length - 1; i > -1; i--) {
      if (this.enemies[i].health <= 0) {
        console.log("------------------------------");
        console.log("died");
        this.enemies[i] = this.enemies[this.enemies.length - 1];
        this.enemies.pop();
      }
    }

    if (this.enemies.length == 0) {
      this.playerAttack = false;
      this.dungeon[this.currentRoom].cleared = true;

      if (
        this.enemyProjectiles.length == 0 &&
        this.playerProjectiles.length == 0
      ) {
        if (!this.doorsOpen) {
          for (let i of this.roomGrid) {
            if (i.type == "door") {
              i.type = "door";
              i.blocksLOS = false;
              i.blocksMovement = false;
            }
          }
        }
        if (!this.computerAdded && this.dungeon[this.currentRoom].hasComputer) {
          this.spawnComputer();
          this.computerAdded = true;
        }
      }

      if (Math.floor(this.player.pos.x) == 0) {
        this.switchRooms(-1);
      } else if (Math.floor(this.player.pos.x) == GRID_WIDTH - 1) {
        this.switchRooms(1);
      } else if (Math.floor(this.player.pos.y) == 0) {
        this.switchRooms(-10);
      } else if (Math.floor(this.player.pos.y) == GRID_HEIGHT - 1) {
        this.switchRooms(10);
      }
    }
  }
  debugDisplay() {
    let displayGrid = this.roomGrid.map((val, i) => {
      return {
        pos: {
          x: getTileLocation(i).x + 0.5,
          y: getTileLocation(i).y + 0.5,
        },
        size: { w: 1, h: 1 },
        debugFill:
          val.type == "wall"
            ? "#00000080"
            : val.type == "hole"
              ? "#00330080"
              : val.type == "door"
                ? val.blocksMovement
                  ? "#000000FF"
                  : "#88888880"
                : val.type == "computer"
                  ? "#FFFF00"
                  : "#00000000",
        debugStroke: "#EEEEEE",
      };
    });

    debugRender(displayGrid);
    debugRender(this.player);
    debugRender(this.enemies);
    debugRender(this.enemyProjectiles);
    debugRender(this.playerProjectiles);
  }
  display(renderer) {
    let xOffset = this.cameraRad * Math.cos(-this.player.rotation + Math.PI);
    let zOffset = this.cameraRad * Math.sin(-this.player.rotation + Math.PI);

    renderer.scene.camera.transform.setTranslation(
      this.player.pos.x + xOffset,
      this.player.camHeight,
      this.player.pos.y + zOffset,
    );
    renderer.scene.camera.transform.setLookTowards([
      this.player.pos.x,
      0.5,
      this.player.pos.y,
    ]);

    if (!this.initializedPlayerRenderComponent) {
      this.playerRenderComponent = new RenderComponent(
        "models/Player",
        {
          translation: [this.player.pos.x, 0, this.player.pos.y],
        },
        { strength: 1 },
      );
      renderer.scene.addComponent(this.playerRenderComponent, "player");
      this.initializedPlayerRenderComponent = true;
    } else {
      this.playerRenderComponent.transform.setTranslation(
        this.player.pos.x,
        0,
        this.player.pos.y,
      );
      this.playerRenderComponent.transform.setRotation(
        0,
        (this.player.rotation * 180) / Math.PI,
        0,
      );
    }
    if (!this.initializedRoomRenderComponents) {
      renderer.scene.removeComponentsByName("levelTile");
      this.gridRenderComponentList.length = 0;
      for (let i in this.roomGrid) {
        let loc = getTileLocation(i);
        let tile = this.roomGrid[i];
        let translation = [loc.x + 0.5, 0, loc.y + 0.5];

        if (tile.type == "wall") {
          this.gridRenderComponentList.push(
            new RenderComponent(
              "models/Wall",
              {
                translation,
              },
              {
                strength: 2,
                color: [1, 1, 1],
              },
            ),
          );
        } else if (tile.type == "hole") {
          this.gridRenderComponentList.push(
            new RenderComponent(
              "models/Floor",
              {
                translation,
              },
              {
                strength: 2,
                color: [1, 0, 0],
              },
            ),
          );
        } else if (tile.type == "") {
          this.gridRenderComponentList.push(
            new RenderComponent(
              "models/Floor",
              {
                translation,
              },
              {
                strength: 2,
                color: [0.7, 1, 1],
              },
            ),
          );
        }
      }
      renderer.scene.addComponentList(
        this.gridRenderComponentList,
        "levelTile",
      );
      this.initializedRoomRenderComponents = true;
    }
    renderer.scene.removeComponentsByName("door");
    renderer.scene.removeComponentsByName("computer");
    for (let i in this.roomGrid) {
      let tile = this.roomGrid[i];
      if (tile.type == "door") {
        let loc = getTileLocation(i);
        let translation = [loc.x + 0.5, 0, loc.y + 0.5];
        if (tile.blocksLOS) {
          renderer.scene.addComponent(
            new RenderComponent(
              "models/Wall",
              {
                translation,
              },
              {
                strength: 2,
                color: [1.0, 0.3, 0.3],
              },
            ),
            "door",
          );
        } else {
          renderer.scene.addComponent(
            new RenderComponent(
              "models/Floor",
              {
                translation,
              },
              {
                strength: 2,
                color: [0.7, 1, 0.7],
              },
            ),
            "door",
          );
        }
      } else if (tile.type == "computer") {
        let loc = getTileLocation(i);
        let translation = [loc.x + 0.5, 0.5, loc.y + 0.5];
        renderer.scene.addComponent(
          new RenderComponent(
            "models/ComputerTower",
            { translation },
            { strength: 5, color: [1.0, 0.7, 1.0] },
          ),
          "computer",
        );
      }
    }

    renderer.scene.removeComponentsByName("bullet");
    for (let i of this.enemyProjectiles) {
      let renderComponent = new RenderComponent(
        "models/Bullet",
        {
          translation: [i.pos.x, 0.5, i.pos.y],
        },
        { strength: 2, color: [1.0, 0.7, 0.7] },
      );
      renderer.scene.addComponent(renderComponent, "bullet");
    }
    for (let i of this.playerProjectiles) {
      let renderComponent = new RenderComponent(
        "models/Bullet",
        {
          translation: [i.pos.x, 0.5, i.pos.y],
        },
        { strength: 2, color: [0.7, 0.7, 1.0] },
      );
      renderer.scene.addComponent(renderComponent, "bullet");
    }

    renderer.scene.removeComponentsByName("enemy");
    for (let i of this.enemies) {
      let renderComponent = new RenderComponent(
        i.mesh,
        {
          translation: [i.pos.x, 0.5, i.pos.y],
        },
        { strength: 1, color: [0.5, 0.1, 0.1] },
      );
      renderComponent.transform.setRotation(0, i.rotation, 0);
      i.rotation += i.rotationSpeed;
      renderer.scene.addComponent(renderComponent, "enemy");
    }
  }
}
