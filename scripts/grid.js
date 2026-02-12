var [
  createGrid,
  getGridTile,
  setGridTile,
  getTileLocation,
  DDA,
  GRID_WIDTH,
  GRID_HEIGHT,
] = (function () {
  const WIDTH = 8;
  const HEIGHT = 8;

  /*
    Comes from https://lodev.org/cgtutor/raycasting.html

    Ideas for optimization:

    store integers and use bitmap flags for a grid
  */
  function createGrid() {
    return new Array(WIDTH * HEIGHT).fill(null).map((value) => {
      return {
        type: "",
        isFloor: true,
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
      else if (getGridTile(grid, mapX, mapY).type != "") hit = 1;
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

  return [
    createGrid,
    getGridTile,
    setGridTile,
    getTileLocation,
    DDA,
    WIDTH,
    HEIGHT,
  ];
})();
