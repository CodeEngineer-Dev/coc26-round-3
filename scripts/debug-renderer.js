/*

debugRender takes a list of 

*/
var [debugRender, prepDebugCanvas] = (function () {
  const canvas = document.getElementById("debug");
  const ctx = debugCanvas.getContext("2d");

  function debugRenderSingle(i) {
    if ("x" in i && "y" in i) {
      ctx.strokeStyle = i.debugStroke || "#000000";
      ctx.fillStyle = i.debugFill || "#00000020";

      if ("w" in i && "h" in i) {
        ctx.rect(i.x, i.y, i.w, i.h);
      } else if ("r" in i) {
        ctx.arc(i.x, i.y, i.r, 0, 2 * Math.PI);
      }

      ctx.fill();
      ctx.stroke();
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
