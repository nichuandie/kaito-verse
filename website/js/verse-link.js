/**
 * 首页播放器 ↔ 里程碑 / 词云 / 声线色彩联动
 */

const VERSE_LINK_STORAGE_KEY = "kaito-verse-music-sync";

const VerseLink = {
  focusTitle: null,
  focusProducer: null,
  wikiSongs: [],
  syncEnabled: true,
};

function collectWikiSongs(milestones) {
  const out = [];
  if (!milestones?.tiers) return out;
  for (const tier of milestones.tiers) {
    for (const song of tier.songs || []) {
      out.push({ ...song, tierId: tier.id, tierLabel: tier.label });
    }
  }
  return out;
}

function findWikiSongForTitle(title, wikiSongs) {
  if (!title) return null;
  const norm = title.trim().toLowerCase();
  const hits = (wikiSongs || VerseLink.wikiSongs).filter(
    (s) => (s.name || "").trim().toLowerCase() === norm
  );
  if (!hits.length) return null;
  return hits.find((s) => s.involves_kaito || s.primary_vocalist === "KAITO") || hits[0];
}

function findVocadbSongForTitle(title, songs) {
  if (!title || !songs?.length) return null;
  const norm = title.trim().toLowerCase();
  return songs.find((s) => (s.name || "").trim().toLowerCase() === norm) || null;
}

function resolveTrackVoicebank(track, vocadbSong) {
  if (track?.voicebank && VOICEBANK_COLORS?.[track.voicebank]) return track.voicebank;
  if (typeof extractVoicebanksFromSong === "function" && vocadbSong) {
    const banks = extractVoicebanksFromSong(vocadbSong);
    if (banks.length === 1) return banks[0];
    if (banks.length > 1) return banks.includes("STRAIGHT") ? "STRAIGHT" : banks[0];
  }
  return track?.voicebank || "Unknown";
}

function enrichHomeTrack(track, context = {}) {
  if (!track) return track;
  const wikiSongs = context.wikiSongs || VerseLink.wikiSongs;
  const songs = context.songs || window.allSongs || [];
  const linkTitle = track.linkTitle || track.title;
  const wiki = findWikiSongForTitle(linkTitle, wikiSongs);
  const vocadb = findVocadbSongForTitle(linkTitle, songs);

  const enriched = { ...track };
  if (wiki) {
    enriched.wiki = wiki;
    enriched.tierId = wiki.tierId;
    enriched.tierLabel = wiki.tierLabel;
    enriched.url = enriched.url || wiki.url;
    enriched.platform = enriched.platform || wiki.platform;
    if (!enriched.producer && wiki.producer) enriched.producer = wiki.producer;
  }
  if (vocadb) {
    enriched.vocadb = vocadb;
    if (!enriched.producer && vocadb.producer) enriched.producer = vocadb.producer;
  }

  enriched.voicebank = resolveTrackVoicebank(enriched, vocadb);
  enriched.voicebankColor =
    (typeof VOICEBANK_COLORS !== "undefined" && VOICEBANK_COLORS[enriched.voicebank]) ||
    "#48cae4";
  enriched.voicebankLabel =
    (typeof VOICEBANK_LABELS !== "undefined" && VOICEBANK_LABELS[enriched.voicebank]) ||
    enriched.voicebank;

  return enriched;
}

function enrichHomeTracks(tracks, context = {}) {
  return (tracks || []).map((t) => enrichHomeTrack(t, context));
}

function initVerseLinkData(milestones, songs) {
  VerseLink.wikiSongs = collectWikiSongs(milestones);
  if (typeof window !== "undefined") {
    window.enrichHomeTracks = enrichHomeTracks;
    window.focusVerseFromTrack = focusVerseFromTrack;
  }
}

function loadVerseLinkSyncPreference() {
  try {
    const v = localStorage.getItem(VERSE_LINK_STORAGE_KEY);
    if (v === "0" || v === "false") VerseLink.syncEnabled = false;
  } catch {
    /* private mode */
  }
}

function isVerseLinkEnabled() {
  return VerseLink.syncEnabled !== false;
}

function syncVerseLinkToggleUI(enabled) {
  const input = document.getElementById("home-music-sync");
  if (input) input.checked = enabled;
  document.getElementById("home-music")?.classList.toggle("sync-off", !enabled);
}

