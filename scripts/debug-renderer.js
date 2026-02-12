var [debugRender, prepDebugCanvas] = (function () {
  const canvas = document.getElementById("debug");
  const ctx = canvas.getContext("2d");
  const SCALE = 18;

  function debugRenderSingle(i) {
    if ("x" in i && "y" in i) {
      ctx.beginPath();
      if ("w" in i && "h" in i) {
        ctx.rect(i.x * SCALE, i.y * SCALE, i.w * SCALE, i.h * SCALE);
      } else if ("r" in i) {
        ctx.arc(i.x * SCALE, i.y * SCALE, i.r * SCALE, 0, 2 * Math.PI);
      } else if ("x2" in i && "y2" in i) {
        ctx.moveTo(i.x * SCALE, i.y * SCALE);
        ctx.lineTo(i.x2 * SCALE, i.y2 * SCALE);
      }

      ctx.strokeStyle = i.debugStroke || "#000000";
      ctx.fillStyle = i.debugFill || "#00000010";
      ctx.fill();
      ctx.stroke();
      ctx.closePath();
    }
  }
  function debugRenderArray(entities) {
    for (let i of entities) {
      debugRenderSingle(i);
    }
  }
  function debugRender(object) {
    if (Array.isArray(object)) debugRenderArray(object);
    else debugRenderSingle(object);
  }
  function prepDebugCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  return [debugRender, prepDebugCanvas];
})();
