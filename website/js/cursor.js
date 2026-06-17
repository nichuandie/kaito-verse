/**
 * KAITO Verse 光标特效
 */
const CURSOR_CONFIG = {
  imageUrl: "assets/kaito-logo.png",
  trailEnabled: true,
  clickBurst: true,
  trailInterval: 22,
  cursorHeight: 16,
  notes: ["♪", "♫", "♬", "❄"],
};

(function initCursorEffects() {
  if (window.matchMedia("(pointer: coarse)").matches) return;

  document.body.classList.add("custom-cursor");

  const dot = document.createElement("div");
  dot.className = "cursor-dot";
  document.body.appendChild(dot);

  let avatar = null;
  if (CURSOR_CONFIG.imageUrl) {
    avatar = document.createElement("img");
    avatar.className = "cursor-avatar";
    avatar.src = CURSOR_CONFIG.imageUrl;
    avatar.alt = "";
    avatar.draggable = false;
    avatar.style.height = `${CURSOR_CONFIG.cursorHeight}px`;
    document.body.appendChild(avatar);
    dot.style.display = "none";
  }

  const layer = document.createElement("div");
  layer.className = "cursor-fx-layer";
  document.body.appendChild(layer);

  let lastTrail = 0;
  let trailIndex = 0;

  function moveCursor(x, y) {
    const offsetX = CURSOR_CONFIG.imageUrl ? 8 : 0;
    const offsetY = CURSOR_CONFIG.imageUrl ? 6 : 0;
    dot.style.transform = `translate(${x - offsetX}px, ${y - offsetY}px)`;
    if (avatar) {
      avatar.style.transform = `translate(${x - offsetX}px, ${y - offsetY}px)`;
    }
  }

  function spawnTrailDot(x, y) {
    const el = document.createElement("span");
    el.className = "cursor-trail-dot";
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    layer.appendChild(el);
    el.addEventListener("animationend", () => el.remove());
  }

  function spawnNote(x, y, options = {}) {
    const note = document.createElement("span");
    note.className = "cursor-note";
    note.textContent = options.char || CURSOR_CONFIG.notes[Math.floor(Math.random() * CURSOR_CONFIG.notes.length)];
    const size = options.size || 18 + Math.random() * 10;
    const angle = options.angle ?? (Math.random() - 0.5) * Math.PI * 0.8;
    const distance = options.distance || 36 + Math.random() * 32;
    note.style.left = `${x}px`;
    note.style.top = `${y}px`;
    note.style.fontSize = `${size}px`;
    note.style.setProperty("--dx", `${Math.cos(angle) * distance}px`);
    note.style.setProperty("--dy", `${Math.sin(angle) * distance - 28}px`);
    note.style.animationDuration = `${options.duration || 0.85 + Math.random() * 0.35}s`;
    if (options.heavy) note.classList.add("cursor-note-heavy");
    layer.appendChild(note);
    note.addEventListener("animationend", () => note.remove());
  }

  function spawnRipple(x, y) {
    const ripple = document.createElement("span");
    ripple.className = "cursor-ripple";
    ripple.style.left = `${x}px`;
    ripple.style.top = `${y}px`;
    layer.appendChild(ripple);
    ripple.addEventListener("animationend", () => ripple.remove());
  }

  function spawnClickFlash(x, y) {
    const flash = document.createElement("span");
    flash.className = "cursor-flash";
    flash.style.left = `${x}px`;
    flash.style.top = `${y}px`;
    layer.appendChild(flash);
    flash.addEventListener("animationend", () => flash.remove());
  }

  document.addEventListener("mousemove", (event) => {
    moveCursor(event.clientX, event.clientY);
    if (!CURSOR_CONFIG.trailEnabled) return;

    const now = performance.now();
    if (now - lastTrail < CURSOR_CONFIG.trailInterval) return;
    lastTrail = now;
    trailIndex += 1;

    spawnTrailDot(event.clientX, event.clientY);
    if (trailIndex % 3 === 0) {
      spawnNote(event.clientX, event.clientY, {
        angle: (Math.random() - 0.5) * 0.6,
        distance: 18 + Math.random() * 14,
        size: 16 + Math.random() * 6,
        duration: 0.75,
      });
    }
  });

  document.addEventListener("mousedown", (event) => {
    if (!CURSOR_CONFIG.clickBurst) return;

    spawnRipple(event.clientX, event.clientY);
    spawnClickFlash(event.clientX, event.clientY);

    const burstCount = 14;
    for (let i = 0; i < burstCount; i += 1) {
      const angle = (Math.PI * 2 * i) / burstCount + (Math.random() - 0.5) * 0.35;
      setTimeout(() => {
        if (i % 2 === 0) {
          spawnNote(event.clientX, event.clientY, {
            angle,
            distance: 48 + Math.random() * 36,
            size: 20 + Math.random() * 12,
            duration: 1.1,
            heavy: true,
          });
        } else {
          spawnTrailDot(event.clientX + Math.cos(angle) * 12, event.clientY + Math.sin(angle) * 12);
        }
      }, i * 18);
    }

    if (avatar) avatar.classList.add("cursor-click-pop");
    dot.classList.add("cursor-click");
    setTimeout(() => {
      dot.classList.remove("cursor-click");
      if (avatar) avatar.classList.remove("cursor-click-pop");
    }, 220);
  });

  document.addEventListener("mouseleave", () => {
    dot.style.opacity = "0";
    if (avatar) avatar.style.opacity = "0";
  });

  document.addEventListener("mouseenter", () => {
    dot.style.opacity = "1";
    if (avatar) avatar.style.opacity = "1";
  });
})();
