/**
 * 里程碑高级可视化：KAITO 构成剪影、Sunburst、Treemap、共演关系图、Theme River
 */

const MILESTONE_VIZ = {
  charts: [],
  sunburstCompareMode: false,
  lastVizContext: null,
  mosaic: {
    canvas: null,
    tooltip: null,
    ctx: null,
    mask: null,
    characterId: "kaito",
    assignments: [],
    progress: 1,
    hoverIndex: -1,
    lastSongs: [],
    lastFilter: null,
    loading: false,
    playingSongTitle: null,
    pulseRaf: 0,
  },
};

const MOSAIC_BOX_WIDTH = 260;
const MOSAIC_BOX_HEIGHT = 360;
const MOSAIC_CELL_SIZE = 4;

function mosaicEscapeHtml(text) {
  if (typeof escapeHtml === "function") return escapeHtml(text);
  const div = document.createElement("div");
  div.textContent = text ?? "";
  return div.innerHTML;
}

function disposeMilestoneVizCharts() {
  MILESTONE_VIZ.charts.forEach((c) => c.dispose());
  MILESTONE_VIZ.charts = [];
}

function pushMilestoneChart(chart) {
  if (chart) MILESTONE_VIZ.charts.push(chart);
}

function resizeMilestoneViz() {
  const sunburstDom = document.getElementById("wiki-chart-sunburst");
  if (sunburstDom) syncSunburstChartSize(sunburstDom);
  MILESTONE_VIZ.charts.forEach((c) => c.resize());
  drawMosaicFrame(MILESTONE_VIZ.mosaic.progress);
  const avatar = document.querySelector(".wiki-sunburst-avatar");
  if (sunburstDom && avatar) positionSunburstAvatar(sunburstDom, avatar);
}

function songCellColor(song) {
  const vocalists = song.vocalists || [];
  if (song.involves_kaito && vocalists.length <= 1) return { colors: ["#0044ff"], kaito: true };
  if (vocalists.length === 0) return { colors: ["#3a4a5c"], kaito: false };
  if (vocalists.length === 1) return { colors: [vocalists[0].color], kaito: song.involves_kaito };
  return { colors: vocalists.map((v) => v.color), kaito: song.involves_kaito };
}

function fillMosaicCell(ctx, cell, colors, cellSize, alpha) {
  const pad = 0.5;
  const w = cellSize - pad;
  const h = cellSize - pad;
  ctx.globalAlpha = alpha;
  if (colors.length === 1) {
    ctx.fillStyle = colors[0];
    ctx.fillRect(cell.x, cell.y, w, h);
    return;
  }
  const grad = ctx.createLinearGradient(cell.x, cell.y, cell.x + w, cell.y);
  colors.forEach((c, i) => {
    const start = i / colors.length;
    const end = (i + 1) / colors.length;
    grad.addColorStop(start, c);
    grad.addColorStop(end, c);
  });
  ctx.fillStyle = grad;
  ctx.fillRect(cell.x, cell.y, w, h);
}

function cellMatchesFilter(song, filterState) {
  if (filterState.filter === "kaito" && !song.involves_kaito) return false;
  if (filterState.vocalists.size) {
    return [...filterState.vocalists].every((name) =>
      (song.vocalists || []).some((v) => v.name === name)
    );
  }
  return true;
}

function cellMatchesFocus(song, focusVocalist) {
  if (!song) return false;
  const focus = focusVocalist || "KAITO";
  return (song.vocalists || []).some((v) => v.name === focus);
}

function rebuildMosaicHitMap() {
  const map = new Map();
  for (const cell of MILESTONE_VIZ.mosaic.assignments) {
    if (cell.song) map.set(`${cell.x},${cell.y}`, cell);
  }
  MILESTONE_VIZ.mosaic.hitMap = map;
}

function mountMosaicTooltip(tooltipId) {
  let tip = document.getElementById(tooltipId);
  if (!tip) {
    tip = document.createElement("div");
    tip.id = tooltipId;
    tip.className = "wiki-mosaic-tooltip";
  }
  if (tip.parentElement !== document.body) {
    document.body.appendChild(tip);
  }
  return tip;
}

async function initKaitoMosaic(canvasId, tooltipId) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const state = MILESTONE_VIZ.mosaic;
  state.canvas = canvas;
  state.tooltip = mountMosaicTooltip(tooltipId);
  state.ctx = canvas.getContext("2d");
  state.hitMap = new Map();

  canvas.addEventListener("pointermove", onMosaicHover);
  canvas.addEventListener("pointerleave", hideMosaicTooltip);
  canvas.addEventListener("click", onMosaicClick);
  canvas.addEventListener("dblclick", onMosaicPlay);

  await setMosaicForFocusVocalist("KAITO", false);
}

