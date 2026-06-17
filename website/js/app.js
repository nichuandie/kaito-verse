const PAGE_SIZE = 10;
let overview = null;
let graphData = null;
let milestones = null;
let allSongs = [];
let filteredSongs = [];
let currentPage = 1;
let chartInstances = [];

async function loadData() {
  if (window.location.protocol === "file:") {
    throw new Error("FILE_PROTOCOL");
  }

  let overviewRes;
  let songsRes;
  let graphRes;
  let milestonesRes;

  try {
    [overviewRes, songsRes, graphRes, milestonesRes] = await Promise.all([
      fetchSite("./data/overview.json"),
      fetchSite("./data/songs_light.json"),
      fetchSite("./data/graph.json"),
      fetchSite("./data/wiki_milestones.json"),
    ]);
  } catch (err) {
    throw new Error("NETWORK_ERROR");
  }

  if (!overviewRes.ok || !songsRes.ok) {
    if (overviewRes.status === 404 || songsRes.status === 404) {
      throw new Error("DATA_MISSING");
    }
    throw new Error("HTTP_ERROR");
  }

  overview = await overviewRes.json();
  allSongs = await songsRes.json();
  filteredSongs = allSongs;
  graphData = graphRes.ok ? await graphRes.json() : null;
  milestones = milestonesRes.ok ? await milestonesRes.json() : null;
}

function formatNumber(num) {
  return Number(num).toLocaleString("zh-CN");
}

function renderShell() {
  const app = document.getElementById("app");
  app.innerHTML = `
    <section id="overview">
      <h2 class="section-title">数据概览</h2>
      <div class="stats-grid" id="stats-grid"></div>
    </section>

    <section id="charts">
      <h2 class="section-title">趋势分析</h2>
      <p class="section-desc">基于 VocaDB 收录的 KAITO 相关曲目统计</p>
      <div class="charts-grid">
        <div class="chart-panel span-8">
          <div id="chart-yearly" class="chart-box"></div>
        </div>
        <div class="chart-panel span-4">
          <div id="chart-types" class="chart-box"></div>
        </div>
        <div class="chart-panel span-6 producer-bipartite-panel">
          <div class="producer-bipartite-toolbar">
            <label class="producer-bip-control">Top-N
              <span id="producer-bip-topn-label">12</span>
              <input type="range" id="producer-bip-topn" min="6" max="18" value="12" />
            </label>
          </div>
          <div id="chart-producer-bipartite" class="chart-box chart-box-rank producer-bipartite-chart"></div>
        </div>
        <div class="chart-panel span-6">
          <div id="chart-collab" class="chart-box chart-box-rank"></div>
        </div>
        <div class="chart-panel span-6">
          <div id="chart-pv" class="chart-box chart-box-half"></div>
        </div>
        <div class="chart-panel span-6">
          <div id="chart-voicebank" class="chart-box chart-box-voicebank chart-box-half"></div>
        </div>
      </div>
    </section>

    <section id="network">
      <h2 class="section-title">合作网络分析</h2>
      <p class="section-desc">
        星型网络模型：KAITO 为中心节点，连线粗细与节点大小映射合作频次；支持力导向 / 辐射布局切换与桑基流向图
      </p>
      <div class="placeholder-panel" id="network-placeholder">
        <strong>合作网络图 · 待生成</strong>
        <span>请先运行 python generate_relations.py</span>
      </div>
      <div class="network-dashboard" id="network-panel" style="display:none">
        <div class="network-metrics" id="network-metrics"></div>
        <div class="network-charts-row">
          <div class="chart-panel network-graph-panel">
            <div id="chart-network" class="chart-box network-main-chart"></div>
          </div>
          <div class="chart-panel network-sankey-panel">
            <div id="chart-sankey" class="chart-box network-sankey-chart"></div>
          </div>
        </div>
        <div class="network-tools-row">
          <div class="network-controls">
            <h4 class="network-tools-title">视图控制</h4>
            <label>显示 Top-N 合作者 <span id="network-topn-label">25</span>
              <input type="range" id="network-topn" min="8" max="50" value="25" />
            </label>
            <label>最低合作次数 <span id="network-min-label">3</span>
              <input type="range" id="network-min" min="3" max="50" value="3" />
            </label>
            <label>布局模式
              <select id="network-layout">
                <option value="force">力导向布局</option>
                <option value="radial">辐射环形布局</option>
              </select>
            </label>
            <label>检索节点
              <input type="search" id="network-search" placeholder="输入歌姬名…" />
            </label>
            <button type="button" id="network-reset" class="network-btn">重置视图</button>
          </div>
          <div class="network-detail" id="network-detail">
            <h4 class="network-tools-title">节点详情</h4>
            <p class="network-detail-empty">点击节点或搜索歌姬名，查看合作详情</p>
          </div>
          <div class="network-ranking-wrap">
            <h4 class="network-tools-title">合作频次 Top 10</h4>
            <div class="network-ranking" id="network-ranking"></div>
          </div>
        </div>
      </div>
    </section>

    <section id="songs">
      <h2 class="section-title">歌曲检索</h2>
      <p class="section-desc">支持曲名 / P主搜索，点击曲名跳转 VocaDB</p>
      <div class="table-tools">
        <input type="search" id="search-input" placeholder="搜索曲名或 P主…" />
        <select id="type-filter">
          <option value="">全部类型</option>
        </select>
        <select id="solo-filter">
          <option value="">独唱 / 合唱</option>
          <option value="solo">仅 KAITO 独唱</option>
          <option value="collab">合唱曲</option>
        </select>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>曲名</th>
              <th>P主</th>
              <th>发布日期</th>
              <th>类型</th>
              <th>评分</th>
            </tr>
          </thead>
          <tbody id="song-tbody"></tbody>
        </table>
      </div>
      <div class="table-footer">
        <span id="table-info"></span>
        <button id="prev-page" style="margin-left:1rem;background:none;border:1px solid var(--border);color:var(--ice);padding:0.3rem 0.8rem;border-radius:6px;cursor:pointer">上一页</button>
        <button id="next-page" style="margin-left:0.5rem;background:none;border:1px solid var(--border);color:var(--ice);padding:0.3rem 0.8rem;border-radius:6px;cursor:pointer">下一页</button>
      </div>
    </section>
  `;
}

