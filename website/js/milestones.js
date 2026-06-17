const WIKI_MILESTONE_PAGE_SIZE = 10;

let wikiMilestoneState = {
  data: null,
  tierId: "hall",
  filter: "all",
  vocalists: new Set(),
  focusVocalist: "KAITO",
  keyword: "",
  page: 1,
  lastMetricValues: null,
  tierSwitchAnim: false,
};

const WIKI_TIER_ACCENT = {
  hall: "#48cae4",
  legend: "#ffd166",
  myth: "#ff6b9d",
};

function vocalistToCharacterId(vocalistName) {
  return resolveMosaicProfile(vocalistName).id;
}

async function selectMilestoneFocusVocalist(name) {
  if (!name) return;

  if (wikiMilestoneState.focusVocalist === name) {
    wikiMilestoneState.focusVocalist = "KAITO";
    wikiMilestoneState.vocalists.clear();
  } else {
    wikiMilestoneState.focusVocalist = name;
    wikiMilestoneState.vocalists = new Set([name]);
  }

  if (typeof setVerseFilter === "function") {
    const v = wikiMilestoneState.vocalists.size === 1 ? [...wikiMilestoneState.vocalists][0] : null;
    setVerseFilter({ vocalist: v, producer: null, songKeyword: null }, "milestones-viz");
  }

  if (typeof setMosaicForFocusVocalist === "function") {
    await setMosaicForFocusVocalist(wikiMilestoneState.focusVocalist, false);
  }

  wikiMilestoneState.page = 1;
  renderWikiMilestoneView();
}

function selectMilestoneTier(tierId) {
  if (!tierId || !wikiMilestoneState.data || wikiMilestoneState.tierId === tierId) return false;
  wikiMilestoneState.tierId = tierId;
  wikiMilestoneState.page = 1;
  wikiMilestoneState.tierSwitchAnim = true;
  document.querySelectorAll(".wiki-tier-tab").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tier === tierId);
  });
  applyMilestoneTierTheme(tierId);
  renderWikiMilestoneView();
  return true;
}

window.selectMilestoneTier = selectMilestoneTier;

function songsForFocusVocalist(songs, focusVocalist) {
  const focus = focusVocalist || "KAITO";
  return songs.filter((s) => (s.vocalists || []).some((v) => v.name === focus));
}


function onMosaicSongSelect(song) {
  const input = document.getElementById("wiki-milestone-search");
  if (input) input.value = song.name;
  wikiMilestoneState.keyword = song.name.toLowerCase();
  wikiMilestoneState.page = 1;
  renderWikiMilestoneView();
  document.querySelector(".wiki-song-table-wrap")?.scrollIntoView({ behavior: "smooth", block: "start" });
  requestAnimationFrame(() => {
    const row = document.querySelector("#wiki-song-tbody tr");
    row?.classList.add("wiki-row-flash");
    row?.addEventListener("animationend", () => row.classList.remove("wiki-row-flash"), { once: true });
  });
}