async function setMosaicCharacter(profileOrId, rerender = true) {
  const state = MILESTONE_VIZ.mosaic;
  const profile =
    typeof profileOrId === "object" && profileOrId?.image
      ? profileOrId
      : resolveMosaicProfile(typeof profileOrId === "string" ? profileOrId : "KAITO");

  state.characterId = profile.id;
  state.loading = true;

  try {
    if (typeof loadKaitoMaskInBox !== "function") {
      throw new Error("loadKaitoMaskInBox missing");
    }
    state.mask = await loadKaitoMaskInBox(
      profile.image,
      MOSAIC_BOX_WIDTH,
      MOSAIC_BOX_HEIGHT,
      MOSAIC_CELL_SIZE
    );
    if (!state.mask?.maskCells?.length) {
      console.warn("剪影 mask 为空:", profile.image);
    }
    if (state.canvas) {
      state.canvas.width = state.mask.width;
      state.canvas.height = state.mask.height;
      state.canvas.style.width = `${MOSAIC_BOX_WIDTH}px`;
      state.canvas.style.height = `${MOSAIC_BOX_HEIGHT}px`;
    }
  } catch (err) {
    console.warn("角色剪影加载失败:", profile.id, profile.image, err);
    state.loading = false;
    drawMosaicPlaceholder(profile.name);
    return;
  }

  state.loading = false;
  updateMosaicPanelTitle(profile);

  if (rerender && state.lastSongs.length) {
    renderCharacterMosaic(state.lastSongs, state.lastFilter, state.focusVocalist);
  }
}

function drawMosaicPlaceholder(label) {
  const state = MILESTONE_VIZ.mosaic;
  if (!state.ctx || !state.canvas) return;
  const w = MOSAIC_BOX_WIDTH;
  const h = MOSAIC_BOX_HEIGHT;
  state.canvas.width = w;
  state.canvas.height = h;
  state.ctx.fillStyle = "rgba(4, 10, 20, 0.95)";
  state.ctx.fillRect(0, 0, w, h);
  state.ctx.strokeStyle = "rgba(72, 202, 228, 0.35)";
  state.ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
  state.ctx.fillStyle = "#8ba3b8";
  state.ctx.font = "12px sans-serif";
  state.ctx.textAlign = "center";
  state.ctx.fillText(`${label || "角色"} 立绘加载失败`, w / 2, h / 2);
}

function updateMosaicPanelTitle(profile) {
  const title = document.getElementById("wiki-mosaic-title");
  const sub = document.getElementById("wiki-mosaic-sub");
  const name = profile.name || profile.vocalistTag || "KAITO";
  if (title) title.textContent = `${name} 构成概念`;
  if (sub) {
    sub.textContent = `亮色 = ${name} 的里程碑曲 · 暗色 = 合唱生态 · 悬停 / 点击色块联动`;
  }
}

function buildMosaicAssignments(songs) {
  const mask = MILESTONE_VIZ.mosaic.mask;
  if (!mask?.maskCells?.length) return [];

  const sorted = [...songs].sort((a, b) => (a.name || "").localeCompare(b.name || "", "zh-CN"));
  return mask.maskCells.map((cell, i) => ({
    ...cell,
    song: sorted.length ? sorted[i % sorted.length] : null,
    index: i,
  }));
}

function drawMosaicFrame(progress) {
  const state = MILESTONE_VIZ.mosaic;
  if (!state.ctx || !state.mask) return;

  const { ctx, assignments, hoverIndex, focusVocalist } = state;
  const focus = focusVocalist || "KAITO";
  const { width, height, cellSize } = state.mask;

  ctx.clearRect(0, 0, width, height);

  const bg = ctx.createRadialGradient(width / 2, height * 0.42, 0, width / 2, height * 0.42, width * 0.72);
  bg.addColorStop(0, "rgba(0, 50, 120, 0.22)");
  bg.addColorStop(1, "rgba(4, 10, 20, 0.96)");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  const visible = Math.floor(assignments.length * easeOutCubic(Math.min(progress, 1)));

  for (let i = 0; i < visible; i++) {
    const cell = assignments[i];
    if (!cell.song) continue;

    const match = cellMatchesFocus(cell.song, focus);
    const style = songCellColor(cell.song);
    const isHover = i === hoverIndex;
    const isNear = hoverIndex >= 0 && Math.abs(i - hoverIndex) < 6;

    let alpha = match ? 0.93 : 0.09;
    if (isHover) alpha = 1;
    else if (isNear && match) alpha = 0.98;

    if (isHover) {
      ctx.save();
      ctx.translate(cell.cx, cell.cy);
      ctx.scale(1.42, 1.42);
      ctx.translate(-cell.cx, -cell.cy);
    }

    fillMosaicCell(ctx, cell, style.colors, cellSize, alpha);

    if (isHover) {
      ctx.restore();
      ctx.globalAlpha = 0.9;
      ctx.strokeStyle = match ? "#66ccff" : "#8899aa";
      ctx.lineWidth = 2;
      ctx.strokeRect(cell.x - 0.5, cell.y - 0.5, cellSize + 1, cellSize + 1);
    } else if (isNear && match) {
      ctx.globalAlpha = 0.45;
      ctx.strokeStyle = "rgba(102, 204, 255, 0.55)";
      ctx.lineWidth = 1;
      ctx.strokeRect(cell.x + 0.5, cell.y + 0.5, cellSize - 1, cellSize - 1);
    }

    const playingTitle = state.playingSongTitle;
    if (
      playingTitle &&
      cell.song?.name &&
      cell.song.name.trim().toLowerCase() === playingTitle.trim().toLowerCase()
    ) {
      const pulse = 0.55 + Math.sin(performance.now() * 0.007) * 0.45;
      ctx.save();
      ctx.globalAlpha = pulse * 0.92;
      ctx.strokeStyle = "#a8e8ff";
      ctx.lineWidth = 1.5 + pulse * 2.5;
      ctx.shadowColor = "#48cae4";
      ctx.shadowBlur = 6 + pulse * 16;
      ctx.strokeRect(cell.x - 1.5, cell.y - 1.5, cellSize + 3, cellSize + 3);
      ctx.restore();
    }

    ctx.globalAlpha = 1;
  }

  ctx.strokeStyle = "rgba(72, 202, 228, 0.32)";
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, width - 1, height - 1);
}

