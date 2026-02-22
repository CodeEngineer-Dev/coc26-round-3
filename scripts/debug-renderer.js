var [debugRender, prepDebugCanvas] = (function () {
  const canvas = document.getElementById("debug");
  const ctx = canvas.getContext("2d");
  const SCALE = 35;

  function debugRenderSingle(i) {
    if ("pos" in i && "size" in i) {
      ctx.beginPath();
      if ("w" in i.size && "h" in i.size) {
        ctx.rect(
          (i.pos.x - i.size.w / 2) * SCALE,
          (i.pos.y - i.size.h / 2) * SCALE,
          i.size.w * SCALE,
          i.size.h * SCALE,
        );
      } else if ("r" in i.size) {
        ctx.arc(
          i.pos.x * SCALE,
          i.pos.y * SCALE,
          i.size.r * SCALE,
          0,
          2 * Math.PI,
        );
      } else if ("x2" in i.pos && "y2" in i.pos) {
        ctx.moveTo(i.pos.x * SCALE, i.pos.y * SCALE);
        ctx.lineTo(i.pos.x2 * SCALE, i.pos.y2 * SCALE);
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