function renderStats() {
  const grid = document.getElementById("stats-grid");
  const cards = [
    {
      label: "收录曲目",
      value: formatNumber(overview.total_songs),
      sub: "VocaDB · KAITO 曲库",
    },
    {
      label: "KAITO 独唱",
      value: formatNumber(overview.solo_songs),
      sub: `占比 ${((overview.solo_songs / overview.total_songs) * 100).toFixed(1)}%`,
    },
    {
      label: "合作曲目",
      value: formatNumber(overview.collab_songs),
      sub: `${formatNumber(overview.unique_collaborators)} 位合作歌姬`,
    },
    {
      label: "P主数量",
      value: formatNumber(overview.unique_producers),
      sub: `年份跨度 ${overview.year_range[0]} – ${overview.year_range[1]}`,
    },
  ];

  grid.innerHTML = cards
    .map(
      (card) => `
      <div class="stat-card">
        <div class="stat-label">${card.label}</div>
        <div class="stat-value">${card.value}</div>
        <div class="stat-sub">${card.sub}</div>
      </div>`
    )
    .join("");
}

function baseChartOption() {
  return {
    backgroundColor: "transparent",
    textStyle: { color: "#8ba3b8", fontFamily: "Noto Sans SC, sans-serif" },
    grid: { left: 48, right: 24, top: 40, bottom: 32, containLabel: true },
  };
}