function animateMosaicIn() {
  const state = MILESTONE_VIZ.mosaic;
  if (state._animFrame) cancelAnimationFrame(state._animFrame);
  state.progress = 0;
  const start = performance.now();
  const duration = 750;

  function frame(now) {
    state.progress = Math.min(1, (now - start) / duration);
    drawMosaicFrame(state.progress);
    if (state.progress < 1) {
      state._animFrame = requestAnimationFrame(frame);
    } else {
      state._animFrame = null;
    }
  }
  state._animFrame = requestAnimationFrame(frame);
}

function setMosaicPlayingSong(title) {
  const state = MILESTONE_VIZ.mosaic;
  state.playingSongTitle = title || null;
  const wrap = document.getElementById("wiki-silhouette-wrap");
  wrap?.classList.toggle("wiki-mosaic-playing", !!title);

  if (state.pulseRaf) {
    cancelAnimationFrame(state.pulseRaf);
    state.pulseRaf = 0;
  }

  if (!title) {
    drawMosaicFrame(Math.max(state.progress, 1));
    return;
  }

  function pulseTick() {
    if (!state.playingSongTitle) {
      state.pulseRaf = 0;
      return;
    }
    drawMosaicFrame(Math.max(state.progress, 1));
    state.pulseRaf = requestAnimationFrame(pulseTick);
  }
  state.pulseRaf = requestAnimationFrame(pulseTick);
}

function initMilestonePlaySync() {
  if (initMilestonePlaySync.bound) return;
  initMilestonePlaySync.bound = true;

  window.addEventListener("verse-track-focus", (e) => {
    setMosaicPlayingSong(e.detail?.title || null);
  });
  window.addEventListener("milestone-song-play", (e) => {
    setMosaicPlayingSong(e.detail?.name || null);
  });
  window.addEventListener("verse-player-closed", () => setMosaicPlayingSong(null));
}

function renderCharacterMosaic(songs, filterState, focusVocalist) {
  const state = MILESTONE_VIZ.mosaic;
  if (!state.ctx) return;
  if (state.loading) {
    state._mosaicRetry = (state._mosaicRetry || 0) + 1;
    if (state._mosaicRetry < 40) {
      requestAnimationFrame(() => renderCharacterMosaic(songs, filterState, focusVocalist));
    }
    return;
  }
  state._mosaicRetry = 0;
  if (!state.mask?.maskCells?.length) return;

  const focus = focusVocalist || "KAITO";
  const focusSongs =
    typeof songsForFocusVocalist === "function"
      ? songsForFocusVocalist(songs, focus)
      : songs.filter((s) => (s.vocalists || []).some((v) => v.name === focus));

  state.lastSongs = songs;
  state.lastFilter = filterState;
  state.focusVocalist = focus;
  state.assignments = buildMosaicAssignments(songs);
  rebuildMosaicHitMap();

  const animKey = `${focus}|${songs.length}|${filterState?.tierId || ""}|${filterState?.keyword || ""}`;
  if (state._animKey !== animKey) {
    state._animKey = animKey;
    animateMosaicIn();
  } else {
    state.progress = 1;
    drawMosaicFrame(1);
  }

  updateMosaicStats(focusSongs, state.mask.maskCells.length, focus);
}

function renderKaitoMosaic(songs, filterState, focusVocalist) {
  renderCharacterMosaic(songs, filterState, focusVocalist);
}

function updateMosaicStats(songs, cellCount, focusVocalist) {
  const box = document.getElementById("wiki-mosaic-stats");
  if (!box) return;
  const focus = focusVocalist || "KAITO";
  box.innerHTML = `
    <span>焦点 <strong>${mosaicEscapeHtml(focus)}</strong></span>
    <span>色块 <strong>${cellCount.toLocaleString("zh-CN")}</strong></span>
    <span>曲目 <strong>${songs.length.toLocaleString("zh-CN")}</strong></span>
    <span class="wiki-mosaic-hint">悬停色块查看曲名 · 点击跳转</span>`;
}

