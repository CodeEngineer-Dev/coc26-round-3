var [createGrid, getGridTile, setGridTile] = (function () {
  const WIDTH = 64;
  const HEIGHT = 64;

  function createGrid() {
    return new Array(WIDTH * HEIGHT).fill({
      type: "",
      isFloor: true,
    });
  }
  function getGridTile(grid, x, y) {
    if (x < WIDTH && y < HEIGHT) {
      return grid[y * HEIGHT + x];
    } else {
      throw new Error("Value not in grid");
    }
  }
  function setGridTile(grid, x, y, value) {
    if (x < WIDTH && y < HEIGHT) {
      grid[y * HEIGHT + x] = value;
    } else {
      throw new Error("Value not in grid");
    }
  }

  return [createGrid, getGridTile, setGridTile];
})();