function initYearlyChart() {
  const dom = document.getElementById("chart-yearly");
  if (!dom || typeof echarts === "undefined") return;
  const chart = echarts.init(dom);
  chartInstances.push(chart);

  chart.setOption({
    ...baseChartOption(),
    title: { text: "历年作品数量", left: 8, textStyle: { color: "#e8f4f8", fontSize: 14 } },
    tooltip: { trigger: "axis" },
    xAxis: {
      type: "category",
      data: overview.yearly.map((item) => item.year),
      axisLine: { lineStyle: { color: "#2a4a62" } },
      axisLabel: { color: "#8ba3b8" },
    },
    yAxis: {
      type: "value",
      splitLine: { lineStyle: { color: "rgba(72,202,228,0.08)" } },
      axisLabel: { color: "#8ba3b8" },
    },
    series: [
      {
        name: "曲目数",
        type: "line",
        smooth: true,
        symbol: "circle",
        symbolSize: 6,
        data: overview.yearly.map((item) => item.count),
        lineStyle: { color: "#48cae4", width: 2 },
        itemStyle: { color: "#48cae4" },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: "rgba(72,202,228,0.35)" },
            { offset: 1, color: "rgba(72,202,228,0.02)" },
          ]),
        },
      },
    ],
  });
}

function initTypeChart() {
  const dom = document.getElementById("chart-types");
  if (!dom || typeof echarts === "undefined") return;
  const chart = echarts.init(dom);
  chartInstances.push(chart);

  const data = overview.song_types.filter((item) => item.value > 0);

  chart.setOption({
    ...baseChartOption(),
    title: { text: "曲目类型分布", left: 8, textStyle: { color: "#e8f4f8", fontSize: 14 } },
    tooltip: { trigger: "item", formatter: "{b}: {c} ({d}%)" },
    legend: {
      orient: "vertical",
      right: 8,
      top: "center",
      textStyle: { color: "#8ba3b8", fontSize: 11 },
    },
    series: [
      {
        type: "pie",
        radius: ["42%", "68%"],
        center: ["38%", "55%"],
        data,
        label: { show: false },
        itemStyle: {
          borderRadius: 4,
          borderColor: "#0f2137",
          borderWidth: 2,
        },
        color: ["#48cae4", "#0077b6", "#90e0ef", "#2a9db8", "#ade8f4", "#5390d9"],
      },
    ],
  });
}

function initRankBarChart(domId, title, data, unit = "首") {
  const dom = document.getElementById(domId);
  if (!dom || typeof echarts === "undefined") return;
  const chart = echarts.init(dom);
  chartInstances.push(chart);

  const sorted = [...data].sort((a, b) => a.value - b.value);
  const names = sorted.map((item) => item.name);
  const values = sorted.map((item) => item.value);
  const maxVal = values[values.length - 1] || 1;

  chart.setOption({
    ...baseChartOption(),
    title: {
      text: title,
      subtext: `共 ${formatNumber(data.reduce((sum, item) => sum + item.value, 0))} ${unit}（Top ${data.length}）`,
      left: 8,
      textStyle: { color: "#e8f4f8", fontSize: 14, fontWeight: 600 },
      subtextStyle: { color: "#8ba3b8", fontSize: 11 },
    },
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      formatter(params) {
        const item = params[0];
        const pct = ((item.value / maxVal) * 100).toFixed(1);
        return `<strong>${item.name}</strong><br/>${formatNumber(item.value)} ${unit}<br/>相对最高：${pct}%`;
      },
    },
    grid: { left: 12, right: 48, top: 52, bottom: 12, containLabel: true },
    xAxis: {
      type: "value",
      splitLine: { lineStyle: { color: "rgba(72,202,228,0.08)" } },
      axisLabel: { color: "#8ba3b8", formatter: (v) => formatNumber(v) },
    },
    yAxis: {
      type: "category",
      data: names,
      axisLine: { lineStyle: { color: "#2a4a62" } },
      axisLabel: { color: "#c8dde8", fontSize: 11, width: 110, overflow: "truncate" },
    },
    series: [
      {
        type: "bar",
        data: values,
        barMaxWidth: 18,
        label: {
          show: true,
          position: "right",
          color: "#90e0ef",
          fontSize: 11,
          formatter: (params) => formatNumber(params.value),
        },
        itemStyle: {
          borderRadius: [0, 6, 6, 0],
          color: (params) =>
            new echarts.graphic.LinearGradient(0, 0, 1, 0, [
              { offset: 0, color: "#0077b6" },
              { offset: 1, color: params.dataIndex >= names.length - 3 ? "#00d4ff" : "#48cae4" },
            ]),
        },
        emphasis: {
          itemStyle: { shadowBlur: 12, shadowColor: "rgba(0,212,255,0.45)" },
        },
      },
    ],
  });
}

