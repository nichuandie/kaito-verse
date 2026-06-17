/**
 * KAITO 相关曲目筛选 — 今日推荐 / 生日季等共用
 */

const KAITO_VOCALIST = "KAITO";

const KAITO_BIRTHDAY_LOCAL_FILES = [
  "./music/メリー・アンバースデー___夏山よつぎ_feat._KAIT.m4a",
  "./music/merry-unbirthday.m4a",
  "./music/メリー・アンバースデー.m4a",
  "./music/Merry Unbirthday.m4a",
];

/** KAITO 官方生日曲 — Crypton 17 周年记念（夏山よつぎ 书き下ろし） */
const KAITO_BIRTHDAY_SONG = {
  name: "メリー・アンバースデー",
  producer: "夏山よつぎ",
  vocalists: [{ name: "KAITO", color: "#0000FF" }],
  primary_vocalist: KAITO_VOCALIST,
  involves_kaito: true,
  localFile: KAITO_BIRTHDAY_LOCAL_FILES[0],
  platform: "local",
  tierId: "curated",
  tierLabel: "KAITO 官方生日曲",
  source: "curated",
  kaitoBirthday: true,
};

function isKaitoBirthdayCanonicalSong(song) {
  const name = song?.name || "";
  return /メリー・アンバースデー|merry.?unbirthday/i.test(name);
}

/** 生日当天 / 生日周默认曲目；若里程碑库已有则优先合并库内元数据 */
function getKaitoBirthdayCuratedSong(milestones) {
  const pool = collectStrictKaitoMilestonePool(milestones);
  const fromPool = pool.find(isKaitoBirthdayCanonicalSong);
  if (fromPool) {
    return {
      ...KAITO_BIRTHDAY_SONG,
      ...fromPool,
      url: undefined,
      localFile: KAITO_BIRTHDAY_SONG.localFile,
      platform: "local",
      tierLabel: KAITO_BIRTHDAY_SONG.tierLabel,
      kaitoBirthday: true,
    };
  }
  return { ...KAITO_BIRTHDAY_SONG };
}

function getSongVocalistNames(song) {
  return (song?.vocalists || []).map((v) => v?.name).filter(Boolean);
}

/** 声库列表含 KAITO，或无列表时 primary 为 KAITO 且标记 involves_kaito */
function isKaitoRelatedSong(song) {
  if (!song) return false;
  const vocalists = getSongVocalistNames(song);
  if (vocalists.length) return vocalists.includes(KAITO_VOCALIST);
  return !!song.involves_kaito && song.primary_vocalist === KAITO_VOCALIST;
}

/** 排除「给 Miku 过生日」等标题，仅保留与 KAITO 生日相关的曲名 */
function isKaitoBirthdayThemedSong(song) {
  if (!isKaitoRelatedSong(song)) return false;
  const name = song.name || "";
  if (!/生日|誕生|birthday|バースデ|お祝/i.test(name)) return false;

  if (/for\s+miku|ミクの|初音.*(?:生日|誕生)|miku.*birthday|给\s*初音|初音.*(?:の|之)?(?:生日|誕生)/i.test(name)) {
    return false;
  }
  if (/kaito|カイト|大哥|冰青/i.test(name)) return true;
  if (song.primary_vocalist === KAITO_VOCALIST) return true;

  const vocalists = getSongVocalistNames(song);
  return vocalists.length === 1 && vocalists[0] === KAITO_VOCALIST;
}

function getKaitoSongRoleLabel(song) {
  const vocalists = getSongVocalistNames(song);
  if (!vocalists.includes(KAITO_VOCALIST)) return "";
  if (vocalists.length === 1) return "KAITO 独唱";
  const others = vocalists.filter((n) => n !== KAITO_VOCALIST);
  if (others.length === 1) return `KAITO · ${others[0]}`;
  return `KAITO 共演 · ${others.slice(0, 2).join(" · ")}${others.length > 2 ? " 等" : ""}`;
}

function collectStrictKaitoMilestonePool(milestones) {
  if (!milestones?.tiers) return [];
  const seen = new Set();
  const pool = [];
  for (const tier of milestones.tiers) {
    for (const song of tier.songs || []) {
      if (!isKaitoRelatedSong(song)) continue;
      const key = `${song.name}|${song.url || ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      pool.push({ ...song, tierId: tier.id, tierLabel: tier.label });
    }
  }
  return pool;
}

window.isKaitoRelatedSong = isKaitoRelatedSong;
window.isKaitoBirthdayThemedSong = isKaitoBirthdayThemedSong;
window.getKaitoSongRoleLabel = getKaitoSongRoleLabel;
window.collectStrictKaitoMilestonePool = collectStrictKaitoMilestonePool;
window.KAITO_BIRTHDAY_SONG = KAITO_BIRTHDAY_SONG;
window.KAITO_BIRTHDAY_LOCAL_FILES = KAITO_BIRTHDAY_LOCAL_FILES;
window.getKaitoBirthdayCuratedSong = getKaitoBirthdayCuratedSong;
window.isKaitoBirthdayCanonicalSong = isKaitoBirthdayCanonicalSong;