function renderMilestonesSection(data) {
  if (!data?.tiers?.length) return "";

  const tierTabs = data.tiers
    .map(
      (tier) => `
      <button type="button" class="wiki-tier-tab${tier.id === "hall" ? " active" : ""}" data-tier="${tier.id}">
        ${escapeHtml(tier.label)}
        <span class="wiki-tier-tab-count">${formatWikiCount(tier.count)}</span>
      </button>`
    )
    .join("");

  const legend = (data.character_legend || [])
    .map(
      (item) => `
      <button type="button" class="wiki-legend-chip" data-vocalist="${escapeHtml(item.name)}" title="${escapeHtml(item.name)}">
        <span class="wiki-legend-bar" style="background:${item.color}"></span>
        <span class="wiki-legend-name">${escapeHtml(item.name)}</span>
      </button>`
    )
    .join("");

  const sourceLinks = Object.entries(data.source_urls || {})
    .map(([key, url]) => {
      const tier = data.tiers.find((t) => t.id === key);
      return `<a href="${url}" target="_blank" rel="noopener">${escapeHtml(tier?.label || key)} · Vocawiki</a>`;
    })
    .join(" · ");

  return `
    <section id="milestones">
      <h2 class="section-title">殿堂 / 传说 / 神话曲</h2>
      <p class="section-desc wiki-reveal">${escapeHtml(data.note || "")}</p>
      <p class="section-desc wiki-tier-def wiki-reveal">等级标准：<strong>殿堂</strong> Bilibili 再生 ≥ 10万 · <strong>传说</strong> Bilibili 再生 ≥ 100万 · <strong>神话</strong> Niconico 再生 ≥ 1000万（与 Nico 神话体系不同，详见各 tab 说明）</p>
      <p class="wiki-source-line">数据来源：${sourceLinks} · 抓取于 ${escapeHtml(data.fetched_at || "—")}</p>

      <div class="wiki-milestone-toolbar">
        <div class="wiki-tier-tabs" role="tablist">${tierTabs}</div>
        <div class="wiki-tier-meta" id="wiki-tier-meta"></div>
      </div>

      <div class="wiki-viz-metrics wiki-reveal" id="wiki-viz-metrics"></div>

      <div class="wiki-viz-hero wiki-reveal">
        <div class="wiki-silhouette-panel">
          <h3 class="wiki-viz-title" id="wiki-mosaic-title">KAITO 构成概念</h3>
          <p class="wiki-viz-sub" id="wiki-mosaic-sub">亮色 = 焦点角色的里程碑曲 · 暗色 = 同等级其他角色曲 · 悬停色块显示曲名</p>
          <div class="wiki-silhouette-wrap" id="wiki-silhouette-wrap">
            <canvas id="wiki-kaito-mosaic" aria-label="角色构成色块剪影"></canvas>
            <div id="wiki-mosaic-tooltip" class="wiki-mosaic-tooltip"></div>
          </div>
          <div class="wiki-mosaic-stats" id="wiki-mosaic-stats"></div>
        </div>
        <div class="chart-panel wiki-chart-panel wiki-sunburst-panel">
          <div class="wiki-sunburst-head">
            <div>
              <h3 class="wiki-viz-title">等级 × 角色</h3>
              <p class="wiki-viz-sub">内圈：点击切换殿堂/传说/神话 · 外圈：选择角色 · 中心头像：重置为 KAITO</p>
            </div>
            <button type="button" id="wiki-sunburst-compare" class="wiki-viz-mode-btn" title="切换为同一角色在三个等级的分布对比">等级对比</button>
          </div>
          <div class="wiki-sunburst-chart-wrap">
            <div id="wiki-chart-sunburst" class="wiki-chart-box-sunburst"></div>
          </div>
          <div id="wiki-sunburst-compare-stats" class="wiki-compare-stats" hidden></div>
        </div>
      </div>

      <p class="wiki-viz-link-hint wiki-reveal">构成概念 · 等级×角色 · Treemap · 共演图 · 时间河流 — 点击联动 · 播放时剪影脉冲</p>

      <div class="wiki-viz-charts wiki-viz-charts-extended wiki-reveal">
        <div class="chart-panel wiki-chart-panel wiki-chart-panel-viz">
          <h3 class="wiki-viz-title">当前筛选 · 角色 Treemap</h3>
          <p class="wiki-viz-sub">点击角色 · 联动河流图 / 构成概念 / 等级×角色</p>
          <div id="wiki-chart-treemap" class="chart-box wiki-chart-box wiki-chart-box-viz"></div>
        </div>
        <div class="chart-panel wiki-chart-panel wiki-chart-panel-viz">
          <h3 class="wiki-viz-title">共演关系图</h3>
          <p class="wiki-viz-sub">环形布局 · 点击节点切换焦点角色</p>
          <div id="wiki-chart-collab" class="chart-box wiki-chart-box wiki-chart-box-viz"></div>
        </div>
        <div class="chart-panel wiki-chart-panel wiki-chart-span-2">
          <div id="wiki-chart-river" class="chart-box wiki-chart-box-wide"></div>
        </div>
      </div>

      <div class="wiki-filter-row wiki-reveal">
        <div class="wiki-filter-group">
          <button type="button" class="wiki-filter-btn active" data-filter="all">全部角色</button>
          <button type="button" class="wiki-filter-btn" data-filter="kaito">仅 KAITO</button>
          <button type="button" class="wiki-filter-btn" data-filter="clear-tags">清除标签筛选</button>
        </div>
        <input type="search" id="wiki-milestone-search" class="wiki-search" placeholder="搜索曲名 / P主…" />
      </div>

      <p class="wiki-filter-hint">下方表格可搜索 · 点击 ▶ 页内试听 · 构成色块双击试听</p>

      <div class="wiki-char-legend" id="wiki-char-legend">${legend}</div>

      <div class="wiki-active-tags" id="wiki-active-tags"></div>

      <div class="wiki-song-table-wrap wiki-reveal">
        <table class="wiki-song-table">
          <thead>
            <tr>
              <th class="wiki-col-play">试听</th>
              <th>代表色</th>
              <th>曲名</th>
              <th>P主</th>
              <th>演唱角色</th>
              <th>投稿 / 达成</th>
              <th>来源</th>
            </tr>
          </thead>
          <tbody id="wiki-song-tbody"></tbody>
        </table>
      </div>

      <div class="wiki-pagination" id="wiki-pagination"></div>
    </section>`;
}

