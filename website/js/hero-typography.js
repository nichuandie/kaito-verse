/**
 * Hero：KAITO 文字构成 — 静态缓存 + 轻量浮动（性能优化）
 */

const HERO_TYPO = {
  canvas: null,
  ctx: null,
  baseCanvas: null,
  baseCtx: null,
  tooltip: null,
  mask: null,
  assignments: [],
  hoverIndex: -1,
  linkedIds: new Set(),
  songs: [],
  progress: 1,
  animTime: 0,
  baseBaked: false,
  raf: 0,
  parallax: { targetX: 0, targetY: 0, currentX: 0, currentY: 0 },
  reducedMotion: false,
};

const HERO_IMAGE = "./assets/kaito-dynamic.png";
const HERO_CANVAS_WIDTH = 700;
const HERO_CELL_SIZE = 6;
const HERO_PRODUCER_COUNT = 14;
const HERO_SONG_COUNT = 32;

function normalizeProducer(name) {
  return (name || "").split(/[/／|]/)[0].trim();
}

function cellHash(cell, seed = 0) {
  return ((cell.x * 73856093) ^ (cell.y * 19349663) ^ seed) >>> 0;
}

function cellDist(a, b) {
  return Math.hypot(a.cx - b.cx, a.cy - b.cy);
}

function canPlaceAt(cell, placed, minDist) {
  return placed.every((p) => cellDist(cell, p) >= minDist);
}

function pickEntry(entries, cell, seed) {
  return entries[cellHash(cell, seed) % entries.length];
}

function buildHeroEntries(songs) {
  const entries = [];
  const producerCounts = new Map();

  for (const song of songs) {
    const p = normalizeProducer(song.producer);
    if (!p || p.length < 2) continue;
    producerCounts.set(p, (producerCounts.get(p) || 0) + 1);
  }

  const topProducers = [...producerCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, HERO_PRODUCER_COUNT);

  const maxCount = topProducers[0]?.[1] || 1;
  for (const [name, count] of topProducers) {
    entries.push({
      id: `p:${name}`,
      label: name,
      weight: count / maxCount,
      color: "#ffd166",
      kind: "producer",
      producerName: name,
      producerCount: count,
      meta: `P主 · 合作 ${count} 次`,
      url: null,
    });
  }

  const topSongs = [...songs]
    .filter((s) => s.name?.trim())
    .sort((a, b) => (b.rating || 0) - (a.rating || 0))
    .slice(0, HERO_SONG_COUNT);

  const maxRating = topSongs[0]?.rating || 1;
  for (const song of topSongs) {
    const rating = song.rating || 0;
    entries.push({
      id: `s:${song.name}`,
      label: song.name,
      weight: rating / Math.max(1, maxRating),
      color: song.solo ? "#7ec8ff" : "#48cae4",
      kind: "song",
      song,
      meta: `${song.solo ? "KAITO 独唱" : "合唱"} · ★${rating}`,
      url: song.url,
    });
  }

  return entries.sort((a, b) => b.weight - a.weight);
}

