/**
 * 今日 KAITO 推荐 — 按日期种子从里程碑 KAITO 曲库抽取
 */

const TodayKaito = {
  milestones: null,
  shuffleOffset: 0,
};

function hashDaySeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function collectKaitoMilestonePool(milestones) {
  if (typeof collectStrictKaitoMilestonePool === "function") {
    return collectStrictKaitoMilestonePool(milestones);
  }
  if (!milestones?.tiers) return [];
  const seen = new Set();
  const pool = [];
  for (const tier of milestones.tiers) {
    for (const song of tier.songs || []) {
      if (!song.involves_kaito && song.primary_vocalist !== "KAITO") continue;
      const key = `${song.name}|${song.url || ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      pool.push({ ...song, tierId: tier.id, tierLabel: tier.label });
    }
  }
  return pool;
}

function pickDailyKaito(milestones, date = new Date(), shuffleOffset = 0) {
  const pool = collectKaitoMilestonePool(milestones);
  if (!pool.length) return null;
  const key = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
  const idx = (hashDaySeed(key) + shuffleOffset) % pool.length;
  return pool[idx];
}

function pickTodayKaitoSong(milestones, shuffleOffset = 0) {
  const pool = collectKaitoMilestonePool(milestones);
  if (!pool.length) return null;

  const mode =
    typeof getKaitoBirthdayState === "function" ? getKaitoBirthdayState() : "normal";
  const date = new Date();
  const dayKey = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;

  if ((mode === "today" || mode === "afterglow") && shuffleOffset === 0) {
    if (typeof getKaitoBirthdayCuratedSong === "function") {
      return getKaitoBirthdayCuratedSong(milestones);
    }
    const themed = pool.filter((s) =>
      typeof isKaitoBirthdayThemedSong === "function"
        ? isKaitoBirthdayThemedSong(s)
        : /生日|誕生|birthday|バースデ/i.test(s.name || "")
    );
    if (themed.length) {
      return themed[hashDaySeed(`${dayKey}-bday`) % themed.length];
    }
    const hall = pool.filter((s) => s.tierId === "hall" || (s.tierLabel || "").includes("殿堂"));
    if (hall.length) {
      return hall[hashDaySeed(`${dayKey}-hall`) % hall.length];
    }
  }

  return pickDailyKaito(milestones, date, shuffleOffset);
}

function normalizeTrackTitle(text) {
  return (text || "").trim().toLowerCase();
}

function findHomeTrackIndexForSong(song) {
  if (!song || !window.HOME_MUSIC?.tracks?.length) return -1;
  const isBirthday =
    song.kaitoBirthday ||
    (typeof isKaitoBirthdayCanonicalSong === "function" && isKaitoBirthdayCanonicalSong(song));
  const names = new Set([song.name, song.linkTitle, ...(song.aliases || [])].map(normalizeTrackTitle));

  return window.HOME_MUSIC.tracks.findIndex((track) => {
    if (isBirthday && track.kaitoBirthday) return true;
    const titles = [track.title, track.linkTitle, ...(track.aliases || [])].map(normalizeTrackTitle);
    return titles.some((t) => names.has(t));
  });
}

function getHomeTrackForSong(song) {
  const idx = findHomeTrackIndexForSong(song);
  return idx >= 0 ? window.HOME_MUSIC.tracks[idx] : null;
}

function playHomeTrackByTitle(title, options = {}) {
  const { scroll = false } = options;
  if (!title || !window.HOME_MUSIC?.tracks?.length) return false;
  const idx = findHomeTrackIndexForSong({ name: title, linkTitle: title });
  const track = idx >= 0 ? window.HOME_MUSIC.tracks[idx] : null;
  if (idx >= 0 && !track?.fileMissing && typeof selectHomeTrack === "function") {
    selectHomeTrack(idx, true);
    if (scroll) {
      document.getElementById("home-music")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    return true;
  }
  return false;
}

function playTodayKaitoSong(song, options = {}) {
  if (!song) return false;
  const { scroll = false, sync = false } = options;

  const localIdx = findHomeTrackIndexForSong(song);
  const localTrack = localIdx >= 0 ? window.HOME_MUSIC.tracks[localIdx] : null;
  if (localIdx >= 0 && !localTrack?.fileMissing && typeof selectHomeTrack === "function") {
    selectHomeTrack(localIdx, true);
    if (scroll) {
      document.getElementById("home-music")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    if (sync && typeof focusVerseFromTrack === "function") {
      const track = window.HOME_MUSIC.tracks[localIdx];
      const enriched =
        typeof enrichHomeTrack === "function"
          ? enrichHomeTrack(track)
          : { title: song.name, producer: song.producer };
      focusVerseFromTrack(enriched, sync ? {} : { forceSync: false });
    }
    return "local";
  }

  if (playHomeTrackByTitle(song.name, { scroll })) {
    if (sync && typeof focusVerseFromTrack === "function") {
      const enriched =
        typeof enrichHomeTrack === "function"
          ? enrichHomeTrack({ title: song.name, linkTitle: song.name, producer: song.producer })
          : { title: song.name, producer: song.producer };
      focusVerseFromTrack(enriched, sync ? {} : { forceSync: false });
    }
    return "local";
  }

  if (song.url && typeof openVersePlayer === "function") {
    openVersePlayer({
      name: song.name,
      url: song.url,
      platform: song.platform || "bilibili",
    });
    if (sync && typeof focusVerseFromTrack === "function") {
      const enriched =
        typeof enrichHomeTrack === "function"
          ? enrichHomeTrack({ title: song.name, linkTitle: song.name, producer: song.producer })
          : { title: song.name, producer: song.producer };
      focusVerseFromTrack(enriched, { forceSync: true });
    }
    return "embed";
  }

  return false;
}

function todayKaitoEscape(text) {
  if (typeof escapeHtml === "function") return escapeHtml(text);
  const d = document.createElement("div");
  d.textContent = text ?? "";
  return d.innerHTML;
}

function canPlayTodayKaito(song) {
  if (!song) return false;
  const track = getHomeTrackForSong(song);
  if (track) return !track.fileMissing;
  return !!song.url;
}

function renderTodayKaito(milestones) {
  const host = document.getElementById("today-kaito");
  if (!host) return;

  TodayKaito.milestones = milestones;
  const birthdayMode =
    typeof getKaitoBirthdayState === "function" ? getKaitoBirthdayState() : "normal";
  const song = pickTodayKaitoSong(milestones, TodayKaito.shuffleOffset);
  if (!song) {
    host.hidden = true;
    return;
  }

  const dateLabel = new Date().toLocaleDateString("zh-CN", {
    month: "long",
    day: "numeric",
  });
  const playable = canPlayTodayKaito(song);
  const localTrack = getHomeTrackForSong(song);
  const hasLocal = !!localTrack && !localTrack.fileMissing;
  const missingLocal = !!localTrack?.fileMissing;
  const roleLabel =
    typeof getKaitoSongRoleLabel === "function" ? getKaitoSongRoleLabel(song) : "KAITO";

  const badgeLabel =
    birthdayMode === "today"
      ? "生日 KAITO"
      : birthdayMode === "soon" || birthdayMode === "afterglow"
        ? "生日季推荐"
        : "今日 KAITO";

  const isBirthdaySong =
    typeof isKaitoBirthdayCanonicalSong === "function" && isKaitoBirthdayCanonicalSong(song);

  host.hidden = false;
  host.classList.toggle("today-kaito--birthday", birthdayMode === "today");
  host.classList.toggle("today-kaito--season", birthdayMode === "soon" || birthdayMode === "afterglow");
  host.innerHTML = `
    <div class="today-kaito-inner">
      <span class="today-kaito-badge">${todayKaitoEscape(badgeLabel)}</span>
      <div class="today-kaito-body">
        <strong class="today-kaito-title">${todayKaitoEscape(song.name)}</strong>
        <span class="today-kaito-meta">${isBirthdaySong ? `${todayKaitoEscape(song.producer || "夏山よつぎ")} feat. KAITO · ` : ""}${todayKaitoEscape(roleLabel || "KAITO")} · ${todayKaitoEscape(song.tierLabel || "里程碑")}${!isBirthdaySong && song.producer ? ` · ${todayKaitoEscape(song.producer)}` : ""}</span>
      </div>
      <div class="today-kaito-actions">
        ${
          playable
            ? `<button type="button" class="today-kaito-btn today-kaito-play today-kaito-btn--primary" title="原地播放，不跳转页面">${hasLocal ? "播放" : "页内播放"}</button>`
            : ""
        }
        <button type="button" class="today-kaito-btn today-kaito-shuffle" title="换一首推荐">换一首</button>
        <a class="today-kaito-btn today-kaito-link" href="#milestones">查看里程碑</a>
      </div>
    </div>
    <p class="today-kaito-foot">${todayKaitoEscape(dateLabel)} · ${birthdayMode === "today" ? (isBirthdaySong ? "KAITO 官方生日曲 · 生日快乐" : "KAITO 生日快乐") : birthdayMode !== "normal" ? (isBirthdaySong ? "生日周主题曲" : "生日季特辑") : "每日一首 KAITO 里程碑曲"}${missingLocal ? " · 请将音频放入 website/music/メリー・アンバースデー___夏山よつぎ_feat._KAIT.m4a" : ""}</p>`;

  host.querySelector(".today-kaito-play")?.addEventListener("click", () => {
    playTodayKaitoSong(song, { scroll: false, sync: typeof isVerseLinkEnabled === "function" && isVerseLinkEnabled() });
    host.classList.add("today-kaito--playing");
    setTimeout(() => host.classList.remove("today-kaito--playing"), 900);
  });

  host.querySelector(".today-kaito-shuffle")?.addEventListener("click", () => {
    TodayKaito.shuffleOffset += 1;
    renderTodayKaito(TodayKaito.milestones);
  });

  host.querySelector(".today-kaito-link")?.addEventListener("click", (e) => {
    e.preventDefault();
    if (typeof focusVerseFromTrack === "function") {
      const enriched =
        typeof enrichHomeTrack === "function"
          ? enrichHomeTrack({ title: song.name, linkTitle: song.name, producer: song.producer })
          : { title: song.name, producer: song.producer };
      focusVerseFromTrack(enriched, { forceSync: true });
      if (typeof setVerseLinkEnabled === "function" && typeof isVerseLinkEnabled === "function" && !isVerseLinkEnabled()) {
        setVerseLinkEnabled(true);
      }
    }
    document.getElementById("milestones")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

function initTodayKaito(milestones) {
  renderTodayKaito(milestones);
  if (TodayKaito.birthdayBound) return;
  TodayKaito.birthdayBound = true;
  window.addEventListener("kaito-birthday-mode", () => {
    if (TodayKaito.milestones) renderTodayKaito(TodayKaito.milestones);
  });
  window.addEventListener("home-music-ready", () => {
    if (TodayKaito.milestones) renderTodayKaito(TodayKaito.milestones);
  });
}

window.initTodayKaito = initTodayKaito;
window.pickDailyKaito = pickDailyKaito;
window.playHomeTrackByTitle = playHomeTrackByTitle;
window.findHomeTrackIndexForSong = findHomeTrackIndexForSong;
window.playTodayKaitoSong = playTodayKaitoSong;