async function initMilestonesSection(data) {
  if (!data?.tiers?.length) return;
  wikiMilestoneState.data = data;
  wikiMilestoneState.tierId = data.tiers[0].id;

  const section = document.getElementById("milestones");
  if (!section) return;

  if (typeof loadPiaproCharacters === "function") await loadPiaproCharacters();
  if (typeof loadVocalistImageMap === "function") await loadVocalistImageMap();

  section.querySelectorAll(".wiki-tier-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.dataset.tier === wikiMilestoneState.tierId) return;
      section.querySelectorAll(".wiki-tier-tab").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      wikiMilestoneState.tierId = btn.dataset.tier;
      wikiMilestoneState.vocalists.clear();
      wikiMilestoneState.page = 1;
      wikiMilestoneState.tierSwitchAnim = true;
      applyMilestoneTierTheme(btn.dataset.tier);
      renderWikiMilestoneView();
    });
  });

  section.querySelectorAll(".wiki-filter-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.dataset.filter === "clear-tags") {
        wikiMilestoneState.vocalists.clear();
        wikiMilestoneState.filter = "all";
        section.querySelectorAll(".wiki-filter-btn").forEach((b) => b.classList.remove("active"));
        section.querySelector('.wiki-filter-btn[data-filter="all"]')?.classList.add("active");
      } else {
        section.querySelectorAll(".wiki-filter-btn").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        wikiMilestoneState.filter = btn.dataset.filter;
        if (btn.dataset.filter === "kaito") {
          wikiMilestoneState.vocalists = new Set(["KAITO"]);
        } else if (btn.dataset.filter === "all") {
          wikiMilestoneState.vocalists.clear();
        }
      }
      wikiMilestoneState.page = 1;
      renderWikiMilestoneView();
    });
  });

  section.querySelectorAll(".wiki-legend-chip").forEach((chip) => {
    chip.addEventListener("click", () => toggleVocalistTag(chip.dataset.vocalist));
  });

  document.getElementById("wiki-milestone-search")?.addEventListener("input", (event) => {
    wikiMilestoneState.keyword = event.target.value.trim().toLowerCase();
    wikiMilestoneState.page = 1;
    renderWikiMilestoneView();
  });

  try {
    await initKaitoMosaic("wiki-kaito-mosaic", "wiki-mosaic-tooltip");
  } catch (err) {
    console.warn("KAITO 剪影加载失败:", err);
    document.getElementById("wiki-mosaic-stats") &&
      (document.getElementById("wiki-mosaic-stats").textContent = "剪影图片加载失败，请确认 assets/kaito-stand.png 存在");
  }

  initMilestoneScrollReveal();
  applyMilestoneTierTheme(wikiMilestoneState.tierId);
  renderWikiMilestoneView();
  bindVerseTrackFocusToMilestones();
}

function toggleVocalistTag(name) {
  if (!name) return;
  const next = new Set(wikiMilestoneState.vocalists);
  if (next.has(name)) next.delete(name);
  else next.add(name);
  wikiMilestoneState.vocalists = next;
  wikiMilestoneState.focusVocalist = next.size === 1 ? [...next][0] : "KAITO";
  wikiMilestoneState.page = 1;

  if (typeof setVerseFilter === "function") {
    const vocalist = next.size === 1 ? [...next][0] : null;
    setVerseFilter({ vocalist }, "milestones");
  }
  void (async () => {
    if (typeof setMosaicForFocusVocalist === "function") {
      await setMosaicForFocusVocalist(wikiMilestoneState.focusVocalist, false);
    }
    renderWikiMilestoneView();
  })();
}

function renderMosaicCharacterPicker() {
  /* 角色选择已移至 Treemap / Sunburst / 共演图联动 */
}

function getActiveTier() {
  return wikiMilestoneState.data?.tiers?.find((t) => t.id === wikiMilestoneState.tierId);
}

