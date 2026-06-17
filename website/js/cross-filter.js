/**
 * 全站联动筛选：网络图 / 里程碑 / 歌曲表
 */

const VerseFilter = {
  vocalist: null,
  producer: null,
  songKeyword: null,
  source: null,
};

const VOCALIST_JA_TO_ZH = {
  初音ミク: "初音未来",
  鏡音リン: "镜音铃",
  鏡音レン: "镜音连",
  巡音ルカ: "巡音流歌",
  MEIKO: "MEIKO",
  KAITO: "KAITO",
};

function normalizeVocalistFilter(name) {
  if (!name) return null;
  return VOCALIST_JA_TO_ZH[name] || name;
}

function setVerseFilter(patch, source = "unknown") {
  if ("vocalist" in patch) {
    VerseFilter.vocalist = patch.vocalist ? normalizeVocalistFilter(patch.vocalist) : null;
  }
  if ("producer" in patch) VerseFilter.producer = patch.producer || null;
  if ("songKeyword" in patch) VerseFilter.songKeyword = patch.songKeyword || null;
  VerseFilter.source = source;

  updateVerseFilterBar();
  window.dispatchEvent(
    new CustomEvent("verse-filter-change", {
      detail: { ...VerseFilter },
    })
  );
}

function clearVerseFilter(source = "clear") {
  VerseFilter.vocalist = null;
  VerseFilter.producer = null;
  VerseFilter.songKeyword = null;
  VerseFilter.source = source;
  updateVerseFilterBar();
  window.dispatchEvent(
    new CustomEvent("verse-filter-change", {
      detail: { ...VerseFilter },
    })
  );
}

function updateVerseFilterBar() {
  const bar = document.getElementById("verse-filter-bar");
  if (!bar) return;

  const parts = [];
  if (VerseFilter.vocalist) parts.push(`角色：${VerseFilter.vocalist}`);
  if (VerseFilter.producer) parts.push(`P主：${VerseFilter.producer}`);
  if (VerseFilter.songKeyword) parts.push(`曲名：${VerseFilter.songKeyword}`);

  if (!parts.length) {
    bar.hidden = true;
    bar.innerHTML = "";
    return;
  }

  bar.hidden = false;
  bar.innerHTML = `
    <span class="verse-filter-label">联动筛选</span>
    ${parts.map((p) => `<span class="verse-filter-chip">${escapeHtml(p)}</span>`).join("")}
    <button type="button" class="verse-filter-clear" id="verse-filter-clear">清除</button>`;
  document.getElementById("verse-filter-clear")?.addEventListener("click", () => clearVerseFilter("bar"));
}

function initVerseFilterBar() {
  if (document.getElementById("verse-filter-bar")) return;
  const header = document.querySelector(".site-header");
  if (!header) return;
  const bar = document.createElement("div");
  bar.id = "verse-filter-bar";
  bar.className = "verse-filter-bar";
  bar.hidden = true;
  header.after(bar);
}

function songMatchesVerseFilter(song) {
  if (VerseFilter.vocalist) {
    const v = VerseFilter.vocalist;
    let tags = "";
    if (Array.isArray(song.vocalists)) {
      tags = song.vocalists
        .map((x) => (typeof x === "string" ? x : x.name))
        .join(" ")
        .toUpperCase();
    } else {
      tags = (song.vocalists || "").toUpperCase();
    }
    const zh = v.toUpperCase();
    const ja = Object.entries(VOCALIST_JA_TO_ZH).find(([, z]) => z === v)?.[0]?.toUpperCase() || "";
    if (!tags.includes(zh) && !(ja && tags.includes(ja))) return false;
  }
  if (VerseFilter.producer) {
    const p = VerseFilter.producer.toLowerCase();
    if (!(song.producer || "").toLowerCase().includes(p)) return false;
  }
  if (VerseFilter.songKeyword) {
    const kw = VerseFilter.songKeyword.toLowerCase();
    if (!(song.name || "").toLowerCase().includes(kw)) return false;
  }
  return true;
}

function bindVerseFilterToApp() {
  window.addEventListener("verse-filter-change", (e) => {
    const { producer, songKeyword, source } = e.detail;
    if (source === "app") return;
    const input = document.getElementById("search-input");
    if (source === "clear" || source === "home-music-sync-off") {
      if (input) input.value = "";
    } else if (input && (songKeyword || producer)) {
      input.value = songKeyword || producer || "";
    }
    if (typeof applyFilters === "function") applyFilters(true);
  });
}

function bindVerseFilterToMilestones() {
  window.addEventListener("verse-filter-change", async (e) => {
    if (typeof wikiMilestoneState === "undefined" || typeof renderWikiMilestoneView !== "function") return;
    const { vocalist, producer, songKeyword, source } = e.detail;
    if (source === "milestones" || source === "milestones-viz") return;

    if (vocalist) {
      wikiMilestoneState.vocalists = new Set([vocalist]);
      wikiMilestoneState.focusVocalist = vocalist;
      wikiMilestoneState.filter = "all";
      document.querySelectorAll(".wiki-filter-btn").forEach((b) => b.classList.remove("active"));
      document.querySelector('.wiki-filter-btn[data-filter="all"]')?.classList.add("active");
    } else if (source === "clear" || source === "home-music-sync-off") {
      wikiMilestoneState.vocalists.clear();
      wikiMilestoneState.focusVocalist = "KAITO";
      wikiMilestoneState.keyword = "";
      wikiMilestoneState.filter = "all";
      document.querySelectorAll(".wiki-filter-btn").forEach((b) => b.classList.remove("active"));
      document.querySelector('.wiki-filter-btn[data-filter="all"]')?.classList.add("active");
      const input = document.getElementById("wiki-milestone-search");
      if (input) input.value = "";
    }

    if (producer || songKeyword) {
      const kw = songKeyword || producer || "";
      const input = document.getElementById("wiki-milestone-search");
      if (input) input.value = kw;
      wikiMilestoneState.keyword = kw.toLowerCase();
    } else if (source !== "clear" && source !== "home-music-sync-off") {
      /* keep existing keyword when unrelated filter updates */
    } else {
      wikiMilestoneState.keyword = "";
    }

    wikiMilestoneState.page = 1;

    if (typeof setMosaicForFocusVocalist === "function") {
      await setMosaicForFocusVocalist(wikiMilestoneState.focusVocalist, false);
    }

    renderWikiMilestoneView();
  });
}

function bindVerseFilterToNetwork() {
  window.addEventListener("verse-filter-change", (e) => {
    if (!networkState?.chart) return;
    const { vocalist } = e.detail;
    if (vocalist) {
      const ja = Object.entries(VOCALIST_JA_TO_ZH).find(([, z]) => z === vocalist)?.[0];
      if (ja) highlightNode(ja);
    }
  });
}
