/*

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
                singlesBurst: number,
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

var upgrades = {
  light: [
    {
      text: "Increase walking speed by 1%",
      attribute: "speed",
      operator: "multiply",
      value: 1.01,
    },
    {
      text: "Increase projectile speed by 1%",
      attribute: "attack.projectile.speed",
      operator: "multiply",
      value: 1.01,
    },
    {
      text: "Increase projectile damage effect by 1%",
      attribute: "attack.projectile.damage",
      operator: "multiply",
      value: 1.01,
    },
    {
      text: "Decrease cooldown time by 1%",
      attribute: "attack.timing.cooldown",
      operator: "multiply",
      value: 0.99,
    },
    {
      text: "Decrease windup time by 1%",
      attribute: "attack.timing.windup",
      operator: "multiply",
      value: 0.99,
    },
    {
      text: "Decrease firing delay by 1%",
      attribute: "attack.firing.frequency",
      operator: "multiply",
      value: 0.99,
    },
    {
      text: "Restore lives by 1",
      attribute: "hearts",
      operator: "add",
      value: 1,
    },
    {
      text: "Increase number of bullets fired by 1",
      attribute: "attack.spatial.number",
      operator: "add",
      value: 1,
    },
  ],
  normal: [
    {
      text: "Increase projectile damage effect by 5%",
      attribute: "attack.projectile.damage",
      operator: "multiply",
      value: 1.05,
    },
    {
      text: "Increase number of bullets fired by 3",
      attribute: "attack.spatial.number",
      operator: "add",
      value: 3,
    },
    {
      text: "Decrease firing delay by 5%",
      attribute: "attack.firing.frequency",
      operator: "multiply",
      value: 0.95,
    },
    {
      text: "Increase projectile speed by 5%",
      attribute: "attack.projectile.speed",
      operator: "multiply",
      value: 1.05,
    },
    {
      text: "Increase lives capacity by 1",
      attribute: "totalHearts",
      operator: "add",
      value: 1,
    },
    {
      text: "Restore lives by 3",
      attribute: "hearts",
      operator: "add",
      value: 3,
    },
  ],
  boss: [
    {
      text: "Upgrade weapon to shotgun",
      attribute: "attack.spatial.type",
      operator: "equals",
      value: "shotgun",
    },
    {
      text: "Upgrade weapon to radial",
      attribute: "attack.spatial.type",
      operator: "equals",
      value: "radial",
    },
    {
      text: "Increase burst number by 1",
      attribute: "attack.firing.burstNumber",
      operator: "add",
      value: 1,
    },
    {
      text: "Increase number of bullets fired by 5",
      attribute: "attack.spatial.number",
      operator: "add",
      value: 3,
    },
    {
      text: "Increase lives capacity by 3",
      attribute: "totalHearts",
      operator: "add",
      value: 3,
    },
  ],
};

var [pickUpgrades, applyUpgrade, upgradeScreen] = (function () {
  function pickRandom(array) {
    return array[Math.floor(Math.random() * array.length)];
  }
  function pickUpgrades(roomType) {
    let u;

    if (roomType == "normal") {
      let one;
      let two;
      let three;

      while (one == two || two == three || one == three) {
        one =
          Math.random() < 0.9
            ? pickRandom(upgrades.light)
            : pickRandom(upgrades.normal);
        two =
          Math.random() < 0.8
            ? pickRandom(upgrades.light)
            : pickRandom(upgrades.normal);
        three =
          Math.random() < 0.7
            ? pickRandom(upgrades.light)
            : pickRandom(upgrades.normal);
      }

      u = [one, two, three];
    } else if (roomType == "boss") {
      let one;
      let two;
      let three;

      while (one == two || two == three || one == three) {
        one =
          Math.random() < 0.9
            ? pickRandom(upgrades.normal)
            : pickRandom(upgrades.boss);
        two =
          Math.random() < 0.8
            ? pickRandom(upgrades.normal)
            : pickRandom(upgrades.boss);
        three =
          Math.random() < 0.7
            ? pickRandom(upgrades.normal)
            : pickRandom(upgrades.boss);
      }

      u = [one, two, three];
    }

    return u;
  }
  function applyUpgrade(upgrade, playerConfig, player) {
    let attribute = upgrade.attribute.split(".");
    let parentObj = playerConfig;
    for (let i in attribute) {
      if (i != attribute.length - 1) parentObj = parentObj[attribute[i]];
    }
    switch (upgrade.operator) {
      case "add":
        parentObj[attribute[attribute.length - 1]] += upgrade.value;
        break;
      case "multiply":
        parentObj[attribute[attribute.length - 1]] *= upgrade.value;
        break;
      case "equals":
        parentObj[attribute[attribute.length - 1]] = upgrade.value;
        break;
    }
    console.log(playerConfig);
    player.backupTiming = structuredClone(playerConfig.attack.timing);
    player.attack.timing = structuredClone(playerConfig.attack.timing);
    if (player.hearts > player.totalHearts) player.hearts = player.totalHearts;
  }

  function upgradeScreen(selectedUpgrades, selectUpgradeSlot) {
    const canvas = document.getElementById("overlay");
    const ctx = canvas.getContext("2d");

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.font = "48px sans-serif";
    ctx.fillStyle = "rgba(255, 255, 255, 1.0)";
    ctx.textAlign = "center";
    ctx.fillText("UPGRADE UNLOCKED!", canvas.width / 2, 100);

    ctx.font = "24px sans-serif";
    ctx.fillText("choose one upgrade", canvas.width / 2, 200);

    for (let i in selectedUpgrades) {
      ctx.strokeStyle = "white";
      ctx.strokeWidth = 2;
      if (
        mouseX > 50 &&
        mouseX < canvas.width - 100 &&
        mouseY > 250 + 72 * i &&
        mouseY < 250 + 72 * i + 48
      ) {
        ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
        ctx.fillRect(50, 250 + 72 * i, canvas.width - 100, 48);
        ctx.fillText(
          selectedUpgrades[i].text,
          canvas.width / 2,
          250 + 72 * i + 36,
        );
        if (mousePressed) {
          selectUpgradeSlot.upgrade = selectedUpgrades[i];
          return true;
        }
      } else {
        ctx.strokeRect(50, 250 + 72 * i, canvas.width - 100, 48);
        ctx.strokeText(
          selectedUpgrades[i].text,
          canvas.width / 2,
          250 + 72 * i + 36,
        );
      }
    }
  }

  return [pickUpgrades, applyUpgrade, upgradeScreen];
})();