function collectTierSongs(tier) {
  if (tier.songs?.length) return tier.songs;
  const songs = [];
  for (const group of tier.by_vocalist || []) {
    for (const song of group.songs || []) songs.push(song);
  }
  return songs;
}

function computeVocalistStats(songs) {
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
  return [...map.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "zh-CN"));
}

function filterWikiSongs(songs) {
  let list = songs;
  if (wikiMilestoneState.filter === "kaito") {
    list = list.filter((s) => s.involves_kaito);
  }
  if (wikiMilestoneState.vocalists.size) {
    list = list.filter((s) =>
      [...wikiMilestoneState.vocalists].every((name) =>
        (s.vocalists || []).some((v) => v.name === name)
      )
    );
  }
  if (wikiMilestoneState.keyword) {
    const kw = wikiMilestoneState.keyword;
    list = list.filter(
      (s) =>
        (s.name || "").toLowerCase().includes(kw) ||
        (s.producer || "").toLowerCase().includes(kw)
    );
  }
  if (typeof songMatchesVerseFilter === "function" && typeof VerseFilter !== "undefined") {
    const hasGlobal =
      VerseFilter.vocalist || VerseFilter.producer || VerseFilter.songKeyword;
    if (hasGlobal) {
      list = list.filter((s) => songMatchesVerseFilter(s));
    }
  }
  return list;
}

function buildColorBarStyle(vocalists) {
  if (!vocalists?.length) return "background:#555";
  if (vocalists.length === 1) return `background:${vocalists[0].color}`;
  const stops = vocalists.map((v, i) => {
    const start = ((i / vocalists.length) * 100).toFixed(1);
    const end = (((i + 1) / vocalists.length) * 100).toFixed(1);
    return `${v.color} ${start}%, ${v.color} ${end}%`;
  });
  return `background:linear-gradient(90deg, ${stops.join(", ")})`;
}

function renderVocalistTags(vocalists) {
  return (vocalists || [])
    .map(
      (v) =>
        `<button type="button" class="wiki-song-tag${wikiMilestoneState.vocalists.has(v.name) ? " active" : ""}" data-vocalist="${escapeHtml(v.name)}"><span style="background:${v.color}"></span>${escapeHtml(v.name)}</button>`
    )
    .join("");
}

function sourceLabel(song) {
  if (song.source === "local_curated" || song.source === "nicodb") return "本地补充";
  if (song.source === "voca.wiki") return "Vocawiki";
  return song.source || "—";
}

function formatProducer(producer) {
  const text = (producer || "").trim();
  if (!text || text.includes("页面不存在")) return "—";
  return text;
}

