const canvas = document.querySelector("canvas");
const ctx = canvas.getContext("2d");
let last = performance.now();

function update(dt) {
  // Atualize a física usando segundos, não milissegundos.
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  update(dt);
  render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