function initPvChart() {
  const data = overview.pv_services?.filter((item) => item.value > 0) || [];
  if (!data.length) return;

  const dom = document.getElementById("chart-pv");
  if (!dom || typeof echarts === "undefined") return;
  const chart = echarts.init(dom);
  chartInstances.push(chart);

  chart.setOption({
    ...baseChartOption(),
    title: {
      text: "PV 发布平台分布",
      subtext: "统计含对应平台链接的曲目数量",
      left: 8,
      textStyle: { color: "#e8f4f8", fontSize: 14 },
      subtextStyle: { color: "#8ba3b8", fontSize: 11 },
    },
    tooltip: { trigger: "axis" },
    grid: { left: 44, right: 16, top: 52, bottom: 36, containLabel: true },
    xAxis: {
      type: "category",
      data: data.map((item) => item.name),
      axisLabel: { color: "#8ba3b8", rotate: 28, fontSize: 10 },
      axisLine: { lineStyle: { color: "#2a4a62" } },
    },
    yAxis: {
      type: "value",
      splitLine: { lineStyle: { color: "rgba(72,202,228,0.08)" } },
      axisLabel: { color: "#8ba3b8" },
    },
    series: [
      {
        type: "bar",
        data: data.map((item) => item.value),
        barMaxWidth: 32,
        label: { show: true, position: "top", color: "#90e0ef", fontSize: 11 },
        itemStyle: {
          borderRadius: [6, 6, 0, 0],
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: "#48cae4" },
            { offset: 1, color: "#0077b6" },
          ]),
        },
      },
    ],
  });
}

function populateTypeFilter() {
  const select = document.getElementById("type-filter");
  const types = [...new Set(allSongs.map((song) => song.type).filter(Boolean))].sort();
  types.forEach((type) => {
    const option = document.createElement("option");
    option.value = type;
    option.textContent = type;
    select.appendChild(option);
  });
}

function applyFilters(fromVerseFilter) {
  const keyword = document.getElementById("search-input").value.trim().toLowerCase();
  const type = document.getElementById("type-filter").value;
  const solo = document.getElementById("solo-filter").value;

  filteredSongs = allSongs.filter((song) => {
    const matchKeyword =
      !keyword ||
      song.name.toLowerCase().includes(keyword) ||
      song.producer.toLowerCase().includes(keyword);
    const matchType = !type || song.type === type;
    const matchSolo =
      !solo ||
      (solo === "solo" && song.solo) ||
      (solo === "collab" && !song.solo);
    const matchVerse =
      typeof songMatchesVerseFilter === "function" ? songMatchesVerseFilter(song) : true;
    return matchKeyword && matchType && matchSolo && matchVerse;
  });

  currentPage = 1;
  renderTable();
}

