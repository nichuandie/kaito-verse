/**
 * KAITO 合作网络 — 课程级可视化
 * 力导向 / 辐射布局、桑基流向图、检索高亮、动态 Top-N 过滤
 */
const NETWORK_COLORS = [
  "#00e5ff", // 中心
  "#ff4d8d", // Crypton
  "#3d9eff", // Vocaloid
  "#b47aff", // UTAU
  "#ffc857", // 中文
  "#6b8fa8", // 聚合
];

const NETWORK_GLOW = [
  "rgba(0,229,255,0.75)",
  "rgba(255,77,141,0.55)",
  "rgba(61,158,255,0.5)",
  "rgba(180,122,255,0.5)",
  "rgba(255,200,87,0.45)",
  "rgba(107,143,168,0.4)",
];

let networkState = {
  chart: null,
  sankeyChart: null,
  rawData: null,
  layout: "force",
  topN: 25,
  minCount: 3,
  highlighted: null,
};

function initNetworkChart(graphData) {
  const placeholder = document.getElementById("network-placeholder");
  const panel = document.getElementById("network-panel");
  if (!graphData || !graphData.nodes?.length) return [];

  networkState.rawData = graphData;
  placeholder.style.display = "none";
  panel.style.display = "block";

  bindNetworkControls();
  updateNetworkMetrics(graphData);

  const graphChart = renderGraphChart();
  const sankeyChart = renderSankeyChart(graphData);

  networkState.chart = graphChart;
  networkState.sankeyChart = sankeyChart;
  updateRankingList();

  return [graphChart, sankeyChart].filter(Boolean);
}

function getFilteredGraph() {
  const { rawData, topN, minCount } = networkState;
  const center = rawData.center;
  const partners = rawData.nodes
    .filter((node) => node.id !== center && node.value >= minCount)
    .sort((a, b) => b.value - a.value)
    .slice(0, topN);

  const nodes = [rawData.nodes.find((node) => node.id === center), ...partners].filter(Boolean);
  const ids = new Set(nodes.map((node) => node.id));
  const links = rawData.links.filter(
    (link) => ids.has(link.source) && ids.has(link.target) && link.value >= minCount
  );

  return { nodes, links, categories: rawData.categories };
}

function applyRadialLayout(nodes, links, width, height) {
  const center = nodes.find((node) => node.category === 0) || nodes[0];
  const others = nodes.filter((node) => node.id !== center.id).sort((a, b) => b.value - a.value);
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) * 0.34;

  center.x = cx;
  center.y = cy;
  center.fixed = true;

  others.forEach((node, index) => {
    const angle = (Math.PI * 2 * index) / others.length - Math.PI / 2;
    node.x = cx + Math.cos(angle) * radius;
    node.y = cy + Math.sin(angle) * radius;
    node.fixed = true;
  });

  return { nodes, links };
}

