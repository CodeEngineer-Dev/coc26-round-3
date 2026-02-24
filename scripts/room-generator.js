/* variables to tweak:

- symmetry
- wall clusters
- hole clusters


*/

// first, generate room layouts

/*

type: organic | symmetrical
symmetryAxis: 'x', 'y', 'xy'
wallNumber: a number determining the number of wall clusters
holeNumber: a number determining the number of hole clusters
clusterSize: a number determining the size of a cluster
*/

var createRoom = (function () {
  function setMirrored(mirror, grid, type, x, y, w, h) {
    let blocksLOS;
    let blocksMovement;

    if (type == "wall") {
      blocksLOS = true;
      blocksMovement = true;
    } else if (type == "hole") {
      blocksLOS = false;
      blocksMovement = true;
    }

    if (mirror == "x&y") {
      setGridTile(grid, x, y, {
        type,
        blocksLOS,
        blocksMovement,
        entitiesContained: [],
      });
      setGridTile(grid, GRID_WIDTH - x - 1, y, {
        type,
        blocksLOS,
        blocksMovement,
        entitiesContained: [],
      });
      setGridTile(grid, x, GRID_HEIGHT - y - 1, {
        type,
        blocksLOS,
        blocksMovement,
        entitiesContained: [],
      });
      setGridTile(grid, GRID_WIDTH - x - 1, GRID_HEIGHT - y - 1, {
        type,
        blocksLOS,
        blocksMovement,
        entitiesContained: [],
      });
    } else if (mirror == "xy") {
      setGridTile(grid, x, y, {
        type,
        blocksLOS,
        blocksMovement,
        entitiesContained: [],
      });
      setGridTile(
        grid,
        Math.abs(GRID_WIDTH - x - 1),
        Math.abs(GRID_HEIGHT - y - 1),
        {
          type,
          blocksLOS,
          blocksMovement,
          entitiesContained: [],
        },
      );
    } else if (mirror == "y") {
      setGridTile(grid, x, y, {
        type,
        blocksLOS,
        blocksMovement,
        entitiesContained: [],
      });
      setGridTile(grid, x, GRID_HEIGHT - y - 1, {
        type,
        blocksLOS,
        blocksMovement,
        entitiesContained: [],
      });
    } else if (mirror == "x") {
      setGridTile(grid, x, y, {
        type,
        blocksLOS,
        blocksMovement,
        entitiesContained: [],
      });
      setGridTile(grid, GRID_WIDTH - x - 1, y, {
        type,
        blocksLOS,
        blocksMovement,
        entitiesContained: [],
      });
    }
  }
  function createRoom(config) {
    let room = createGrid();

    // Create the walls and doors
    for (let i in room) {
      let tilePos = getTileLocation(i);
      if (
        tilePos.x == 0 ||
        tilePos.y == 0 ||
        tilePos.x == GRID_WIDTH - 1 ||
        tilePos.y == GRID_HEIGHT - 1
      ) {
        room[i].type = "wall";
        room[i].blocksLOS = "true";
        room[i].blocksMovement = true;
      }

      if (
        ((tilePos.x == Math.floor((GRID_WIDTH - 1) / 2) ||
          tilePos.x == Math.ceil((GRID_WIDTH - 1) / 2)) &&
          (tilePos.y == 0 || tilePos.y == GRID_HEIGHT - 1)) ||
        ((tilePos.y == Math.floor((GRID_HEIGHT - 1) / 2) ||
          tilePos.y == Math.ceil((GRID_HEIGHT - 1) / 2)) &&
          (tilePos.x == 0 || tilePos.x == GRID_WIDTH - 1))
      ) {
        room[i].type = "door";
        room[i].blocksLOS = "true";
        room[i].blocksMovement = true;
      }
    }

    if (config.type == "symmetric") {
      let maxX;
      let maxY;

      if (config.symmetryType == "x&y") {
        maxX = Math.floor(GRID_WIDTH / 2);
        maxY = Math.floor(GRID_HEIGHT / 2);
      } else if (config.symmetryType == "y") {
        maxX = Math.floor(GRID_WIDTH);
        maxY = Math.floor(GRID_HEIGHT / 2);
      } else if (config.symmetryType == "x") {
        maxX = Math.floor(GRID_WIDTH / 2);
        maxY = Math.floor(GRID_HEIGHT);
      } else if (config.symmetryType == "xy") {
        maxX = Math.floor(GRID_WIDTH);
        maxY = Math.floor(GRID_HEIGHT);
      }

      for (let i = 0; i < config.wallNumber; i++) {
        let randX =
          Math.floor(Math.random() * (maxX - config.clusterSize.w - 1)) + 1;
        let randY =
          Math.floor(Math.random() * (maxY - config.clusterSize.h - 1)) + 1;

        for (let i = 0; i < config.clusterSize.w; i++) {
          for (let j = 0; j < config.clusterSize.h; j++) {
            setMirrored(
              config.symmetryType,
              room,
              "wall",
              randX,
              randY,
              config.clusterSize.w,
              config.clusterSize.h,
            );

            randY++;
          }
          randX++;
          randY -= config.clusterSize.h;
        }
      }

      for (let i = 0; i < config.holeNumber; i++) {
        let randX =
          Math.floor(Math.random() * (maxX - config.clusterSize.w - 1)) + 1;
        let randY =
          Math.floor(Math.random() * (maxY - config.clusterSize.h - 1)) + 1;

        for (let i = 0; i < config.clusterSize.w; i++) {
          for (let j = 0; j < config.clusterSize.h; j++) {
            setMirrored(
              config.symmetryType,
              room,
              "hole",
              randX,
              randY,
              config.clusterSize.w,
              config.clusterSize.h,
            );
            randY++;
          }
          randX++;
          randY -= config.clusterSize.h;
        }
      }
    }

    return room;
  }

  return createRoom;
})();