function mosaicCellAtEvent(event) {
  const canvas = MILESTONE_VIZ.mosaic.canvas;
  if (!canvas) return null;
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;

  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const px = (event.clientX - rect.left) * scaleX;
  const py = (event.clientY - rect.top) * scaleY;
  const { cellSize, assignments, progress, hitMap } = MILESTONE_VIZ.mosaic;
  const map = hitMap || new Map();
  const cs = cellSize || MOSAIC_CELL_SIZE;
  const gx = Math.floor(px / cs) * cs;
  const gy = Math.floor(py / cs) * cs;

  for (let dy = -cs; dy <= cs; dy += cs) {
    for (let dx = -cs; dx <= cs; dx += cs) {
      const cell = map.get(`${gx + dx},${gy + dy}`);
      if (cell?.song) return cell;
    }
  }

  const visible = Math.floor(assignments.length * Math.min(Math.max(progress, 0), 1));
  for (let i = 0; i < visible; i++) {
    const c = assignments[i];
    if (!c.song) continue;
    if (px >= c.x && px < c.x + cs && py >= c.y && py < c.y + cs) return c;
  }
  return null;
}

function onMosaicHover(event) {
  const cell = mosaicCellAtEvent(event);
  const state = MILESTONE_VIZ.mosaic;
  const newIndex = cell ? cell.index : -1;
  if (newIndex !== state.hoverIndex) {
    state.hoverIndex = newIndex;
    drawMosaicFrame(Math.max(state.progress, 1));
  }

  const tooltip = state.tooltip;
  if (!tooltip) return;
  if (!cell?.song) {
    tooltip.classList.remove("visible");
    return;
  }

  const song = cell.song;
  const focus = state.focusVocalist || "KAITO";
  const isFocus = cellMatchesFocus(song, focus);
  const tierLabel = { hall: "殿堂", legend: "传说", myth: "神话" }[song.tier] || "";
  const vocalists = (song.vocalists || []).map((v) => v.name).join("、") || "—";
  tooltip.innerHTML = `
    <strong>${mosaicEscapeHtml(song.name)}</strong>
    <span>${tierLabel ? `${tierLabel} · ` : ""}${isFocus ? `焦点 ${focus}` : "合唱生态"}</span>
    <span>P主：${mosaicEscapeHtml(song.producer || "—")}</span>
    <span>演唱：${mosaicEscapeHtml(vocalists)}</span>${song.url ? `<span class="wiki-mosaic-play-hint">双击色块页内试听</span>` : ""}`;
  tooltip.classList.add("visible");
  tooltip.style.left = `${Math.min(event.clientX + 16, window.innerWidth - 250)}px`;
  tooltip.style.top = `${Math.min(event.clientY + 16, window.innerHeight - 130)}px`;
}

function hideMosaicTooltip() {
  MILESTONE_VIZ.mosaic.hoverIndex = -1;
  MILESTONE_VIZ.mosaic.tooltip?.classList.remove("visible");
  drawMosaicFrame(Math.max(MILESTONE_VIZ.mosaic.progress, 1));
}

function onMosaicPlay(event) {
  const cell = mosaicCellAtEvent(event);
  if (!cell?.song?.url || typeof openVersePlayer !== "function") return;
  openVersePlayer({
    name: cell.song.name,
    url: cell.song.url,
    platform: cell.song.platform,
  });
}

function onMosaicClick(event) {
  const cell = mosaicCellAtEvent(event);
  if (!cell?.song) return;
  if (typeof onMosaicSongSelect === "function") onMosaicSongSelect(cell.song);
  if (typeof setVerseFilter === "function") {
    setVerseFilter(
      { songKeyword: cell.song.name, producer: null, vocalist: null },
      "mosaic"
    );
  }
}

function buildSunburstCompareData(allTiers, activeVocalist) {
  const vocalistMap = new Map();

  for (const tier of allTiers) {
    for (const v of tier.vocalist_stats || []) {
      if (!vocalistMap.has(v.name)) {
        vocalistMap.set(v.name, { name: v.name, color: v.color, tiers: {} });
      }
      vocalistMap.get(v.name).tiers[tier.id] = (vocalistMap.get(v.name).tiers[tier.id] || 0) + (v.count || 0);
    }
  }

  const ranked = [...vocalistMap.values()]
    .map((v) => ({
      ...v,
      total: Object.values(v.tiers).reduce((s, c) => s + c, 0),
    }))
    .filter((v) => v.total > 0)
    .sort((a, b) => {
      if (a.name === activeVocalist) return -1;
      if (b.name === activeVocalist) return 1;
      return b.total - a.total;
    })
    .slice(0, 14);

  return {
    name: "角色",
    children: ranked.map((v) => ({
      name: v.name,
      vocalist: v.name,
      compareTotal: v.total,
      value: v.total,
      itemStyle: {
        color: v.color,
        opacity: activeVocalist && activeVocalist !== v.name ? 0.38 : 1,
        shadowBlur: activeVocalist === v.name ? 14 : 0,
        shadowColor: activeVocalist === v.name ? v.color : "transparent",
      },
      children: allTiers
        .map((tier) => {
          const count = v.tiers[tier.id] || 0;
          return {
            name: tier.label,
            tierId: tier.id,
            tierLabel: tier.label,
            value: count,
            share: v.total ? ((count / v.total) * 100).toFixed(1) : "0",
            itemStyle: { color: tierColor(tier.id) },
          };
        })
        .filter((c) => c.value > 0),
    })),
  };
}