function renderGraphChart() {
  const dom = document.getElementById("chart-network");
  if (!dom) return null;

  const chart = echarts.init(dom);
  const filtered = getFilteredGraph();
  const isRadial = networkState.layout === "radial";
  const { width, height } = dom.getBoundingClientRect();

  let graphNodes = filtered.nodes.map((node) => {
    const cat = node.category ?? 2;
    const isCenter = cat === 0;
    return {
      ...node,
      symbolSize: isCenter ? Math.max(node.symbolSize || 52, 58) : node.symbolSize,
      itemStyle: {
        color: {
          type: "radial",
          x: 0.35,
          y: 0.35,
          r: 0.9,
          colorStops: [
            { offset: 0, color: "#ffffff" },
            { offset: 0.35, color: NETWORK_COLORS[cat] || NETWORK_COLORS[2] },
            { offset: 1, color: "rgba(7,17,31,0.85)" },
          ],
        },
        borderColor: isCenter ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.45)",
        borderWidth: isCenter ? 2.5 : 1.5,
        shadowBlur: isCenter ? 28 : 14,
        shadowColor: NETWORK_GLOW[cat] || NETWORK_GLOW[2],
      },
      label: {
        color: isCenter ? "#ffffff" : "#c8e8f4",
        fontSize: isCenter ? 13 : 11,
        fontWeight: isCenter ? 700 : 500,
        textBorderColor: "rgba(7,17,31,0.85)",
        textBorderWidth: 2,
      },
    };
  });
  let graphLinks = filtered.links.map((link) => ({ ...link }));

  if (isRadial) {
    const laid = applyRadialLayout(graphNodes, graphLinks, width || 900, height || 520);
    graphNodes = laid.nodes;
    graphLinks = laid.links;
  } else {
    graphNodes.forEach((node) => {
      delete node.x;
      delete node.y;
      delete node.fixed;
    });
  }

  const categories = filtered.categories.map((item, index) => ({
    name: item.name,
    itemStyle: { color: NETWORK_COLORS[index] || NETWORK_COLORS[2] },
  }));

  chart.setOption({
    backgroundColor: "transparent",
    animationDuration: 900,
    animationEasingUpdate: "cubicInOut",
    tooltip: {
      trigger: "item",
      backgroundColor: "rgba(4,12,24,0.94)",
      borderColor: "rgba(0,229,255,0.45)",
      borderWidth: 1,
      extraCssText: "box-shadow: 0 0 20px rgba(0,229,255,0.15); backdrop-filter: blur(6px);",
      textStyle: { color: "#e8f4f8", fontSize: 12 },
      formatter(params) {
        if (params.dataType === "edge") {
          const pct = networkState.rawData.total_collaborations
            ? ((params.data.value / networkState.rawData.total_collaborations) * 100).toFixed(1)
            : 0;
          return `<strong>${params.data.source} → ${params.data.target}</strong><br/>
                  合作曲目：<b>${params.data.value}</b> 首<br/>
                  占全部合作：<b>${pct}%</b>`;
        }
        const share = params.data.share ?? 0;
        return `<strong>${params.data.name}</strong><br/>
                合作曲目：<b>${params.data.value}</b> 首<br/>
                占比：<b>${share}%</b>`;
      },
    },
    legend: {
      data: categories.map((item) => item.name),
      textStyle: { color: "#7a9bb0", fontSize: 11 },
      top: 4,
      left: "center",
      itemGap: 14,
      icon: "circle",
    },
    series: [
      {
        type: "graph",
        layout: isRadial ? "none" : "force",
        data: graphNodes,
        links: graphLinks.map((link) => {
          const w = Math.max(1.4, (link.lineWidth || link.value ** 0.35) * 0.62);
          return {
            ...link,
            lineStyle: {
              width: w,
              curveness: isRadial ? 0.24 : 0.14,
              opacity: 0.55,
              shadowBlur: Math.min(12, w * 2),
              shadowColor: "rgba(0,229,255,0.35)",
              color: {
                type: "linear",
                x: 0,
                y: 0,
                x2: 1,
                y2: 0,
                colorStops: [
                  { offset: 0, color: "rgba(0,229,255,0.9)" },
                  { offset: 0.5, color: "rgba(72,202,228,0.55)" },
                  { offset: 1, color: "rgba(180,122,255,0.25)" },
                ],
              },
            },
          };
        }),
        categories,
        roam: true,
        draggable: !isRadial,
        zoom: 1,
        label: {
          show: true,
          position: "right",
          formatter: (params) => (params.data.category === 0 ? "◆ KAITO" : params.data.name),
        },
        emphasis: {
          focus: "adjacency",
          scale: 1.2,
          lineStyle: {
            width: 8,
            opacity: 0.95,
            shadowBlur: 16,
            shadowColor: "rgba(0,229,255,0.65)",
          },
          itemStyle: {
            shadowBlur: 32,
            shadowColor: "rgba(0,229,255,0.75)",
            borderWidth: 3,
            borderColor: "#fff",
          },
        },
        force: isRadial
          ? undefined
          : {
              repulsion: 340,
              gravity: 0.1,
              edgeLength: [100, 220],
              friction: 0.38,
              layoutAnimation: true,
            },
      },
    ],
  });

  chart.on("click", (params) => {
    if (params.dataType === "node") {
      showNodeDetail(params.data);
      highlightNode(params.data.id);
      if (typeof setVerseFilter === "function" && params.data.category !== 0) {
        setVerseFilter(
          { vocalist: params.data.name, producer: null, songKeyword: null },
          "network"
        );
      }
    }
  });

  return chart;
}

function renderSankeyChart(graphData) {
  const dom = document.getElementById("chart-sankey");
  if (!dom || !graphData.sankey) return null;

  const chart = echarts.init(dom);
  const topLinks = [...graphData.sankey.links]
    .sort((a, b) => b.value - a.value)
    .slice(0, 12);
  const names = new Set(["KAITO", ...topLinks.map((link) => link.target)]);
  const nodes = graphData.sankey.nodes.filter((node) => names.has(node.name));

  chart.setOption({
    backgroundColor: "transparent",
    title: {
      text: "合作流量桑基图（Top 12）",
      left: 8,
      top: 4,
      textStyle: { color: "#e8f4f8", fontSize: 13, fontWeight: 600 },
    },
    tooltip: {
      trigger: "item",
      backgroundColor: "rgba(7,17,31,0.92)",
      borderColor: "rgba(72,202,228,0.35)",
      formatter: (params) => {
        if (params.dataType === "edge") {
          return `${params.data.source} → ${params.data.target}<br/>${params.data.value} 首`;
        }
        return params.name;
      },
    },
    series: [
      {
        type: "sankey",
        layout: "none",
        emphasis: { focus: "adjacency" },
        nodeAlign: "left",
        nodeGap: 10,
        draggable: false,
        data: nodes,
        links: topLinks,
        lineStyle: { color: "gradient", curveness: 0.5, opacity: 0.42 },
        itemStyle: { borderWidth: 0 },
        label: { color: "#c8dde8", fontSize: 11 },
        levels: [
          {
            depth: 0,
            itemStyle: { color: "#00d4ff" },
          },
          {
            depth: 1,
            itemStyle: { color: "#48cae4" },
          },
        ],
      },
    ],
  });

  return chart;
}

