/**
 * 首页 KAITO 歌曲播放器 — 直线进度条 + 实时音浪
 */

const HOME_MUSIC = {
  tracks: [],
  index: 0,
  audio: null,
  meta: null,
  progress: 0,
  playing: false,
  audioCtx: null,
  analyser: null,
  sourceNode: null,
  sourceConnected: false,
  freqData: null,
  animId: 0,
};

function homeMusicResolve(path) {
  if (!path) return "";
  if (typeof resolveSitePath === "function") return resolveSitePath(path);
  const clean = String(path).replace(/^\/+/, "").replace(/^\.\//, "");
  return `./${clean.split("/").map((s) => encodeURIComponent(decodeURIComponent(s))).join("/")}`;
}

function homeMusicEscape(text) {
  if (typeof escapeHtml === "function") return escapeHtml(text);
  const d = document.createElement("div");
  d.textContent = text ?? "";
  return d.innerHTML;
}

function normalizeHomeTrack(track) {
  if (!track?.file) return null;
  const normalized = {
    ...track,
    file: homeMusicResolve(track.file),
  };
  if (track.cover) normalized.cover = homeMusicResolve(track.cover);
  else {
    const stem = track.file.replace(/^.*\//, "").replace(/\.[^.]+$/, "");
    normalized.cover = homeMusicResolve(`./music/${stem}.png`);
  }
  return normalized;
}

function formatHomeTime(sec) {
  const s = Math.max(0, Math.floor(sec || 0));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

function getHomeTrack() {
  return HOME_MUSIC.tracks[HOME_MUSIC.index] || null;
}

function initHomeAudioGraph() {
  if (HOME_MUSIC.audioCtx) return;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx || !HOME_MUSIC.audio) return;
  HOME_MUSIC.audioCtx = new Ctx();
  HOME_MUSIC.analyser = HOME_MUSIC.audioCtx.createAnalyser();
  HOME_MUSIC.analyser.fftSize = 512;
  HOME_MUSIC.analyser.smoothingTimeConstant = 0.78;
  HOME_MUSIC.freqData = new Uint8Array(HOME_MUSIC.analyser.frequencyBinCount);
}

function connectHomeAudioGraph() {
  if (HOME_MUSIC.sourceConnected || !HOME_MUSIC.audio || !HOME_MUSIC.audioCtx) return;
  try {
    HOME_MUSIC.sourceNode = HOME_MUSIC.audioCtx.createMediaElementSource(HOME_MUSIC.audio);
    HOME_MUSIC.sourceNode.connect(HOME_MUSIC.analyser);
    HOME_MUSIC.analyser.connect(HOME_MUSIC.audioCtx.destination);
    HOME_MUSIC.sourceConnected = true;
    if (typeof setAudioReactiveAnalyser === "function") {
      setAudioReactiveAnalyser(HOME_MUSIC.analyser, HOME_MUSIC.freqData);
    }
  } catch {
    HOME_MUSIC.sourceConnected = true;
  }
}

async function resumeHomeAudioCtx() {
  initHomeAudioGraph();
  connectHomeAudioGraph();
  if (HOME_MUSIC.audioCtx?.state === "suspended") {
    await HOME_MUSIC.audioCtx.resume();
  }
}

function setHomePlayIcon(playing) {
  const icon = document.querySelector(".home-music-play-icon");
  if (icon) icon.textContent = playing ? "❚❚" : "▶";
}

function drawHomeVisualizer() {
  const canvas = document.getElementById("home-music-viz");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (!w || !h) return;

  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  const cy = h * 0.52;
  const progress = Math.max(0, Math.min(1, HOME_MUSIC.progress));
  const playX = w * progress;

  let energy = 0;
  if (HOME_MUSIC.playing && HOME_MUSIC.analyser && HOME_MUSIC.freqData) {
    HOME_MUSIC.analyser.getByteFrequencyData(HOME_MUSIC.freqData);
    let sum = 0;
    for (let i = 0; i < HOME_MUSIC.freqData.length; i++) sum += HOME_MUSIC.freqData[i];
    energy = sum / HOME_MUSIC.freqData.length / 255;
  }

  const bins = HOME_MUSIC.freqData?.length || 128;
  const points = Math.min(120, Math.floor(w / 4));

  ctx.beginPath();
  for (let i = 0; i <= points; i++) {
    const x = (i / points) * w;
    const bin = Math.floor((i / points) * bins);
    const amp = HOME_MUSIC.freqData ? HOME_MUSIC.freqData[bin] / 255 : 0;
    const wave =
      HOME_MUSIC.playing && x <= playX + 2
        ? Math.sin(i * 0.38 + performance.now() * 0.006) * (3 + amp * 14 + energy * 10)
        : Math.sin(i * 0.22) * 1.2;
    const y = cy + wave;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }

  ctx.strokeStyle = "rgba(100, 130, 160, 0.35)";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, playX, h);
  ctx.clip();
  ctx.beginPath();
  for (let i = 0; i <= points; i++) {
    const x = (i / points) * w;
    const bin = Math.floor((i / points) * bins);
    const amp = HOME_MUSIC.freqData ? HOME_MUSIC.freqData[bin] / 255 : 0;
    const wave =
      HOME_MUSIC.playing
        ? Math.sin(i * 0.38 + performance.now() * 0.006) * (4 + amp * 18 + energy * 12)
        : Math.sin(i * 0.22) * 1.5;
    const y = cy + wave;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  const grad = ctx.createLinearGradient(0, 0, playX, 0);
  const accent = getHomeTrack()?.voicebankColor || "#48cae4";
  grad.addColorStop(0, accent);
  grad.addColorStop(1, "rgba(126, 196, 228, 0.75)");
  ctx.strokeStyle = grad;
  ctx.lineWidth = 2.2;
  ctx.shadowColor = accent;
  ctx.shadowBlur = HOME_MUSIC.playing ? 8 + energy * 10 : 4;
  ctx.stroke();
  ctx.restore();

  ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, cy);
  ctx.lineTo(w, cy);
  ctx.stroke();

  ctx.fillStyle = "rgba(126, 196, 228, 0.25)";
  ctx.fillRect(0, cy - 1, w, 2);
  ctx.fillStyle = "rgba(126, 196, 228, 0.55)";
  ctx.fillRect(0, cy - 1, playX, 2);

  if (progress > 0) {
    ctx.beginPath();
    ctx.arc(playX, cy, HOME_MUSIC.playing ? 5.5 + energy * 2 : 4.5, 0, Math.PI * 2);
    ctx.fillStyle = "#e8f6ff";
    ctx.fill();
    ctx.strokeStyle = "rgba(126, 196, 228, 0.9)";
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

function hexToRgba(hex, alpha) {
  const h = (hex || "#48cae4").replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

function drawHomeReactiveBg() {
  const canvas = document.getElementById("home-music-reactive");
  if (!canvas) return;
  const section = document.getElementById("home-music");
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (!w || !h) return;

  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  const metrics =
    typeof getAudioReactiveMetrics === "function" ? getAudioReactiveMetrics() : null;
  const energy = metrics?.playing ? metrics.energy : 0.04;
  const accent = getHomeTrack()?.voicebankColor || "#48cae4";

  const glow = ctx.createRadialGradient(w * 0.72, h * 0.35, 0, w * 0.72, h * 0.35, w * 0.55);
  glow.addColorStop(0, hexToRgba(accent, 0.12 + energy * 0.28));
  glow.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);

  if (metrics?.playing && metrics.freqData) {
    const bars = 36;
    const gap = w / bars;
    for (let i = 0; i < bars; i++) {
      const bin = Math.floor((i / bars) * metrics.freqData.length);
      const amp = metrics.freqData[bin] / 255;
      const barH = amp * h * 0.22 * (0.4 + energy);
      const x = i * gap;
      ctx.fillStyle = hexToRgba(accent, 0.06 + amp * 0.22);
      ctx.fillRect(x, h - barH, Math.max(2, gap * 0.7), barH);
    }
  }

  if (typeof applyAudioReactiveGlow === "function") {
    applyAudioReactiveGlow(section, metrics || { energy: 0.04 });
  }
}

function startHomeVizLoop() {
  cancelAnimationFrame(HOME_MUSIC.animId);
  const tick = () => {
    drawHomeVisualizer();
    drawHomeReactiveBg();
    HOME_MUSIC.animId = requestAnimationFrame(tick);
  };
  tick();
}

function updateHomeCover() {
  const track = getHomeTrack();
  const cover = document.getElementById("home-music-cover");
  if (!cover) return;
  if (track?.cover) {
    cover.src = track.cover;
    cover.alt = track.title || "封面";
  }
}

function updateHomeNowPlaying() {
  const track = getHomeTrack();
  const title = document.getElementById("home-music-title");
  if (!track) {
    if (title) title.textContent = "暂无曲目";
    return;
  }
  if (title) title.textContent = track.title || "—";
  updateHomeCover();
}

function renderHomeTrackList() {
  const list = document.getElementById("home-music-list");
  if (!list) return;
  if (!HOME_MUSIC.tracks.length) {
    list.innerHTML = `<li class="home-music-empty">暂无曲目</li>`;
    return;
  }
  list.innerHTML = HOME_MUSIC.tracks
    .map(
      (t, i) => `
      <li>
        <button type="button" class="home-music-item${i === HOME_MUSIC.index ? " active" : ""}${t.fileMissing ? " home-music-item--missing" : ""}" data-index="${i}" ${t.fileMissing ? 'disabled title="音频文件未找到"' : ""} style="${t.voicebankColor ? `--track-accent:${t.voicebankColor}` : ""}">
          <img class="home-music-item-cover" src="${homeMusicEscape(t.cover || "")}" alt="" loading="lazy" />
          <span class="home-music-item-text">
            <span class="home-music-item-title">${homeMusicEscape(t.title || t.file)}${t.fileMissing ? "（未找到文件）" : ""}</span>
            ${t.voicebankLabel ? `<span class="home-music-item-vb">${homeMusicEscape(t.voicebankLabel)}</span>` : ""}
          </span>
        </button>
      </li>`
    )
    .join("");
  list.querySelectorAll(".home-music-item:not([disabled])").forEach((btn) => {
    btn.addEventListener("click", () => selectHomeTrack(Number(btn.dataset.index), true));
  });
}

function bindHomeAudioEvents() {
  const audio = HOME_MUSIC.audio;
  if (!audio) return;

  audio.addEventListener("timeupdate", () => {
    const dur = audio.duration || 1;
    HOME_MUSIC.progress = audio.currentTime / dur;
    const cur = document.getElementById("home-music-current");
    const durEl = document.getElementById("home-music-duration");
    if (cur) cur.textContent = formatHomeTime(audio.currentTime);
    if (durEl && Number.isFinite(dur)) durEl.textContent = formatHomeTime(dur);
  });

  audio.addEventListener("play", async () => {
    HOME_MUSIC.playing = true;
    setHomePlayIcon(true);
    document.getElementById("home-music-play")?.classList.add("is-playing");
    document.querySelector(".home-music-card")?.classList.add("is-playing");
    document.getElementById("home-music")?.classList.add("is-playing");
    if (typeof setAudioReactivePlaying === "function") setAudioReactivePlaying(true);
    await resumeHomeAudioCtx();
    const track = getHomeTrack();
    if (track) {
      window.dispatchEvent(
        new CustomEvent("milestone-song-play", { detail: { name: track.linkTitle || track.title || "" } })
      );
    }
    if (track && typeof focusVerseFromTrack === "function") focusVerseFromTrack(track);
  });

  audio.addEventListener("pause", () => {
    HOME_MUSIC.playing = false;
    setHomePlayIcon(false);
    document.getElementById("home-music-play")?.classList.remove("is-playing");
    document.querySelector(".home-music-card")?.classList.remove("is-playing");
    document.getElementById("home-music")?.classList.remove("is-playing");
    if (typeof setAudioReactivePlaying === "function") setAudioReactivePlaying(false);
    if (typeof setMosaicPlayingSong === "function") setMosaicPlayingSong(null);
  });

  audio.addEventListener("ended", () => {
    HOME_MUSIC.playing = false;
    setHomePlayIcon(false);
    document.querySelector(".home-music-card")?.classList.remove("is-playing");
    if (HOME_MUSIC.index < HOME_MUSIC.tracks.length - 1) {
      selectHomeTrack(HOME_MUSIC.index + 1, true);
    }
  });

  audio.addEventListener("loadedmetadata", () => {
    const durEl = document.getElementById("home-music-duration");
    if (durEl) durEl.textContent = formatHomeTime(audio.duration);
  });

  audio.addEventListener("error", () => {
    const title = document.getElementById("home-music-title");
    if (title) title.textContent = "无法加载该曲目";
  });
}

function selectHomeTrack(index, autoplay = false) {
  const track = HOME_MUSIC.tracks[index];
  if (!track || track.fileMissing) return;
  HOME_MUSIC.index = index;
  HOME_MUSIC.progress = 0;
  HOME_MUSIC.audio.src = track.file;
  HOME_MUSIC.audio.load();
  updateHomeNowPlaying();
  renderHomeTrackList();
  if (typeof focusVerseFromTrack === "function") focusVerseFromTrack(track);
  else if (typeof applyHomeTrackTheme === "function") applyHomeTrackTheme(track);
  if (autoplay) {
    HOME_MUSIC.audio.play().catch(() => {});
  }
}

function toggleHomeMusic() {
  const track = getHomeTrack();
  if (!track || !HOME_MUSIC.audio) return;
  if (!HOME_MUSIC.audio.src) {
    selectHomeTrack(HOME_MUSIC.index, true);
    return;
  }
  if (HOME_MUSIC.audio.paused) {
    HOME_MUSIC.audio.play().catch(() => {});
  } else {
    HOME_MUSIC.audio.pause();
  }
}

function seekHomeMusic(ratio) {
  const dur = HOME_MUSIC.audio?.duration;
  if (dur && Number.isFinite(dur)) {
    HOME_MUSIC.audio.currentTime = dur * Math.max(0, Math.min(1, ratio));
  }
}

function mergeTrackLists(manifestTracks, scannedTracks) {
  const map = new Map();
  for (const t of manifestTracks || []) {
    const n = normalizeHomeTrack(t);
    if (n) map.set(n.file, n);
  }
  for (const t of scannedTracks || []) {
    const n = normalizeHomeTrack(t);
    if (n && !map.has(n.file)) map.set(n.file, n);
  }
  return [...map.values()];
}

async function probeHomeTrackFile(path) {
  const url = homeMusicResolve(path);
  const attempts = [{ method: "HEAD" }, { method: "GET", headers: { Range: "bytes=0-0" } }];
  for (const opts of attempts) {
    try {
      const res = await fetch(url, opts);
      if (res.ok || res.status === 206) return url;
    } catch {
      /* try next */
    }
  }
  return null;
}

async function resolveHomeTrackFiles(tracks) {
  const birthdayCandidates =
    typeof KAITO_BIRTHDAY_LOCAL_FILES === "object" && Array.isArray(KAITO_BIRTHDAY_LOCAL_FILES)
      ? KAITO_BIRTHDAY_LOCAL_FILES
      : [
          "./music/メリー・アンバースデー___夏山よつぎ_feat._KAIT.m4a",
          "./music/merry-unbirthday.m4a",
          "./music/メリー・アンバースデー.m4a",
          "./music/Merry Unbirthday.m4a",
        ];

  const resolved = [];
  for (const track of tracks) {
    const paths = track.kaitoBirthday
      ? [...new Set([track.file, ...(track.fileCandidates || []), ...birthdayCandidates].filter(Boolean))]
      : [track.file];

    let fileUrl = null;
    for (const path of paths) {
      fileUrl = await probeHomeTrackFile(path);
      if (fileUrl) break;
    }

    if (fileUrl) {
      resolved.push({ ...track, file: fileUrl, fileMissing: false });
      continue;
    }

    if (track.kaitoBirthday) {
      resolved.push({
        ...track,
        file: homeMusicResolve(track.file),
        fileMissing: true,
      });
      continue;
    }

    resolved.push(track);
  }
  return resolved;
}

async function verifyHomeTracks(tracks) {
  const ok = [];
  for (const track of tracks) {
    if (track.fileMissing === false) {
      ok.push(track);
      continue;
    }
    const exists = await probeHomeTrackFile(track.file);
    if (exists) {
      ok.push({ ...track, file: exists, fileMissing: false });
      continue;
    }
    ok.push({
      ...track,
      file: homeMusicResolve(track.file),
      fileMissing: true,
    });
  }
  return ok;
}

async function loadHomeMusicData() {
  let data = null;
  try {
    const res =
      typeof fetchSite === "function"
        ? await fetchSite("./data/local_music.json")
        : await fetch("./data/local_music.json");
    if (res.ok) data = await res.json();
  } catch {
    /* ignore */
  }

  let scanned = [];
  try {
    const api =
      typeof fetchSite === "function"
        ? await fetchSite("./api/music-tracks.json")
        : await fetch("./api/music-tracks.json");
    if (api.ok) {
      const payload = await api.json();
      scanned = payload?.tracks || [];
      if (!data && payload) data = payload;
    }
  } catch {
    /* static */
  }

  HOME_MUSIC.meta = data || { title: "KAITO 歌曲", tracks: [] };
  const merged = mergeTrackLists(HOME_MUSIC.meta.tracks, scanned);
  const withPaths = await resolveHomeTrackFiles(merged);
  HOME_MUSIC.tracks = await verifyHomeTracks(withPaths);

  const heading = document.getElementById("home-music-heading");
  const sub = document.getElementById("home-music-sub");
  if (heading) heading.textContent = HOME_MUSIC.meta.title || "KAITO 歌曲";
  if (sub) {
    const text = HOME_MUSIC.meta.subtitle || "";
    sub.textContent = text;
    sub.hidden = !text;
  }
}

async function initHomeMusicPlayer(options = {}) {
  const section = document.getElementById("home-music");
  if (!section) return;

  HOME_MUSIC.audio = document.getElementById("home-music-audio");
  bindHomeAudioEvents();
  initHomeAudioGraph();

  await loadHomeMusicData();

  if (typeof enrichHomeTracks === "function") {
    HOME_MUSIC.tracks = enrichHomeTracks(HOME_MUSIC.tracks, {
      songs: options.songs || window.allSongs,
      wikiSongs: options.wikiSongs,
      milestones: options.milestones,
    });
  }

  renderHomeTrackList();
  updateHomeNowPlaying();
  startHomeVizLoop();

  if (HOME_MUSIC.tracks.length) {
    const firstPlayable = HOME_MUSIC.tracks.find((t) => !t.fileMissing) || HOME_MUSIC.tracks[0];
    if (firstPlayable && !firstPlayable.fileMissing) {
      HOME_MUSIC.audio.src = firstPlayable.file;
      if (typeof applyHomeTrackTheme === "function") applyHomeTrackTheme(firstPlayable);
    }
  }

  if (typeof initHomeMusicLinkToggle === "function") initHomeMusicLinkToggle();

  window.dispatchEvent(new CustomEvent("home-music-ready", { detail: { tracks: HOME_MUSIC.tracks } }));

  document.getElementById("home-music-play")?.addEventListener("click", toggleHomeMusic);

  const viz = document.getElementById("home-music-viz");
  viz?.addEventListener("click", (e) => {
    const rect = viz.getBoundingClientRect();
    seekHomeMusic((e.clientX - rect.left) / rect.width);
  });
  viz?.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const rect = viz.getBoundingClientRect();
    const move = (ev) => seekHomeMusic((ev.clientX - rect.left) / rect.width);
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    seekHomeMusic((e.clientX - rect.left) / rect.width);
  });

  document.addEventListener("keydown", (e) => {
    if (!section.contains(document.activeElement) && document.activeElement !== document.body) {
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || document.activeElement?.isContentEditable) return;
    }
    if (e.code === "Space" && e.target.closest("#home-music")) {
      e.preventDefault();
      toggleHomeMusic();
    }
    if (e.code === "ArrowRight" && e.target.closest("#home-music")) {
      selectHomeTrack(Math.min(HOME_MUSIC.index + 1, HOME_MUSIC.tracks.length - 1), true);
    }
    if (e.code === "ArrowLeft" && e.target.closest("#home-music")) {
      selectHomeTrack(Math.max(HOME_MUSIC.index - 1, 0), true);
    }
  });

  window.addEventListener("resize", () => {
    drawHomeVisualizer();
    drawHomeReactiveBg();
  });
}

window.HOME_MUSIC = HOME_MUSIC;
window.selectHomeTrack = selectHomeTrack;
window.initHomeMusicPlayer = initHomeMusicPlayer;