function renderSunburstCompareStats(allTiers, focusVocalist) {
  const box = document.getElementById("wiki-sunburst-compare-stats");
  if (!box) return;

  if (!MILESTONE_VIZ.sunburstCompareMode) {
    box.hidden = true;
    box.innerHTML = "";
    return;
  }

  const focus = focusVocalist || "KAITO";
  const totals = new Map();
  let sum = 0;

  for (const tier of allTiers || []) {
    const stat = (tier.vocalist_stats || []).find((v) => v.name === focus);
    const count = stat?.count || 0;
    totals.set(tier.id, { label: tier.label, count });
    sum += count;
  }

  if (!sum) {
    box.hidden = true;
    return;
  }

  box.hidden = false;
  const chips = [...totals.entries()]
    .map(
      ([id, { label, count }]) =>
        `<span class="wiki-compare-chip wiki-compare-${id}">${mosaicEscapeHtml(label)} <strong>${count.toLocaleString("zh-CN")}</strong><em>${((count / sum) * 100).toFixed(1)}%</em></span>`
    )
    .join("");

  box.innerHTML = `
    <span class="wiki-compare-label">${mosaicEscapeHtml(focus)} 跨等级</span>
    ${chips}
    <span class="wiki-compare-total">合计 ${sum.toLocaleString("zh-CN")} 首</span>`;
}

function buildSunburstData(allTiers, activeVocalist) {
  return {
    name: "里程碑",
    children: allTiers.map((tier) => ({
      name: tier.label,
      tierId: tier.id,
      value: tier.count || (tier.vocalist_stats || []).reduce((s, v) => s + (v.count || 0), 0),
      itemStyle: { color: tierColor(tier.id) },
      children: (tier.vocalist_stats || []).slice(0, 14).map((v) => ({
        name: v.name,
        value: Math.max(v.count, 1),
        itemStyle: {
          color: v.color,
          opacity: activeVocalist && activeVocalist !== v.name ? 0.35 : 1,
          shadowBlur: activeVocalist === v.name ? 12 : 0,
          shadowColor: activeVocalist === v.name ? v.color : "transparent",
        },
        vocalist: v.name,
        tierId: tier.id,
      })),
    })),
  };
}

function chartBaseAnimation() {
  return { animationDuration: 700, animationDurationUpdate: 550, animationEasing: "cubicOut" };
}

function positionSunburstAvatar(dom, avatar) {
  if (!dom || !avatar) return;
  const panel = dom.closest(".wiki-sunburst-panel") || dom.parentElement;
  if (!panel) return;
  const panelRect = panel.getBoundingClientRect();
  const chartRect = dom.getBoundingClientRect();
  const cx = chartRect.left - panelRect.left + chartRect.width / 2;
  const cy = chartRect.top - panelRect.top + chartRect.height / 2;
  avatar.style.left = `${cx}px`;
  avatar.style.top = `${cy}px`;
}

function upsertSunburstAvatar(dom, focusVocalist) {
  const panel = dom.closest(".wiki-sunburst-panel") || dom.parentElement;
  if (!panel) return;

  panel.classList.add("wiki-sunburst-panel--avatar");
  let avatar = panel.querySelector(".wiki-sunburst-avatar");
  if (!avatar) {
    avatar = document.createElement("div");
    avatar.className = "wiki-sunburst-avatar";
    avatar.innerHTML = '<img alt="" loading="lazy" />';
    panel.appendChild(avatar);
  }

  const profile =
    typeof resolveMosaicProfile === "function" ? resolveMosaicProfile(focusVocalist) : null;
  const img = avatar.querySelector("img");
  if (img) {
    img.src = profile?.image || "assets/characters/kaito-v3.png";
    img.alt = profile?.name || focusVocalist || "KAITO";
  }

  if (!avatar.dataset.bound) {
    avatar.dataset.bound = "1";
    avatar.title = "点击重置焦点为 KAITO";
    avatar.addEventListener("click", () => {
      if (typeof selectMilestoneFocusVocalist === "function") {
        selectMilestoneFocusVocalist("KAITO");
      }
    });
  }

  requestAnimationFrame(() => positionSunburstAvatar(dom, avatar));
}

function syncSunburstChartSize(dom) {
  if (!dom) return;
  const wrap = dom.closest(".wiki-sunburst-chart-wrap");
  if (!wrap) return;
  const size = Math.floor(Math.min(wrap.clientWidth - 4, wrap.clientHeight - 4));
  if (size < 200) return;
  dom.style.width = `${size}px`;
  dom.style.height = `${size}px`;
}

