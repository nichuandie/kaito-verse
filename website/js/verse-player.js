/**
 * 站内试听 — Bilibili / Nico / YouTube 嵌入 + 本地 MP3（参考 120712.com）
 */

const VersePlayer = {
  open: false,
  song: null,
  mode: null,
};

function parsePlayableMedia(url) {
  if (!url) return null;
  const u = String(url).trim();

  const bvid = u.match(/BV[\w]+/i);
  if (u.includes("bilibili.com") && bvid) {
    return { mode: "bilibili", id: bvid[0], embed: `https://player.bilibili.com/player.html?bvid=${bvid[0]}&high_quality=1&autoplay=1` };
  }

  const nico = u.match(/(?:sm|so|nm)\d+/i);
  if (u.includes("nicovideo.jp") && nico) {
    return { mode: "nico", id: nico[0], embed: `https://embed.nicovideo.jp/watch/${nico[0]}?autoplay=1` };
  }

  const yt =
    u.match(/[?&]v=([\w-]{11})/)?.[1] ||
    u.match(/youtu\.be\/([\w-]{11})/)?.[1] ||
    u.match(/youtube\.com\/embed\/([\w-]{11})/)?.[1];
  if (yt) {
    return { mode: "youtube", id: yt, embed: `https://www.youtube.com/embed/${yt}?autoplay=1` };
  }

  if (/\.(mp3|ogg|wav|m4a|flac)(\?|$)/i.test(u)) {
    const local = u.replace(/^\/+/, "").replace(/^\.\//, "");
    const src =
      typeof resolveSitePath === "function" ? resolveSitePath(local.startsWith("music/") ? `./${local}` : local) : local;
    return { mode: "audio", src };
  }

  return { mode: "link", href: u };
}

function ensureVersePlayerDOM() {
  if (document.getElementById("verse-player")) return;

  const el = document.createElement("div");
  el.id = "verse-player";
  el.className = "verse-player";
  el.innerHTML = `
    <div class="verse-player-inner">
      <button type="button" class="verse-player-close" aria-label="关闭播放器">×</button>
      <div class="verse-player-meta">
        <span class="verse-player-label">♪ NOW PLAYING</span>
        <strong class="verse-player-title">—</strong>
        <span class="verse-player-platform"></span>
      </div>
      <div class="verse-player-stage" id="verse-player-stage"></div>
      <p class="verse-player-hint">里程碑曲支持 Bilibili / Nico / YouTube 嵌入 · 也可在 <code>website/music/</code> 放置 MP3</p>
    </div>`;
  document.body.appendChild(el);

  el.querySelector(".verse-player-close")?.addEventListener("click", closeVersePlayer);
}

function renderVersePlayerStage(media) {
  const stage = document.getElementById("verse-player-stage");
  if (!stage) return;
  stage.innerHTML = "";

  if (!media) {
    stage.innerHTML = `<p class="verse-player-empty">暂无可嵌入的播放源</p>`;
    return;
  }

  if (media.mode === "bilibili" || media.mode === "nico" || media.mode === "youtube") {
    const iframe = document.createElement("iframe");
    iframe.src = media.embed;
    iframe.allow =
      "autoplay; encrypted-media; picture-in-picture; fullscreen";
    iframe.allowFullscreen = true;
    iframe.title = "歌曲播放器";
    iframe.loading = "lazy";
    stage.appendChild(iframe);
    return;
  }

  if (media.mode === "audio") {
    stage.innerHTML = `<audio controls autoplay src="${media.src}"></audio>`;
    return;
  }

  if (media.mode === "link") {
    stage.innerHTML = `<p class="verse-player-empty">该链接暂不支持页内播放，<a href="${media.href}" target="_blank" rel="noopener">在新标签页打开</a></p>`;
  }
}

function openVersePlayer(song) {
  if (!song) return;
  ensureVersePlayerDOM();

  const url = song.url || song.media_url || "";
  const media = parsePlayableMedia(url);
  VersePlayer.song = song;
  VersePlayer.mode = media?.mode || null;
  VersePlayer.open = true;

  const root = document.getElementById("verse-player");
  root.classList.add("is-open");
  root.querySelector(".verse-player-title").textContent = song.name || "—";
  root.querySelector(".verse-player-platform").textContent =
    song.platform || media?.mode || "";

  renderVersePlayerStage(media);

  window.dispatchEvent(
    new CustomEvent("milestone-song-play", { detail: { name: song.name || "" } })
  );
}

function closeVersePlayer() {
  const root = document.getElementById("verse-player");
  if (!root) return;
  root.classList.remove("is-open");
  const stage = document.getElementById("verse-player-stage");
  if (stage) stage.innerHTML = "";
  VersePlayer.open = false;
  VersePlayer.song = null;
  window.dispatchEvent(new CustomEvent("verse-player-closed"));
}

function initVersePlayer() {
  ensureVersePlayerDOM();
  window.openVersePlayer = openVersePlayer;
  window.closeVersePlayer = closeVersePlayer;
}

function versePlayButtonHTML(song, label = "▶") {
  if (!song?.url && !song?.media_url) return "";
  const payload = encodeURIComponent(JSON.stringify({ name: song.name, url: song.url || song.media_url, platform: song.platform || "" }));
  return `<button type="button" class="verse-play-btn" data-play="${payload}" title="页内试听">${label}</button>`;
}

function bindVersePlayButtons(root = document) {
  root.querySelectorAll(".verse-play-btn").forEach((btn) => {
    if (btn.dataset.bound) return;
    btn.dataset.bound = "1";
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      try {
        const song = JSON.parse(decodeURIComponent(btn.dataset.play));
        openVersePlayer(song);
      } catch {
        /* ignore */
      }
    });
  });
}