function buildHeroAssignments(mask, entries) {
  const { maskCells } = mask;
  if (!maskCells.length || !entries.length) return [];

  const cx = maskCells.reduce((sum, c) => sum + c.cx, 0) / maskCells.length;
  const cy = maskCells.reduce((sum, c) => sum + c.cy, 0) / maskCells.length;
  const maxDist = Math.max(...maskCells.map((c) => cellDist(c, { cx, cy })));

  const byCenter = [...maskCells].sort(
    (a, b) => cellDist(a, { cx, cy }) - cellDist(b, { cx, cy })
  );
  const shuffled = [...maskCells].sort(
    (a, b) => (cellHash(a, 1) % 997) - (cellHash(b, 1) % 997)
  );

  const placed = [];

  function addItem(cell, entry, fontSize, opacity, layer, maxChars) {
    placed.push({
      cx: cell.cx,
      cy: cell.cy,
      entry,
      label: shortenLabel(entry.label, maxChars),
      fontSize,
      color: entry.color,
      opacity,
      rotation: ((cellHash(cell, layer) % 25) - 12) * (layer === 0 ? 0.62 : layer === 1 ? 0.82 : 0.52),
      floatPhase: (cellHash(cell, 99) % 6283) / 1000,
      floatSpeed: 1.4 + (cellHash(cell, 77) % 80) / 100,
      layer,
      index: placed.length,
    });
  }

  for (const cell of shuffled) {
    if (cellHash(cell, 2) % 100 > 48) continue;
    if (!canPlaceAt(cell, placed, 5)) continue;
    const entry = pickEntry(entries, cell, 3);
    addItem(cell, entry, lerp(5.5, 8, entry.weight), lerp(0.42, 0.62, entry.weight), 0, 4);
  }

  for (const cell of shuffled) {
    if (cellHash(cell, 4) % 100 > 58) continue;
    const entry = pickEntry(entries, cell, 5);
    const fontSize = lerp(8.5, 15, entry.weight);
    if (!canPlaceAt(cell, placed, fontSize * 0.85)) continue;
    addItem(cell, entry, fontSize, lerp(0.68, 0.94, entry.weight), 1, 5);
  }

  const featured = entries.slice(0, Math.min(22, entries.length));
  for (const entry of featured) {
    const fontSize = lerp(16, 30, entry.weight);
    const minDist = fontSize * 1.05;
    const pool = byCenter.filter((c) => cellDist(c, { cx, cy }) < maxDist * 0.92);
    const cell =
      pool.find((c) => canPlaceAt(c, placed, minDist)) ||
      shuffled.find((c) => canPlaceAt(c, placed, minDist));
    if (!cell) continue;
    addItem(cell, entry, fontSize, lerp(0.92, 1, entry.weight), 2, fontSize > 19 ? 7 : 6);
  }

  return placed.sort((a, b) => a.layer - b.layer);
}