function renderSunburstChart(dom, allTiers, onVocalistClick, focusVocalist) {
  if (!dom || typeof echarts === "undefined") return;
  syncSunburstChartSize(dom);
  const chart = echarts.init(dom);
  const activeVocalist = focusVocalist || "KAITO";
  const compareMode = MILESTONE_VIZ.sunburstCompareMode;
  const sunburstData = compareMode
    ? buildSunburstCompareData(allTiers, activeVocalist)
    : buildSunburstData(allTiers, activeVocalist);

  const sub = dom.closest(".wiki-sunburst-panel")?.querySelector(".wiki-viz-sub");
  if (sub) {
    sub.textContent = compareMode
      ? "内圈：角色 · 外圈：殿堂/传说/神话占比 · 点击外圈跳转对应等级"
      : "内圈：点击切换殿堂/传说/神话 · 外圈：选择角色 · 中心头像：重置为 KAITO";
  }

  renderSunburstCompareStats(allTiers, activeVocalist);

  chart.setOption({
    ...chartBaseAnimation(),
    backgroundColor: "transparent",
    tooltip: {
      trigger: "item",
      backgroundColor: "rgba(6,14,28,0.94)",
      borderColor: "rgba(72,202,228,0.45)",
      formatter: (p) => {
        if (MILESTONE_VIZ.sunburstCompareMode && p.data?.tierId && p.data?.share != null) {
          const parent = p.treePathInfo?.[p.treePathInfo.length - 2]?.name || "";
          return `<strong>${parent} · ${p.name}</strong><br/>${p.data.value || 0} 首 · 占该角色 ${p.data.share}%<br/><span style="opacity:0.75">点击跳转 ${p.name} tab</span>`;
        }
        if (p.data?.vocalist && MILESTONE_VIZ.sunburstCompareMode) {
          return `<strong>${p.name}</strong><br/>跨等级合计 ${p.data.compareTotal || p.value || 0} 首<br/><span style="opacity:0.75">点击设为焦点角色</span>`;
        }
        if (p.data?.vocalist) {
          return `<strong>${p.name}</strong><br/>${p.value || 0} 首 · ${p.percent || 0}%<br/><span style="opacity:0.75">点击切换焦点</span>`;
        }
        if (p.data?.tierId) {
          return `<strong>${p.name}</strong><br/>${p.value || 0} 首<br/><span style="opacity:0.75">点击切换等级 tab</span>`;
        }
        return `<strong>${p.name}</strong><br/>合计 ${p.value || 0} 首`;
      },
    },
    series: [
      {
        type: "sunburst",
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        radius: ["16%", "92%"],
        center: ["50%", "50%"],
        sort: "desc",
        nodeClick: "rootToNode",
        emphasis: { focus: "ancestor", scale: true, scaleSize: 6 },
        data: [sunburstData],
        label: {
          color: "#d8ecf8",
          fontSize: 10,
          minAngle: 5,
          rotate: "radial",
          overflow: "truncate",
          width: 56,
          distance: 1,
        },
        levels: [
          {},
          {
            r0: "16%",
            r: "44%",
            label: { fontSize: 12, fontWeight: 700, color: "#fff", minAngle: 4 },
            itemStyle: { borderWidth: 2, borderColor: "rgba(4,10,22,0.85)" },
          },
          {
            r0: "44%",
            r: "92%",
            label: { fontSize: 9, minAngle: 4, width: 52 },
            itemStyle: { borderWidth: 1, borderColor: "rgba(4,10,22,0.6)" },
          },
        ],
      },
    ],
  });
  chart.on("click", (params) => {
    if (params.data?.vocalist) {
      onVocalistClick(params.data.vocalist);
      if (MILESTONE_VIZ.sunburstCompareMode) {
        renderSunburstCompareStats(allTiers, params.data.vocalist);
      }
      return;
    }
    if (params.data?.tierId && typeof selectMilestoneTier === "function") {
      selectMilestoneTier(params.data.tierId);
    }
  });
  upsertSunburstAvatar(dom, activeVocalist);
  chart.off("finished");
  chart.on("finished", () => {
    syncSunburstChartSize(dom);
    chart.resize();
    const avatar = dom.closest(".wiki-sunburst-panel")?.querySelector(".wiki-sunburst-avatar");
    if (avatar) positionSunburstAvatar(dom, avatar);
  });
  pushMilestoneChart(chart);
}

