var [
  createGrid,
  getGridTile,
  setGridTile,
  getTileLocation,
  DDA,
  handleGridCollision,
  clearGridEntities,
  GRID_WIDTH,
  GRID_HEIGHT,
] = (function () {
  const WIDTH = 24;
  const HEIGHT = 24;

  /*
    Comes from https://lodev.org/cgtutor/raycasting.html

    Ideas for optimization:

    store integers and use bitmap flags for a grid
  */
  function createGrid() {
    return new Array(WIDTH * HEIGHT).fill(null).map((value) => {
      return {
        type: "",
        blocksLOS: false,
        blocksMovement: false,
        entitiesContained: [],
      };
    });
  }
  function getGridTile(grid, x, y) {
    if (x < WIDTH && y < HEIGHT) {
      return grid[y * WIDTH + x];
    } else {
      throw new Error("Value not in grid");
    }
  }
  function getTileLocation(index) {
    return { x: index % WIDTH, y: Math.floor(index / HEIGHT) };
  }
  function setGridTile(grid, x, y, value) {
    if (x < WIDTH && y < HEIGHT) {
      grid[y * WIDTH + x] = value;
    } else {
      throw new Error("Value not in grid");
    }
  }
  function clearGridEntities(grid) {
    for (let i of grid) {
      i.entitiesContained.length = 0;
    }
  }

  function DDA(grid, x, y, angle) {
    angle = angle % (2 * Math.PI);
    if (angle < 0) angle += 2 * Math.PI;

    let rayDirX = Math.cos(angle);
    let rayDirY = Math.sin(angle);

    let mapX = Math.floor(x);
    let mapY = Math.floor(y);

    let sideDistX;
    let sideDistY;
    let perpWallDist;

    let deltaDistX = Math.abs(1 / rayDirX);
    let deltaDistY = Math.abs(1 / rayDirY);

    let stepX;
    let stepY;

    let hit = 0;
    let side;

    if (rayDirX < 0) {
      stepX = -1;
      sideDistX = (x - mapX) * deltaDistX;
    } else {
      stepX = 1;
      sideDistX = (mapX + 1.0 - x) * deltaDistX;
    }

    if (rayDirY < 0) {
      stepY = -1;
      sideDistY = (y - mapY) * deltaDistY;
    } else {
      stepY = 1;
      sideDistY = (mapY + 1.0 - y) * deltaDistY;
    }

    let cellsIntersected = [];

    while (hit == 0) {
      if (sideDistX < sideDistY) {
        sideDistX += deltaDistX;
        mapX += stepX;
        side = 0;
      } else {
        sideDistY += deltaDistY;
        mapY += stepY;
        side = 1;
      }

      if (mapX < 0 || mapX >= WIDTH) hit = 2;
      else if (mapY < 0 || mapY >= HEIGHT) hit = 2;
      else if (getGridTile(grid, mapX, mapY).blocksLOS) hit = 1;
      else cellsIntersected.push({ x: mapX, y: mapY });
    }

    if (side == 0) {
      perpWallDist = sideDistX - deltaDistX;
    } else {
      perpWallDist = sideDistY - deltaDistY;
    }

    if (hit == 1) {
      let normal;

      if (side == 0) {
        if (stepX == -1) normal = "right";
        else if (stepX == 1) normal = "left";
      } else if (side == 1) {
        if (stepY == -1) normal = "bottom";
        else if (stepY == 1) normal = "top";
      }

      return {
        hit: true,
        hitPosition: {
          x: x + perpWallDist * rayDirX,
          y: y + perpWallDist * rayDirY,
        },
        hitCell: { x: mapX, y: mapY },
        distanceTraveled: side == 0 ? sideDistX : sideDistY,
        normalHit: normal,
        cellsIntersected,
      };
    } else {
      return {
        hit: false,
        hitPosition: {
          x: x + perpWallDist * rayDirX,
          y: y + perpWallDist * rayDirY,
        },
        cellsIntersected,
      };
    }
  }

  function handleGridCollision(grid, entity, direction) {
    const FLOATING_POINT_MARGIN = 0.001;
    if (direction == "x") {
      if (entity.dir.x > 0) {
        let tileX = Math.floor(entity.pos.x + entity.size.w / 2);
        let minY = Math.floor(entity.pos.y - entity.size.h / 2);
        let maxY = Math.floor(entity.pos.y + entity.size.h / 2);

        for (var y = minY; y <= maxY; y++) {
          if (getGridTile(grid, tileX, y).blocksMovement) {
            entity.pos.x = tileX - entity.size.w / 2 - FLOATING_POINT_MARGIN;
            break;
          }
        }
      } else if (entity.dir.x < 0) {
        let tileX = Math.floor(entity.pos.x - entity.size.w / 2);
        let minY = Math.floor(entity.pos.y - entity.size.h / 2);
        let maxY = Math.floor(entity.pos.y + entity.size.h / 2);

        for (var y = minY; y <= maxY; y++) {
          if (getGridTile(grid, tileX, y).blocksMovement) {
            entity.pos.x =
              tileX + 1 + entity.size.w / 2 + FLOATING_POINT_MARGIN;
            break;
          }
        }
      }
    } else if (direction == "y") {
      if (entity.dir.y > 0) {
        let tileY = Math.floor(entity.pos.y + entity.size.h / 2);
        let minX = Math.floor(entity.pos.x - entity.size.w / 2);
        let maxX = Math.floor(entity.pos.x + entity.size.w / 2);

        for (var x = minX; x <= maxX; x++) {
          if (getGridTile(grid, x, tileY).blocksMovement) {
            entity.pos.y = tileY - entity.size.h / 2 - FLOATING_POINT_MARGIN;
            break;
          }
        }
      } else if (entity.dir.y < 0) {
        let tileY = Math.floor(entity.pos.y - entity.size.h / 2);
        let minX = Math.floor(entity.pos.x - entity.size.w / 2);
        let maxX = Math.floor(entity.pos.x + entity.size.w / 2);

        for (var x = minX; x <= maxX; x++) {
          if (getGridTile(grid, x, tileY).blocksMovement) {
            entity.pos.y =
              tileY + 1 + entity.size.h / 2 + FLOATING_POINT_MARGIN;
            break;
          }
        }
      }
    }
  }

  return [
    createGrid,
    getGridTile,
    setGridTile,
    getTileLocation,
    DDA,
    handleGridCollision,
    clearGridEntities,
    WIDTH,
    HEIGHT,
  ];
})();