function setVerseLinkEnabled(enabled) {
  const next = !!enabled;
  const prev = isVerseLinkEnabled();
  VerseLink.syncEnabled = next;
  try {
    localStorage.setItem(VERSE_LINK_STORAGE_KEY, next ? "1" : "0");
  } catch {
    /* ignore */
  }
  syncVerseLinkToggleUI(next);

  if (!next && prev) {
    clearVerseDataSync();
    if (typeof clearVerseFilter === "function") clearVerseFilter("home-music-sync-off");
  } else if (next && !prev) {
    const track =
      typeof getHomeTrack === "function" ? getHomeTrack() : window.HOME_MUSIC?.tracks?.[window.HOME_MUSIC?.index];
    if (track) syncVerseDataFromTrack(track);
  }
}

function applyPlayerTrackFocus(track) {
  if (!track) return;
  if (typeof setAudioReactiveVoicebankColor === "function") {
    setAudioReactiveVoicebankColor(track.voicebankColor);
  }
  applyHomeTrackTheme(track);
}

function syncVerseDataFromTrack(track) {
  if (!track) return;

  const title = track.linkTitle || track.title;
  VerseLink.focusTitle = title || null;
  VerseLink.focusProducer = track.producer || null;

  if (typeof setHeroTypoHighlight === "function") {
    setHeroTypoHighlight({ title, producer: track.producer });
  }

  if (typeof setVerseFilter === "function") {
    setVerseFilter(
      {
        songKeyword: title || null,
        producer: track.producer || null,
        vocalist: track.vocalist || "KAITO",
      },
      "home-music"
    );
  }

  window.dispatchEvent(
    new CustomEvent("verse-track-focus", {
      detail: { track, title, producer: track.producer },
    })
  );
}

function focusVerseFromTrack(track, options = {}) {
  if (!track) return;
  applyPlayerTrackFocus(track);
  if (options.forceSync || isVerseLinkEnabled()) {
    syncVerseDataFromTrack(track);
  } else {
    VerseLink.focusTitle = null;
    VerseLink.focusProducer = null;
  }
}

function clearVerseDataSync() {
  VerseLink.focusTitle = null;
  VerseLink.focusProducer = null;
  if (typeof setHeroTypoHighlight === "function") setHeroTypoHighlight(null);
  document.querySelectorAll(".wiki-song-table tr.wiki-row-linked").forEach((row) => {
    row.classList.remove("wiki-row-linked");
  });
}

function clearVerseTrackFocus() {
  clearVerseDataSync();
}

function initHomeMusicLinkToggle() {
  loadVerseLinkSyncPreference();
  const input = document.getElementById("home-music-sync");
  if (!input) return;
  syncVerseLinkToggleUI(isVerseLinkEnabled());
  input.addEventListener("change", () => setVerseLinkEnabled(input.checked));
}

function applyHomeTrackTheme(track) {
  const section = document.getElementById("home-music");
  const card = document.querySelector(".home-music-card");
  const playBtn = document.getElementById("home-music-play");
  const color = track?.voicebankColor || "#48cae4";

  section?.style.setProperty("--track-accent", color);
  card?.style.setProperty("--track-accent", color);
  playBtn?.style.setProperty("--track-accent", color);

  const meta = document.getElementById("home-music-meta");
  if (meta) {
    const parts = [];
    if (track.voicebankLabel) {
      parts.push(`<span class="home-music-tag voicebank">${escapeHtml(track.voicebankLabel)}</span>`);
    }
    if (track.producer) {
      parts.push(`<span class="home-music-tag producer">P主 · ${escapeHtml(track.producer)}</span>`);
    }
    if (track.tierLabel) {
      parts.push(`<span class="home-music-tag tier">${escapeHtml(track.tierLabel)}</span>`);
    }
    meta.innerHTML = parts.join("");
    meta.hidden = !parts.length;
  }
}

function bindVerseLinkEvents() {
  window.addEventListener("verse-filter-change", (e) => {
    if (e.detail?.source === "clear") clearVerseTrackFocus();
  });
}

window.initVerseLinkData = initVerseLinkData;
window.enrichHomeTrack = enrichHomeTrack;
window.enrichHomeTracks = enrichHomeTracks;
window.focusVerseFromTrack = focusVerseFromTrack;
window.clearVerseTrackFocus = clearVerseTrackFocus;
window.findWikiSongForTitle = findWikiSongForTitle;
window.bindVerseLinkEvents = bindVerseLinkEvents;
window.applyHomeTrackTheme = applyHomeTrackTheme;
window.isVerseLinkEnabled = isVerseLinkEnabled;
window.setVerseLinkEnabled = setVerseLinkEnabled;
window.initHomeMusicLinkToggle = initHomeMusicLinkToggle;