function renderWikiMilestoneView() {
  const tier = getActiveTier();
  if (!tier) return;

  const allSongs = collectTierSongs(tier);
  const filtered = filterWikiSongs(allSongs);
  const stats = computeVocalistStats(filtered);
  const totalPages = Math.max(1, Math.ceil(filtered.length / WIKI_MILESTONE_PAGE_SIZE));
  if (wikiMilestoneState.page > totalPages) wikiMilestoneState.page = totalPages;

  const start = (wikiMilestoneState.page - 1) * WIKI_MILESTONE_PAGE_SIZE;
  const pageSongs = filtered.slice(start, start + WIKI_MILESTONE_PAGE_SIZE);

  syncLegendActiveState();
  renderMetrics(tier, allSongs, filtered);
  renderAllMilestoneViz({
    songs: filtered,
    stats,
    allTiers: wikiMilestoneState.data.tiers,
    filterState: wikiMilestoneState,
    focusVocalist: wikiMilestoneState.focusVocalist,
    onVocalistClick: selectMilestoneFocusVocalist,
  });
  renderActiveTags();

  const meta = document.getElementById("wiki-tier-meta");
  if (meta) {
    const sup = tier.supplement_count || 0;
    meta.innerHTML = `
      <span class="wiki-tier-threshold">${escapeHtml(tier.threshold)}</span>
      <span class="wiki-tier-platform">${escapeHtml(tier.platform)}</span>
      <span class="wiki-tier-stat">全库 ${formatWikiCount(tier.count)} 首 · 筛选后 ${formatWikiCount(filtered.length)} 首 · KAITO ${formatWikiCount(tier.kaito_count || 0)} 首${sup ? ` · 本地补充 ${sup}` : ""}</span>`;
  }

  const tbody = document.getElementById("wiki-song-tbody");
  if (tbody) {
    if (!pageSongs.length) {
      tbody.innerHTML = `<tr><td colspan="7" class="wiki-empty">没有匹配的曲目，请调整筛选条件</td></tr>`;
    } else {
      tbody.innerHTML = pageSongs
        .map((song) => {
          const vocalists = song.vocalists || [];
          const link = song.url
            ? `<a href="${song.url}" target="_blank" rel="noopener">${escapeHtml(song.name)}</a>`
            : escapeHtml(song.name);
          const dates = [
            song.publish_date ? `投稿 ${escapeHtml(song.publish_date)}` : "",
            song.achieve_date ? `达成 ${escapeHtml(song.achieve_date)}` : "",
          ]
            .filter(Boolean)
            .join("<br/>");
          const playBtn =
            typeof versePlayButtonHTML === "function"
              ? versePlayButtonHTML({ name: song.name, url: song.url, platform: song.platform })
              : "";
          const focusTitle = (typeof VerseLink !== "undefined" && VerseLink.focusTitle) || "";
          const isLinked =
            focusTitle &&
            (song.name || "").trim().toLowerCase() === focusTitle.trim().toLowerCase();
          return `
            <tr class="${isLinked ? "wiki-row-linked" : ""}" data-song-name="${escapeHtml(song.name)}">
              <td class="wiki-col-play">${playBtn || "—"}</td>
              <td><div class="wiki-table-colorbar" style="${buildColorBarStyle(vocalists)}" title="${escapeHtml(vocalists.map((v) => v.name).join("、"))}"></div></td>
              <td class="wiki-table-name">${link}</td>
              <td>${escapeHtml(formatProducer(song.producer))}</td>
              <td><div class="wiki-table-tags">${renderVocalistTags(vocalists)}</div></td>
              <td class="wiki-table-dates">${dates || "—"}</td>
              <td><span class="wiki-source-badge wiki-source-${song.source === "voca.wiki" ? "wiki" : "local"}">${sourceLabel(song)}</span></td>
            </tr>`;
        })
        .join("");

      tbody.querySelectorAll(".wiki-song-tag").forEach((tag) => {
        tag.addEventListener("click", (e) => {
          e.stopPropagation();
          toggleVocalistTag(tag.dataset.vocalist);
        });
      });
      if (typeof bindVersePlayButtons === "function") bindVersePlayButtons(tbody);
    }
  }

  renderPagination(totalPages);
}

function syncLegendActiveState() {
  document.querySelectorAll(".wiki-legend-chip").forEach((chip) => {
    const name = chip.dataset.vocalist;
    const active =
      wikiMilestoneState.vocalists.has(name) ||
      (!wikiMilestoneState.vocalists.size && name === wikiMilestoneState.focusVocalist);
    chip.classList.toggle("active", active);
  });
}

function renderActiveTags() {
  const box = document.getElementById("wiki-active-tags");
  if (!box) return;
  if (!wikiMilestoneState.vocalists.size) {
    box.innerHTML = `<span class="wiki-tags-empty">当前未选择角色标签 — 显示全部曲目</span>`;
    return;
  }
  box.innerHTML = [...wikiMilestoneState.vocalists]
    .map(
      (name) =>
        `<span class="wiki-active-tag">${escapeHtml(name)} <button type="button" data-vocalist="${escapeHtml(name)}" aria-label="移除">×</button></span>`
    )
    .join("");
  box.querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", () => toggleVocalistTag(btn.dataset.vocalist));
  });
}

function applyMilestoneTierTheme(tierId) {
  const section = document.getElementById("milestones");
  if (!section) return;
  section.dataset.activeTier = tierId || "hall";
  section.classList.remove("wiki-tier-flash");
  void section.offsetWidth;
  section.classList.add("wiki-tier-flash");
  section.style.setProperty("--wiki-tier-accent", WIKI_TIER_ACCENT[tierId] || WIKI_TIER_ACCENT.hall);
}