function renderTreemapChart(dom, stats, onVocalistClick, focusVocalist) {
  if (!dom || typeof echarts === "undefined") return;
  const chart = echarts.init(dom);
  const activeVocalist = focusVocalist || "KAITO";
  chart.setOption({
    ...chartBaseAnimation(),
    backgroundColor: "transparent",
    tooltip: { trigger: "item", formatter: "{b}: {c} 首" },
    series: [
      {
        type: "treemap",
        top: 4,
        left: 4,
        right: 4,
        bottom: 4,
        roam: false,
        nodeClick: false,
        breadcrumb: { show: false },
        label: { show: true, formatter: "{b}\n{c}", color: "#fff", fontSize: 11 },
        itemStyle: { borderColor: "#0f2137", borderWidth: 2, gapWidth: 2 },
        emphasis: {
          itemStyle: {
            shadowBlur: 16,
            shadowColor: "rgba(72,202,228,0.55)",
            borderColor: "#66ccff",
            borderWidth: 3,
          },
        },
        data: stats.map((s) => ({
          name: s.name,
          value: s.count,
          itemStyle: {
            color: s.color,
            opacity: activeVocalist && activeVocalist !== s.name ? 0.32 : 1,
            borderColor: activeVocalist === s.name ? "#e8f4f8" : "#0f2137",
            borderWidth: activeVocalist === s.name ? 3 : 2,
          },
        })),
      },
    ],
  });
  chart.on("click", (params) => {
    if (params.name) onVocalistClick(params.name);
  });
  pushMilestoneChart(chart);
}

function buildCollabGraph(songs, limit = 10) {
  const stats = computeCollabStats(songs).slice(0, limit);
  const names = new Set(stats.map((s) => s.name));
  const linksMap = new Map();

  for (const song of songs) {
    const vs = (song.vocalists || []).map((v) => v.name).filter((n) => names.has(n));
    for (let i = 0; i < vs.length; i++) {
      for (let j = i + 1; j < vs.length; j++) {
        const key = [vs[i], vs[j]].sort().join("|");
        linksMap.set(key, (linksMap.get(key) || 0) + 1);
      }
    }
  }

  const nodes = stats.map((s) => ({
    id: s.name,
    name: s.name,
    symbolSize: Math.max(18, Math.min(52, 12 + s.count * 0.35)),
    itemStyle: { color: s.color, shadowBlur: 12, shadowColor: `${s.color}88` },
    label: { color: "#e8f4f8", fontSize: 10 },
  }));

  const links = [...linksMap.entries()].map(([key, value]) => {
    const [source, target] = key.split("|");
    return {
      source,
      target,
      value,
      lineStyle: { width: Math.min(8, 1 + value * 0.5), opacity: 0.55, curveness: 0.25 },
    };
  });

  return { nodes, links };
}

