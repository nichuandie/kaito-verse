/**
 * P主 × KAITO 二部图 — 创作者侧合作可视化
 */

const producerBipartiteState = {
  chart: null,
  songs: [],
  topN: 12,
};

function normalizeProducerName(name) {
  return (name || "").split(/[/／|]/)[0].trim();
}

function buildProducerCounts(songs) {
  const map = new Map();
  for (const song of songs) {
    const producer = normalizeProducerName(song.producer);
    if (!producer || producer.length < 2) continue;
    map.set(producer, (map.get(producer) || 0) + 1);
  }
  return [...map.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

function layoutProducerBipartite(producers, width, height) {
  const leftX = width * 0.2;
  const rightX = width * 0.8;
  const padY = 48;
  const usable = Math.max(height - padY * 2, 100);
  const step = producers.length > 1 ? usable / (producers.length - 1) : 0;
  const maxVal = producers[0]?.value || 1;

  const nodes = producers.map((p, i) => ({
    id: p.name,
    name: p.name,
    value: p.value,
    category: 0,
    x: leftX,
    y: padY + step * i,
    symbolSize: Math.max(10, Math.min(26, 8 + (p.value / maxVal) * 18)),
    itemStyle: {
      color: "#ffd166",
      borderColor: "rgba(255, 209, 102, 0.45)",
      borderWidth: 1,
    },
    label: {
      show: true,
      position: "left",
      fontSize: 9,
      color: "#c8dde8",
      width: 72,
      overflow: "truncate",
    },
  }));

  nodes.push({
    id: "KAITO",
    name: "KAITO",
    value: producers.reduce((s, p) => s + p.value, 0),
    category: 1,
    x: rightX,
    y: height / 2,
    symbolSize: 42,
    itemStyle: {
      color: "#0044ff",
      shadowBlur: 22,
      shadowColor: "rgba(0, 100, 255, 0.65)",
      borderColor: "#66ccff",
      borderWidth: 2,
    },
    label: {
      show: true,
      position: "right",
      fontSize: 13,
      fontWeight: 700,
      color: "#e8f4ff",
    },
  });

  const links = producers.map((p) => ({
    source: p.name,
    target: "KAITO",
    value: p.value,
    lineStyle: {
      width: Math.max(1.5, Math.min(10, 1 + (p.value / maxVal) * 9)),
      opacity: 0.35 + (p.value / maxVal) * 0.35,
      curveness: 0.12,
      color: {
        type: "linear",
        x: 0,
        y: 0,
        x2: 1,
        y2: 0,
        colorStops: [
          { offset: 0, color: "rgba(255, 209, 102, 0.55)" },
          { offset: 1, color: "rgba(0, 100, 255, 0.75)" },
        ],
      },
    },
  }));

  return { nodes, links };
}

function renderProducerBipartiteChart() {
  const dom = document.getElementById("chart-producer-bipartite");
  if (!dom || typeof echarts === "undefined") return null;

  const producers = buildProducerCounts(producerBipartiteState.songs).slice(
    0,
    producerBipartiteState.topN
  );
  if (!producers.length) return null;

  const width = dom.clientWidth || 640;
  const height = dom.clientHeight || 420;
  const { nodes, links } = layoutProducerBipartite(producers, width, height);

  if (!producerBipartiteState.chart) {
    producerBipartiteState.chart = echarts.init(dom);
  }

  const chart = producerBipartiteState.chart;
  const activeProducer =
    typeof VerseFilter !== "undefined" && VerseFilter.producer ? VerseFilter.producer : null;

  chart.setOption(
    {
      backgroundColor: "transparent",
      title: {
        text: "P主 × KAITO",
        subtext: "点击 P主 → 筛选歌曲",
        left: 8,
        top: 2,
        textStyle: { color: "#e8f4f8", fontSize: 13, fontWeight: 700 },
        subtextStyle: { color: "#8ba3b8", fontSize: 10 },
      },
      tooltip: {
        trigger: "item",
        backgroundColor: "rgba(6,14,28,0.94)",
        borderColor: "rgba(72,202,228,0.45)",
        formatter(params) {
          if (params.dataType === "edge") {
            return `<strong>${params.data.source}</strong> → KAITO<br/>${formatNumber(params.data.value)} 首`;
          }
          if (params.name === "KAITO") {
            return `<strong>KAITO</strong><br/>左侧 Top ${producers.length} P主共 ${formatNumber(
              producers.reduce((s, p) => s + p.value, 0)
            )} 首`;
          }
          return `<strong>${params.name}</strong><br/>${formatNumber(params.data.value)} 首 · 点击筛选歌曲表`;
        },
      },
      series: [
        {
          type: "graph",
          layout: "none",
          roam: true,
          draggable: true,
          categories: [{ name: "P主" }, { name: "KAITO" }],
          data: nodes.map((n) => ({
            ...n,
            itemStyle: {
              ...n.itemStyle,
              opacity: activeProducer && n.name !== "KAITO" && n.name !== activeProducer ? 0.28 : 1,
              borderWidth: activeProducer === n.name ? 3 : n.itemStyle?.borderWidth || 1,
              borderColor: activeProducer === n.name ? "#66ccff" : n.itemStyle?.borderColor,
            },
          })),
          links,
          emphasis: {
            focus: "adjacency",
            lineStyle: { width: 10, opacity: 0.85 },
          },
          lineStyle: { curveness: 0.12 },
        },
      ],
    },
    true
  );

  chart.off("click");
  chart.on("click", (params) => {
    if (params.dataType !== "node" || !params.name || params.name === "KAITO") return;
    if (typeof setVerseFilter === "function") {
      setVerseFilter({ producer: params.name, vocalist: null, songKeyword: null }, "producer-bipartite");
    }
    if (typeof navigateToDataSection === "function") navigateToDataSection("songs");
  });

  return chart;
}

function bindProducerBipartiteControls() {
  const slider = document.getElementById("producer-bip-topn");
  const label = document.getElementById("producer-bip-topn-label");
  if (!slider) return;

  slider.addEventListener("input", () => {
    producerBipartiteState.topN = Number(slider.value);
    if (label) label.textContent = slider.value;
    renderProducerBipartiteChart();
  });
}

function initProducerBipartiteChart(songs) {
  producerBipartiteState.songs = songs || [];
  bindProducerBipartiteControls();
  const chart = renderProducerBipartiteChart();
  if (!chart) return null;

  window.addEventListener("verse-filter-change", () => {
    renderProducerBipartiteChart();
  });

  return chart;
}

function resizeProducerBipartiteChart() {
  if (producerBipartiteState.chart) {
    producerBipartiteState.chart.resize();
    renderProducerBipartiteChart();
  }
}