function rollWikiMetricValue(el, from, to, duration = 520) {
  const start = performance.now();
  function frame(now) {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - (1 - t) ** 3;
    el.textContent = formatWikiCount(Math.round(from + (to - from) * eased));
    if (t < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

function renderMetrics(tier, allSongs, filtered) {
  const box = document.getElementById("wiki-viz-metrics");
  if (!box) return;
  const kaitoInView = filtered.filter((s) => s.involves_kaito).length;
  const soloKaito = filtered.filter(
    (s) => s.involves_kaito && (s.vocalists || []).length === 1 && s.vocalists[0].name === "KAITO"
  ).length;
  const cards = [
    { label: "当前等级曲目", raw: allSongs.length, sub: tier.label },
    { label: "筛选结果", raw: filtered.length, sub: "符合标签/搜索" },
    { label: "KAITO 相关", raw: kaitoInView, sub: `独唱 ${soloKaito} · 合唱 ${kaitoInView - soloKaito}` },
    { label: "涉及角色数", raw: computeVocalistStats(filtered).length, sub: "单人标签统计" },
  ];

  const accent = WIKI_TIER_ACCENT[tier.id] || WIKI_TIER_ACCENT.hall;
  const animate = wikiMilestoneState.tierSwitchAnim && wikiMilestoneState.lastMetricValues;
  wikiMilestoneState.tierSwitchAnim = false;

  box.innerHTML = cards
    .map(
      (c, i) => `
      <div class="wiki-metric-card${animate ? " wiki-metric-card--roll" : ""}" style="--wiki-tier-accent:${accent}; animation-delay:${i * 60}ms">
        <div class="wiki-metric-label">${c.label}</div>
        <div class="wiki-metric-value" data-metric-idx="${i}">${formatWikiCount(c.raw)}</div>
        <div class="wiki-metric-sub">${c.sub}</div>
      </div>`
    )
    .join("");

  if (animate) {
    cards.forEach((c, i) => {
      const el = box.querySelector(`[data-metric-idx="${i}"]`);
      const prev = wikiMilestoneState.lastMetricValues[i];
      if (el && typeof prev === "number") rollWikiMetricValue(el, prev, c.raw);
    });
  }

  wikiMilestoneState.lastMetricValues = cards.map((c) => c.raw);

  const hero = document.querySelector("#milestones .wiki-viz-hero");
  if (hero && animate) {
    hero.classList.remove("wiki-viz-hero--pulse");
    void hero.offsetWidth;
    hero.classList.add("wiki-viz-hero--pulse");
  }
}

function renderPagination(totalPages) {
  const pagination = document.getElementById("wiki-pagination");
  if (!pagination) return;
  pagination.innerHTML = `
    <button type="button" id="wiki-prev" ${wikiMilestoneState.page <= 1 ? "disabled" : ""}>上一页</button>
    <span>第 ${wikiMilestoneState.page} / ${totalPages} 页 · 每页 ${WIKI_MILESTONE_PAGE_SIZE} 首</span>
    <button type="button" id="wiki-next" ${wikiMilestoneState.page >= totalPages ? "disabled" : ""}>下一页</button>`;

  document.getElementById("wiki-prev")?.addEventListener("click", () => {
    if (wikiMilestoneState.page > 1) {
      wikiMilestoneState.page -= 1;
      renderWikiMilestoneView();
    }
  });
  document.getElementById("wiki-next")?.addEventListener("click", () => {
    if (wikiMilestoneState.page < totalPages) {
      wikiMilestoneState.page += 1;
      renderWikiMilestoneView();
    }
  });
}

function resizeWikiMilestoneCharts() {
  if (typeof resizeMilestoneViz === "function") resizeMilestoneViz();
}

function formatWikiCount(num) {
  return Number(num || 0).toLocaleString("zh-CN");
}

function switchMilestoneTierForTrack(track) {
  if (!track?.tierId || typeof wikiMilestoneState === "undefined") return false;
  if (wikiMilestoneState.tierId === track.tierId) return false;
  wikiMilestoneState.tierId = track.tierId;
  document.querySelectorAll(".wiki-tier-tab").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tier === track.tierId);
  });
  if (typeof applyMilestoneTierTheme === "function") applyMilestoneTierTheme(track.tierId);
  return true;
}

function flashLinkedMilestoneRow() {
  requestAnimationFrame(() => {
    const row = document.querySelector("#wiki-song-tbody tr.wiki-row-linked");
    if (!row) return;
    row.classList.add("wiki-row-flash");
    row.addEventListener("animationend", () => row.classList.remove("wiki-row-flash"), { once: true });
  });
}

function bindVerseTrackFocusToMilestones() {
  if (bindVerseTrackFocusToMilestones.bound) return;
  bindVerseTrackFocusToMilestones.bound = true;
  window.addEventListener("verse-track-focus", (e) => {
    const switched = switchMilestoneTierForTrack(e.detail?.track);
    if (switched && typeof renderWikiMilestoneView === "function") renderWikiMilestoneView();
    flashLinkedMilestoneRow();
  });
}