function bindNetworkControls() {
  const topSlider = document.getElementById("network-topn");
  const minSlider = document.getElementById("network-min");
  const searchInput = document.getElementById("network-search");
  const layoutSelect = document.getElementById("network-layout");
  const resetBtn = document.getElementById("network-reset");

  if (topSlider) {
    topSlider.addEventListener("input", () => {
      networkState.topN = Number(topSlider.value);
      document.getElementById("network-topn-label").textContent = networkState.topN;
      refreshNetworkCharts();
    });
  }

  if (minSlider) {
    minSlider.addEventListener("input", () => {
      networkState.minCount = Number(minSlider.value);
      document.getElementById("network-min-label").textContent = networkState.minCount;
      refreshNetworkCharts();
    });
  }

  if (searchInput) {
    searchInput.addEventListener("input", () => {
      highlightNode(searchInput.value.trim());
    });
  }

  if (layoutSelect) {
    layoutSelect.addEventListener("change", () => {
      networkState.layout = layoutSelect.value;
      refreshNetworkCharts();
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      networkState.topN = 25;
      networkState.minCount = 3;
      networkState.layout = "force";
      networkState.highlighted = null;
      if (topSlider) topSlider.value = "25";
      if (minSlider) minSlider.value = "3";
      if (layoutSelect) layoutSelect.value = "force";
      if (searchInput) searchInput.value = "";
      document.getElementById("network-topn-label").textContent = "25";
      document.getElementById("network-min-label").textContent = "3";
      showNodeDetail(null);
      refreshNetworkCharts();
    });
  }
}

function refreshNetworkCharts() {
  if (networkState.chart) {
    networkState.chart.dispose();
    networkState.chart = renderGraphChart();
  }
  updateRankingList();
}

function highlightNode(keyword) {
  if (!networkState.chart || !keyword) {
    networkState.chart?.dispatchAction({ type: "downplay", seriesIndex: 0 });
    return;
  }

  const filtered = getFilteredGraph();
  const match = filtered.nodes.find((node) => node.name.includes(keyword));
  if (!match) {
    networkState.chart.dispatchAction({ type: "downplay", seriesIndex: 0 });
    return;
  }

  networkState.chart.dispatchAction({ type: "downplay", seriesIndex: 0 });
  networkState.chart.dispatchAction({
    type: "highlight",
    seriesIndex: 0,
    name: match.name,
  });
  showNodeDetail(match);
}

function showNodeDetail(node) {
  const panel = document.getElementById("network-detail");
  if (!panel) return;

  if (!node) {
    panel.innerHTML = `
      <h4 class="network-tools-title">节点详情</h4>
      <p class="network-detail-empty">点击节点或搜索歌姬名，查看合作详情</p>`;
    return;
  }

  const total = networkState.rawData.total_collaborations || 1;
  panel.innerHTML = `
    <h4 class="network-tools-title">节点详情</h4>
    <h4 class="network-node-name">${escapeHtml(node.name)}</h4>
    <dl class="network-detail-list">
      <div><dt>合作曲目</dt><dd>${formatNetworkNum(node.value)} 首</dd></div>
      <div><dt>占全部合作</dt><dd>${((node.value / total) * 100).toFixed(2)}%</dd></div>
      <div><dt>节点类型</dt><dd>${escapeHtml(networkState.rawData.categories[node.category]?.name || "—")}</dd></div>
    </dl>`;
}

function updateNetworkMetrics(graphData) {
  const el = document.getElementById("network-metrics");
  if (!el) return;

  const top = graphData.ranking?.[0];
  el.innerHTML = `
    <div class="metric-pill"><span>合作者总数</span><strong>${formatNetworkNum(graphData.total_collaborators)}</strong></div>
    <div class="metric-pill"><span>合作记录</span><strong>${formatNetworkNum(graphData.total_collaborations)}</strong></div>
    <div class="metric-pill"><span>最高频合作</span><strong>${top ? escapeHtml(top.name) : "—"}</strong></div>
    <div class="metric-pill"><span>最高合作量</span><strong>${top ? formatNetworkNum(top.value) : "—"}</strong></div>`;
}

function updateRankingList() {
  const list = document.getElementById("network-ranking");
  if (!list || !networkState.rawData?.ranking) return;

  const filtered = getFilteredGraph();
  const visible = new Set(filtered.nodes.map((node) => node.id));
  const rows = networkState.rawData.ranking
    .filter((item) => visible.has(item.name))
    .slice(0, 10);

  list.innerHTML = rows
    .map(
      (item, index) => `
      <div class="rank-row">
        <span class="rank-no">${index + 1}</span>
        <span class="rank-name">${escapeHtml(item.name)}</span>
        <span class="rank-val">${formatNetworkNum(item.value)}</span>
      </div>`
    )
    .join("");
}

function formatNetworkNum(num) {
  return Number(num).toLocaleString("zh-CN");
}