function renderTable() {
  const tbody = document.getElementById("song-tbody");
  const start = (currentPage - 1) * PAGE_SIZE;
  const pageSongs = filteredSongs.slice(start, start + PAGE_SIZE);

  tbody.innerHTML = pageSongs
    .map(
      (song) => `
      <tr>
        <td>
          <a href="${song.url}" target="_blank" rel="noopener">${escapeHtml(song.name)}</a>
          ${song.solo ? '<span class="tag solo">独唱</span>' : '<span class="tag">合唱</span>'}
        </td>
        <td>${escapeHtml(song.producer || "—")}</td>
        <td>${song.date || "—"}</td>
        <td>${song.type || "—"}</td>
        <td>${song.rating || 0}</td>
      </tr>`
    )
    .join("");

  const totalPages = Math.max(1, Math.ceil(filteredSongs.length / PAGE_SIZE));
  document.getElementById("table-info").textContent =
    `共 ${formatNumber(filteredSongs.length)} 首 · 第 ${currentPage} / ${totalPages} 页`;
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function bindTableEvents() {
  document.getElementById("search-input").addEventListener("input", applyFilters);
  document.getElementById("type-filter").addEventListener("change", applyFilters);
  document.getElementById("solo-filter").addEventListener("change", applyFilters);

  document.getElementById("prev-page").addEventListener("click", () => {
    if (currentPage > 1) {
      currentPage -= 1;
      renderTable();
    }
  });

  document.getElementById("next-page").addEventListener("click", () => {
    const totalPages = Math.ceil(filteredSongs.length / PAGE_SIZE);
    if (currentPage < totalPages) {
      currentPage += 1;
      renderTable();
    }
  });
}

function onResize() {
  chartInstances.forEach((chart) => chart.resize());
  if (typeof resizeProducerBipartiteChart === "function") resizeProducerBipartiteChart();
}

function showError(code) {
  const messages = {
    FILE_PROTOCOL: {
      title: "无法通过本地文件打开",
      body: `
        <p>你正在用 <code>file://</code> 直接打开 HTML，浏览器会拦截 <code>fetch</code> 读取 JSON，因此出现 <strong>Failed to fetch</strong>。</p>
        <p><strong>请不要</strong>双击 <code>index.html</code>，也<strong>不要</strong>使用 Cursor 的 <strong>Show Preview / Live Preview</strong>（会报 Service Worker 错误）。</p>`,
    },
    NETWORK_ERROR: {
      title: "无法连接数据文件",
      body: `
        <p>请求 <code>data/*.json</code> 失败。通常是<strong>本地服务器未启动</strong>，或预览方式不正确。</p>`,
    },
    DATA_MISSING: {
      title: "数据文件不存在",
      body: `
        <p>找不到 <code>website/data/overview.json</code> 等文件，请先生成数据。</p>`,
    },
    HTTP_ERROR: {
      title: "数据加载 HTTP 错误",
      body: `<p>服务器已响应，但读取 JSON 失败。请确认 <code>website/data/</code> 下文件完整。</p>`,
    },
  };

  const info = messages[code] || {
    title: "加载失败",
    body: `<p>${escapeHtml(String(code))}</p>`,
  };

  document.getElementById("app").innerHTML = `
    <div class="error-box">
      <strong>${info.title}</strong>
      ${info.body}
      <hr style="border:none;border-top:1px solid var(--border);margin:1rem 0" />
      <p><strong>正确打开方式（任选其一）：</strong></p>
      <ol style="margin:0.5rem 0 0 1.2rem;line-height:1.8">
        <li>双击运行 <code>website/start.bat</code></li>
        <li>终端执行：<code>cd website &amp;&amp; python serve.py</code></li>
        <li>Cursor 菜单：<strong>Terminal → Run Task → KAITO Verse: 启动网站服务器</strong></li>
      </ol>
      <p style="margin-top:1rem">然后在浏览器地址栏打开：<br />
        <a href="http://127.0.0.1:8080" target="_blank" rel="noopener"><code>http://127.0.0.1:8080</code></a>
      </p>
      <p style="margin-top:0.75rem;font-size:0.85rem;color:var(--text-muted)">
        若首次运行或 CSV 有更新，请先在项目根目录执行：<code>python generate_site_data.py</code>
      </p>
    </div>
  `;
}

function initNavScrollSpy() {
  const links = [
    ...document.querySelectorAll('.site-nav a[href^="#"]:not([data-page="characters"])'),
  ];
  const observeTargets = links
    .map((a) => {
      const id = a.getAttribute("href")?.replace(/^#/, "");
      if (id === "home") return document.querySelector(".hero-showcase");
      if (!id) return null;
      return document.getElementById(id);
    })
    .filter(Boolean);
  if (!observeTargets.length || !("IntersectionObserver" in window)) return;

  const observer = new IntersectionObserver(
    (entries) => {
      if (SiteRouter.page !== "main") return;
      const visible = entries
        .filter((e) => e.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;

      const activeId =
        visible.target.id ||
        (visible.target.classList?.contains("hero-showcase") ? "home" : "");

      links.forEach((link) => {
        const id = link.getAttribute("href")?.replace(/^#/, "");
        link.classList.toggle("active", id === activeId);
        if (id === activeId) link.setAttribute("aria-current", "true");
        else link.removeAttribute("aria-current");
      });
    },
    { rootMargin: "-42% 0px -42% 0px", threshold: [0, 0.15, 0.35] }
  );
  observeTargets.forEach((section) => observer.observe(section));
}

async function init() {
  try {
    initVerseFilterBar();
    initVersePlayer();
    await loadData();
    document.getElementById("loading").remove();
    await initHeroTypography(allSongs);
    initHeroSoundwave();
    initHeroBirthdayCountdown();
    if (typeof initVerseLinkData === "function") initVerseLinkData(milestones, allSongs);
    if (typeof bindVerseLinkEvents === "function") bindVerseLinkEvents();
    await initHomeMusicPlayer({ songs: allSongs, milestones });
    if (typeof initTodayKaito === "function") initTodayKaito(milestones);
    initKaitoTimeline();
    renderShell();
    await initCharactersPage();
    renderStats();

    const chartsReady = typeof loadEchartsLib === "function" ? await loadEchartsLib() : typeof echarts !== "undefined";
    if (chartsReady) {
      initYearlyChart();
      initTypeChart();
      initRankBarChart("chart-collab", "Top 15 合作歌姬（共演次数）", overview.top_collaborators, "次");
      initPvChart();

      const producerBipChart = initProducerBipartiteChart(allSongs);
      if (producerBipChart) chartInstances.push(producerBipChart);

      const voicebankChart = initVoicebankChart(allSongs);
      if (voicebankChart) chartInstances.push(voicebankChart);

      const networkCharts = initNetworkChart(graphData);
      if (networkCharts?.length) chartInstances.push(...networkCharts);
    } else {
      document.getElementById("charts")?.insertAdjacentHTML(
        "beforeend",
        `<p class="section-desc" style="color:var(--text-muted)">图表库加载失败（网络/CDN），统计数字与歌曲列表仍可用。请刷新或稍后再试。</p>`
      );
    }

    if (milestones) {
      document.getElementById("network").insertAdjacentHTML(
        "afterend",
        renderMilestonesSection(milestones)
      );
      await initMilestonesSection(milestones);
    }

    populateTypeFilter();
    renderTable();
    bindTableEvents();
    bindVerseFilterToApp();
    bindVerseFilterToMilestones();
    bindVerseFilterToNetwork();
    initNavScrollSpy();
    initSiteRouter();
    window.addEventListener("resize", () => {
      onResize();
      if (typeof resizeWikiMilestoneCharts === "function") resizeWikiMilestoneCharts();
      if (typeof resizeHeroTypography === "function") resizeHeroTypography();
    });
  } catch (error) {
    const code =
      error.message === "FILE_PROTOCOL" ||
      error.message === "NETWORK_ERROR" ||
      error.message === "DATA_MISSING" ||
      error.message === "HTTP_ERROR"
        ? error.message
        : "NETWORK_ERROR";
    showError(code);
  }
}

init();