function computeCollabStats(songs) {
  const map = new Map();
  for (const song of songs) {
    const seen = new Set();
    for (const v of song.vocalists || []) {
      if (!v.name || seen.has(v.name)) continue;
      seen.add(v.name);
      const cur = map.get(v.name) || { name: v.name, color: v.color, count: 0 };
      cur.count += 1;
      map.set(v.name, cur);
    }
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}

function renderCollabGraph(dom, songs, onVocalistClick, focusVocalist) {
  if (!dom || typeof echarts === "undefined") return;
  const { nodes, links } = buildCollabGraph(songs);
  const activeVocalist = focusVocalist || "KAITO";
  const chart = echarts.init(dom);
  chart.setOption({
    ...chartBaseAnimation(),
    backgroundColor: "transparent",
    tooltip: {
      trigger: "item",
      formatter: (p) =>
        p.dataType === "edge"
          ? `${p.data.source} ↔ ${p.data.target}<br/>合唱 ${p.data.value} 次`
          : `${p.name}`,
    },
    series: [
      {
        type: "graph",
        layout: "circular",
        circular: { rotateLabel: true },
        top: 8,
        left: 8,
        right: 8,
        bottom: 8,
        data: nodes.map((n) => ({
          ...n,
          itemStyle: {
            ...n.itemStyle,
            opacity: activeVocalist && activeVocalist !== n.name ? 0.28 : 1,
            borderColor: activeVocalist === n.name ? "#e8f4f8" : "transparent",
            borderWidth: activeVocalist === n.name ? 2 : 0,
          },
          symbolSize:
            activeVocalist === n.name ? Math.min(58, n.symbolSize * 1.15) : n.symbolSize,
        })),
        links,
        roam: true,
        emphasis: { focus: "adjacency", lineStyle: { width: 6 } },
        lineStyle: { color: "rgba(72,202,228,0.45)" },
        label: { show: true, position: "right", fontSize: 10, color: "#e8f4f8" },
      },
    ],
  });
  chart.on("click", (params) => {
    if (params.dataType === "node" && params.name) onVocalistClick(params.name);
  });
  pushMilestoneChart(chart);
}

function renderThemeRiver(dom, songs, stats, focusVocalist, vocalistsFilter) {
  if (!dom || typeof echarts === "undefined") return;
  let top = stats.slice(0, 6);
  const focus = focusVocalist || "KAITO";
  if (vocalistsFilter?.size === 1) {
    const match = stats.find((s) => s.name === focus);
    if (match) top = [match];
  }
  const names = top.map((s) => s.name);
  const yearSet = new Set();
  const yearVocal = new Map();

  for (const song of songs) {
    const year = parseMilestoneYear(song.achieve_date) || parseMilestoneYear(song.publish_date);
    if (!year) continue;
    yearSet.add(year);
    if (!yearVocal.has(year)) yearVocal.set(year, {});
    const bucket = yearVocal.get(year);
    for (const v of song.vocalists || []) {
      if (!names.includes(v.name)) continue;
      bucket[v.name] = (bucket[v.name] || 0) + 1;
    }
  }

  const years = [...yearSet].sort();
  const series = names.map((name) => ({
    name,
    type: "line",
    stack: "river",
    areaStyle: { opacity: 0.78 },
    emphasis: { focus: "series" },
    smooth: true,
    symbol: "none",
    lineStyle: { width: 0 },
    itemStyle: { color: top.find((t) => t.name === name)?.color },
    data: years.map((y) => yearVocal.get(y)?.[name] || 0),
  }));

  const chart = echarts.init(dom);
  chart.setOption({
    ...chartBaseAnimation(),
    backgroundColor: "transparent",
    title: {
      text: "角色时间河流图",
      subtext: vocalistsFilter?.size === 1
        ? `点击 Treemap 角色 · 当前仅显示 ${focus}`
        : "点击 Treemap 角色 · 联动显示该角色年份带",
      left: 8,
      textStyle: { color: "#e8f4f8", fontSize: 14 },
      subtextStyle: { color: "#8ba3b8", fontSize: 11 },
    },
    tooltip: { trigger: "axis", axisPointer: { type: "cross" } },
    legend: { data: names, bottom: 0, textStyle: { color: "#8ba3b8", fontSize: 10 } },
    grid: { left: 48, right: 24, top: 52, bottom: 48 },
    xAxis: {
      type: "category",
      boundaryGap: false,
      data: years,
      axisLabel: { color: "#8ba3b8" },
      axisLine: { lineStyle: { color: "#2a4a62" } },
    },
    yAxis: {
      type: "value",
      axisLabel: { color: "#8ba3b8" },
      splitLine: { lineStyle: { color: "rgba(72,202,228,0.08)" } },
    },
    series,
  });
  pushMilestoneChart(chart);
}

function parseMilestoneYear(dateStr) {
  const m = String(dateStr || "").match(/(20\d{2})/);
  return m ? m[1] : "";
}

function toggleSunburstCompareMode() {
  MILESTONE_VIZ.sunburstCompareMode = !MILESTONE_VIZ.sunburstCompareMode;
  syncSunburstCompareButton();

  const ctx = MILESTONE_VIZ.lastVizContext;
  if (!ctx) return;

  const dom = document.getElementById("wiki-chart-sunburst");
  if (!dom) return;
  const idx = MILESTONE_VIZ.charts.findIndex((c) => c.getDom?.() === dom);
  if (idx >= 0) {
    MILESTONE_VIZ.charts[idx].dispose();
    MILESTONE_VIZ.charts.splice(idx, 1);
  }
  renderSunburstChart(dom, ctx.allTiers, ctx.onVocalistClick, ctx.focusVocalist);
  renderSunburstCompareStats(ctx.allTiers, ctx.focusVocalist);
}

function bindSunburstToolbar() {
  const btn = document.getElementById("wiki-sunburst-compare");
  if (!btn || btn.dataset.bound) return;
  btn.dataset.bound = "1";
  syncSunburstCompareButton(btn);
  btn.addEventListener("click", toggleSunburstCompareMode);
}

function syncSunburstCompareButton(btn = document.getElementById("wiki-sunburst-compare")) {
  if (!btn) return;
  btn.classList.toggle("active", MILESTONE_VIZ.sunburstCompareMode);
  btn.textContent = MILESTONE_VIZ.sunburstCompareMode ? "等级对比 ✓" : "等级对比";
}

function renderAllMilestoneViz({ songs, stats, allTiers, filterState, focusVocalist, onVocalistClick }) {
  disposeMilestoneVizCharts();
  const focus = focusVocalist || "KAITO";

  MILESTONE_VIZ.lastVizContext = { songs, stats, allTiers, filterState, focusVocalist: focus, onVocalistClick };

  renderKaitoMosaic(songs, filterState, focus);

  const wrap = document.querySelector(".wiki-silhouette-wrap");
  wrap?.classList.toggle("wiki-kaito-pulse", focus === "KAITO");

  renderSunburstChart(document.getElementById("wiki-chart-sunburst"), allTiers, onVocalistClick, focus);
  renderTreemapChart(document.getElementById("wiki-chart-treemap"), stats, onVocalistClick, focus);
  renderCollabGraph(document.getElementById("wiki-chart-collab"), songs, onVocalistClick, focus);
  renderThemeRiver(document.getElementById("wiki-chart-river"), songs, stats, focus, filterState?.vocalists);

  bindSunburstToolbar();
  initMilestonePlaySync();
}

window.toggleSunburstCompareMode = toggleSunburstCompareMode;
window.setMosaicPlayingSong = setMosaicPlayingSong;

function initMilestoneScrollReveal() {
  const section = document.getElementById("milestones");
  if (!section || !("IntersectionObserver" in window)) return;
  section.querySelectorAll(".wiki-reveal").forEach((el) => el.classList.add("wiki-reveal-pending"));
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("wiki-reveal-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
  );
  section.querySelectorAll(".wiki-reveal").forEach((el) => observer.observe(el));
}