function drawHeroItem(ctx, item, alpha, glow, linked = false) {
  const depth = item.layer >= 2 ? 2 : item.layer === 1 ? 1.3 : 0;
  const lite = item.layer === 0;
  const accent =
    linked && typeof getAudioReactiveVoicebankColor === "function"
      ? getAudioReactiveVoicebankColor()
      : item.color;

  ctx.save();
  ctx.translate(item.cx, item.cy);
  ctx.rotate((item.rotation * Math.PI) / 180);
  if (item.scale && item.scale !== 1) ctx.scale(item.scale, item.scale);

  ctx.font = `600 ${item.fontSize}px "Noto Sans SC", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  if (!lite && depth > 0) {
    ctx.globalAlpha = alpha * 0.4;
    ctx.fillStyle = "rgba(0, 18, 48, 0.85)";
    ctx.fillText(item.label, depth, depth * 1.05);
    ctx.globalAlpha = alpha * 0.15;
    ctx.fillStyle = "rgba(180, 230, 255, 0.85)";
    ctx.fillText(item.label, -0.5, -0.5);
  }

  ctx.globalAlpha = alpha;
  ctx.fillStyle = linked ? accent : item.color;
  if (glow || linked) {
    ctx.shadowColor = linked ? accent : item.color;
    ctx.shadowBlur = linked ? Math.max(glow || 0, 16) : glow;
  }
  ctx.fillText(item.label, 0, 0);
  ctx.restore();
}

function getAudioReactiveVoicebankColor() {
  if (typeof AudioReactive !== "undefined" && AudioReactive.voicebankColor) {
    return AudioReactive.voicebankColor;
  }
  return "#7ec8ff";
}

function setHeroTypoHighlight(focus) {
  HERO_TYPO.linkedIds = new Set();
  if (!focus || !HERO_TYPO.assignments.length) return;

  const title = (focus.title || "").trim().toLowerCase();
  const producer = normalizeProducer(focus.producer || "").toLowerCase();

  for (const item of HERO_TYPO.assignments) {
    const entry = item.entry;
    if (!entry) continue;
    if (title && entry.kind === "song") {
      const songName = (entry.song?.name || entry.label || "").trim().toLowerCase();
      if (songName === title || songName.includes(title) || title.includes(songName)) {
        HERO_TYPO.linkedIds.add(entry.id);
      }
    }
    if (producer && entry.kind === "producer") {
      const pName = (entry.producerName || entry.label || "").trim().toLowerCase();
      if (pName === producer || pName.includes(producer) || producer.includes(pName)) {
        HERO_TYPO.linkedIds.add(entry.id);
      }
    }
  }
}

window.setHeroTypoHighlight = setHeroTypoHighlight;

function bakeHeroBaseLayer() {
  const { baseCtx, mask, assignments } = HERO_TYPO;
  if (!baseCtx || !mask) return;

  const { width, height } = mask;
  baseCtx.clearRect(0, 0, width, height);

  for (const item of assignments) {
    if (item.layer >= 2) continue;
    drawHeroItem(baseCtx, item, item.opacity, 0);
  }

  HERO_TYPO.baseBaked = true;
}

function getItemFloat(item, animTime) {
  if (HERO_TYPO.reducedMotion) {
    return { dx: 0, dy: 0, scale: 1 };
  }
  const phase = item.floatPhase;
  const speed = item.floatSpeed;
  return {
    dx: Math.cos(animTime * speed * 0.6 + phase) * 0.8,
    dy: Math.sin(animTime * speed * 0.75 + phase * 1.4) * 1.8,
    scale: 1 + Math.sin(animTime * speed + phase) * 0.05,
  };
}

function syncHeroTypoBackdrop() {
  const canvas = HERO_TYPO.canvas;
  const backdrop = document.getElementById("hero-typo-backdrop");
  if (!canvas || !backdrop || !HERO_TYPO.mask) return;
  const w = canvas.style.width || `${HERO_TYPO.mask.width}px`;
  const h = canvas.style.height || `${HERO_TYPO.mask.height}px`;
  backdrop.style.width = w;
  backdrop.style.height = h;
  if (typeof resolveSitePath === "function") {
    backdrop.src = resolveSitePath("./assets/kaito-dynamic.png");
  }
}

function drawHeroIntroFrame(progress) {
  const { ctx, mask, assignments, hoverIndex, animTime } = HERO_TYPO;
  if (!ctx || !mask) return;

  const { width, height } = mask;
  ctx.clearRect(0, 0, width, height);
  const visible = Math.floor(assignments.length * easeOutCubic(progress));

  for (let i = 0; i < visible; i++) {
    const item = assignments[i];
    const stagger = item.layer * 0.08;
    const itemProgress = Math.min(1, Math.max(0, (progress - stagger) / (1 - stagger)));
    let alpha = item.opacity * easeOutCubic(itemProgress);
    if (alpha <= 0.01) continue;

    const entryId = item.entry?.id;
    const isLinked = entryId && HERO_TYPO.linkedIds.has(entryId);
    const hasLink = HERO_TYPO.linkedIds.size > 0;
    if (hasLink && !isLinked) alpha *= 0.32;

    const { dx, dy, scale } = getItemFloat(item, animTime);
    const isHover = i === hoverIndex;
    drawHeroItem(
      ctx,
      { ...item, cx: item.cx + dx, cy: item.cy + dy, scale },
      isHover || isLinked ? 1 : alpha,
      isHover ? 12 : isLinked ? 14 : 0,
      isLinked
    );
  }
}

function drawHeroFastFrame() {
  const { ctx, baseCanvas, mask, assignments, hoverIndex, animTime } = HERO_TYPO;
  if (!ctx || !mask || !baseCanvas) return;

  const { width, height } = mask;
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(baseCanvas, 0, 0);

  for (const item of assignments) {
    if (item.layer < 2) continue;
    const entryId = item.entry?.id;
    const isLinked = entryId && HERO_TYPO.linkedIds.has(entryId);
    const hasLink = HERO_TYPO.linkedIds.size > 0;
    let alpha = item.opacity;
    if (hasLink && !isLinked) alpha *= 0.32;

    const { dx, dy, scale } = getItemFloat(item, animTime);
    const isHover = item.index === hoverIndex;
    drawHeroItem(
      ctx,
      { ...item, cx: item.cx + dx, cy: item.cy + dy, scale },
      isHover || isLinked ? 1 : alpha,
      isHover ? 12 : isLinked ? 14 : 0,
      isLinked
    );
  }
}

function updateHeroParallax(wrap) {
  const p = HERO_TYPO.parallax;
  p.currentX = lerp(p.currentX, p.targetX, 0.06);
  p.currentY = lerp(p.currentY, p.targetY, 0.06);
  const breath = HERO_TYPO.reducedMotion ? 1 : 1 + Math.sin(HERO_TYPO.animTime * 1.15) * 0.012;
  wrap.style.transform = `translate3d(${p.currentX}px, ${p.currentY}px, 0) scale(${breath})`;
}

function startHeroLoop() {
  cancelAnimationFrame(HERO_TYPO.raf);
  HERO_TYPO.baseBaked = false;

  const wrap = document.querySelector(".hero-typo-wrap");
  const introStart = performance.now();
  const introDuration = 1200;
  let lastFrame = introStart;

  function tick(now) {
    if (document.hidden) {
      HERO_TYPO.raf = requestAnimationFrame(tick);
      return;
    }

    const elapsed = now - lastFrame;
    if (elapsed < 40) {
      HERO_TYPO.raf = requestAnimationFrame(tick);
      return;
    }
    lastFrame = now;

    HERO_TYPO.animTime = now * 0.001;
    HERO_TYPO.progress = Math.min(1, (now - introStart) / introDuration);

    if (wrap) updateHeroParallax(wrap);

    if (HERO_TYPO.progress < 1) {
      drawHeroIntroFrame(HERO_TYPO.progress);
    } else {
      if (!HERO_TYPO.baseBaked) bakeHeroBaseLayer();
      drawHeroFastFrame();
    }

    HERO_TYPO.raf = requestAnimationFrame(tick);
  }

  HERO_TYPO.raf = requestAnimationFrame(tick);
}

function heroItemAtEvent(event) {
  const { canvas, assignments, progress, animTime } = HERO_TYPO;
  if (!canvas) return null;

  const rect = canvas.getBoundingClientRect();
  const px = ((event.clientX - rect.left) / rect.width) * canvas.width;
  const py = ((event.clientY - rect.top) / rect.height) * canvas.height;
  const limit =
    progress < 1
      ? Math.floor(assignments.length * easeOutCubic(progress))
      : assignments.length;

  let best = null;
  let bestDist = Infinity;

  for (let i = 0; i < limit; i++) {
    const item = assignments[i];
    const { dx, dy, scale } = getItemFloat(item, animTime);
    const hit = item.fontSize * scale * (item.layer >= 2 ? 0.75 : 0.5);
    const d = Math.hypot(px - item.cx - dx, py - item.cy - dy);
    if (d < hit && d < bestDist) {
      best = { ...item, index: i };
      bestDist = d;
    }
  }
  return best;
}

function formatHeroTooltip(entry) {
  if (entry.kind === "song" && entry.song) {
    const s = entry.song;
    const vocalists =
      typeof s.vocalists === "string"
        ? s.vocalists
        : (s.vocalists || []).map((v) => v.name || v).join(" / ");
    const date = s.date || s.publish_date || "—";
    const type = s.type || "—";
    const rating = s.rating ? `★ ${s.rating}` : "暂无评分";
    const mode = s.solo ? "KAITO 独唱" : "合唱 / 共演";
    const linkHint = s.url ? "点击打开 VocaDB" : "";
    return `
      <strong>${escapeHtml(s.name || entry.label)}</strong>
      <span class="hero-tip-row">${escapeHtml(mode)} · ${escapeHtml(rating)}</span>
      <span class="hero-tip-row">P主：${escapeHtml(s.producer || "—")}</span>
      <span class="hero-tip-row">演唱：${escapeHtml(vocalists || "—")}</span>
      <span class="hero-tip-row">类型：${escapeHtml(type)} · ${escapeHtml(String(date).slice(0, 10))}</span>
      ${linkHint ? `<span class="hero-tip-hint">${linkHint}</span>` : ""}`;
  }

  if (entry.kind === "producer") {
    const count = entry.producerCount || 0;
    const related = HERO_TYPO.songs.filter(
      (s) => normalizeProducer(s.producer) === entry.producerName
    );
    const topRated = [...related]
      .sort((a, b) => (b.rating || 0) - (a.rating || 0))
      .slice(0, 3)
      .map((s) => s.name)
      .filter(Boolean);
    const samples = topRated.length
      ? topRated.map((n) => escapeHtml(shortenLabel(n, 12))).join(" · ")
      : "—";
    return `
      <strong>${escapeHtml(entry.label)}</strong>
      <span class="hero-tip-row">P主 · 与 KAITO 合作 ${count} 首</span>
      <span class="hero-tip-row">高分代表：${samples}</span>`;
  }

  return `
    <strong>${escapeHtml(entry.label)}</strong>
    <span class="hero-tip-row">${escapeHtml(entry.meta || "")}</span>`;
}

function onHeroHover(event) {
  const item = heroItemAtEvent(event);
  const tooltip = HERO_TYPO.tooltip;
  const wrap = HERO_TYPO.canvas?.closest(".hero-typo-wrap");
  HERO_TYPO.hoverIndex = item ? item.index : -1;

  if (!tooltip || !wrap) return;

  if (!item) {
    tooltip.classList.remove("visible");
    return;
  }

  tooltip.innerHTML = formatHeroTooltip(item.entry);
  tooltip.classList.add("visible");

  const rect = wrap.getBoundingClientRect();
  tooltip.style.left = `${event.clientX - rect.left + 14}px`;
  tooltip.style.top = `${event.clientY - rect.top + 14}px`;
}

function onHeroLeave() {
  HERO_TYPO.hoverIndex = -1;
  HERO_TYPO.tooltip?.classList.remove("visible");
}

function onHeroClick(event) {
  const item = heroItemAtEvent(event);
  if (item?.entry?.url) window.open(item.entry.url, "_blank", "noopener");
}

function renderHeroTypography(songs) {
  const { mask } = HERO_TYPO;
  if (!mask) return;

  HERO_TYPO.assignments = buildHeroAssignments(mask, buildHeroEntries(songs));
  startHeroLoop();
}

function bindHeroParallax() {
  window.addEventListener(
    "mousemove",
    (e) => {
      HERO_TYPO.parallax.targetX = (e.clientX / window.innerWidth - 0.5) * 12;
      HERO_TYPO.parallax.targetY = (e.clientY / window.innerHeight - 0.5) * 8;
    },
    { passive: true }
  );
}

async function initHeroTypography(songs) {
  const canvas = document.getElementById("hero-typo-canvas");
  const tooltip = document.getElementById("hero-typo-tooltip");
  if (!canvas) return;

  HERO_TYPO.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  HERO_TYPO.canvas = canvas;
  HERO_TYPO.ctx = canvas.getContext("2d", { alpha: true });
  HERO_TYPO.tooltip = tooltip;
  HERO_TYPO.songs = songs;

  HERO_TYPO.baseCanvas = document.createElement("canvas");
  HERO_TYPO.baseCtx = HERO_TYPO.baseCanvas.getContext("2d");

  try {
    HERO_TYPO.mask = await loadKaitoMask(HERO_IMAGE, HERO_CANVAS_WIDTH, HERO_CELL_SIZE, true);

    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.floor(HERO_TYPO.mask.width * dpr);
    canvas.height = Math.floor(HERO_TYPO.mask.height * dpr);
    canvas.style.width = `${HERO_TYPO.mask.width}px`;
    canvas.style.height = `${HERO_TYPO.mask.height}px`;
    HERO_TYPO.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    syncHeroTypoBackdrop();

    HERO_TYPO.baseCanvas.width = HERO_TYPO.mask.width;
    HERO_TYPO.baseCanvas.height = HERO_TYPO.mask.height;
  } catch (err) {
    console.warn("Hero 文字构成 mask 加载失败:", err);
    return;
  }

  canvas.addEventListener("mousemove", onHeroHover, { passive: true });
  canvas.addEventListener("mouseleave", onHeroLeave);
  canvas.addEventListener("click", onHeroClick);

  bindHeroParallax();
  renderHeroTypography(songs);
}

function resizeHeroTypography() {
  syncHeroTypoBackdrop();
  if (HERO_TYPO.songs.length) renderHeroTypography(HERO_TYPO.songs);
}
