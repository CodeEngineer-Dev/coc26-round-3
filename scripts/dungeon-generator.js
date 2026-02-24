var [generateDungeonLayout] = (function () {
  /*

let's go isaac style: https://www.boristhebrave.com/2020/09/12/dungeon-generation-in-binding-of-isaac/

*/
  function filledNeighbors(grid, loc) {
    let neighborOffsets = [];

    if (loc % 10 != 0) {
      neighborOffsets.push(-1);
    }
    if (loc % 10 != 9) {
      neighborOffsets.push(1);
    }
    if (Math.floor(loc / 10) != 0) {
      neighborOffsets.push(-10);
    }
    if (Math.floor(loc / 10) != 9) {
      neighborOffsets.push(10);
    }
    let num = 0;
    for (let offset of neighborOffsets) {
      if (grid[loc + offset] != 0) num++;
    }
    return num;
  }
  function generatePotentialDungeon(level) {
    let grid = Array(10 * 10).fill(0);
    let numRoomsNeeded = Math.floor(Math.random() * 2 + 5 + level * 2.6);

    let startingRoom = 35;
    grid[startingRoom] = {
      type: "entrance",
      end: false,
      start: true,
      cleared: false,
      hasComputer: false,
    };

    let queue = [startingRoom];

    for (let i = 0; i < queue.length; i++) {
      let neighborOffsets = [];
      let loc = queue[i];

      if (loc % 10 != 0) {
        neighborOffsets.push(-1);
      }
      if (loc % 10 != 9) {
        neighborOffsets.push(1);
      }
      if (Math.floor(loc / 10) != 0) {
        neighborOffsets.push(-10);
      }
      if (Math.floor(loc / 10) != 9) {
        neighborOffsets.push(10);
      }

      let addedRoom = false;
      for (let offset of neighborOffsets) {
        let neighborLoc = loc + offset;
        if (grid[neighborLoc] != 0) continue;
        if (filledNeighbors(grid, neighborLoc) > 1) continue;
        if (queue.length == numRoomsNeeded) continue;
        if (Math.random() < 0.5) continue;

        grid[neighborLoc] = {
          type: "normal",
          end: false,
          start: false,
          cleared: false,
          hasComputer: Math.random() < 0.7,
        };
        queue.push(neighborLoc);
        addedRoom = true;
      }
      if (!addedRoom) {
        grid[startingRoom].end = true;
      }
    }
    grid[queue[queue.length - 1]].type = "boss";
    grid[queue[queue.length - 1]].hasComputer = true;

    return { rooms: queue.length, numRoomsNeeded, grid };
  }
  function bossRoomNextToStartingRoom(grid) {
    let bossLoc;
    let startLoc;

    for (let i in grid) {
      if (grid[i].type == "boss") {
        bossLoc = i;
      }
      if (grid[i].start) {
        startLoc = i;
      }
    }

    let diff = Math.abs(bossLoc - startLoc);
    return diff == 10 || diff == 1;
  }

  function generateDungeonLayout(level) {
    let dungeon = generatePotentialDungeon(level);
    while (
      dungeon.rooms != dungeon.numRoomsNeeded ||
      bossRoomNextToStartingRoom(dungeon.grid)
    ) {
      dungeon = generatePotentialDungeon(level);
    }

    return dungeon;
  }

  return [generateDungeonLayout];
})();
