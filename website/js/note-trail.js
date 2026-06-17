/**
 * 轻量音符拖尾（保留系统光标，低亮度）
 */
(function initNoteTrail() {
  if (window.matchMedia("(pointer: coarse)").matches) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const NOTES = ["♪", "♫", "♬"];
  const layer = document.createElement("div");
  layer.className = "note-trail-layer";
  document.body.appendChild(layer);

  let lastSpawn = 0;
  let noteIndex = 0;
  const SPAWN_INTERVAL = 155;

  function spawnNote(x, y) {
    const note = document.createElement("span");
    note.className = "note-trail-item";
    note.textContent = NOTES[noteIndex % NOTES.length];
    noteIndex += 1;
    note.style.left = `${x}px`;
    note.style.top = `${y}px`;
    const drift = (Math.random() - 0.5) * 30;
    note.style.setProperty("--note-drift", `${drift}px`);
    layer.appendChild(note);
    note.addEventListener("animationend", () => note.remove(), { once: true });
  }

  document.addEventListener(
    "mousemove",
    (event) => {
      const now = performance.now();
      if (now - lastSpawn < SPAWN_INTERVAL) return;
      lastSpawn = now;
      spawnNote(event.clientX, event.clientY);
    },
    { passive: true }
  );
})();
