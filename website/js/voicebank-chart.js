/**
 * KAITO 声线版本分布 — 从 vocalists 字段解析 V1 / V3 各声库
 */

const VOICEBANK_ORDER = ["V1", "STRAIGHT", "SOFT", "WHISPER", "ENGLISH", "SP", "Unknown"];
const VOICEBANK_COLORS = {
  V1: "#0044ff",
  STRAIGHT: "#48cae4",
  SOFT: "#90e0ef",
  WHISPER: "#7ec8ff",
  ENGLISH: "#ffd166",
  SP: "#66ccff",
  Unknown: "#6b8fa8",
};
const VOICEBANK_LABELS = {
  V1: "V1 / 原版",
  STRAIGHT: "V3 STRAIGHT",
  SOFT: "V3 SOFT",
  WHISPER: "V3 WHISPER",
  ENGLISH: "V3 ENGLISH",
  SP: "KAITO SP",
  Unknown: "V3 Unknown",
};

function classifyKaitoVoicebank(part) {
  const s = (part || "").trim();
  if (!/kaito/i.test(s)) return null;
  if (/v3\s*\(\s*straight\s*\)/i.test(s)) return "STRAIGHT";
  if (/v3\s*\(\s*soft\s*\)/i.test(s)) return "SOFT";
  if (/v3\s*\(\s*whisper\s*\)/i.test(s)) return "WHISPER";
  if (/v3\s*\(\s*english\s*\)/i.test(s)) return "ENGLISH";
  if (/v3\s*\(\s*unknown\s*\)/i.test(s)) return "Unknown";
  if (/sp\s*\(/i.test(s)) return "SP";
  if (/^kaito$/i.test(s)) return "V1";
  if (/^kaito\s/i.test(s) && !/v3|sp/i.test(s)) return "V1";
  return "V1";
}

function extractVoicebanksFromSong(song) {
  const raw = song.vocalists;
  const text = typeof raw === "string" ? raw : (raw || []).map((v) => v.name || v).join(" / ");
  if (!text) return ["V1"];

  const parts = text.split(/[/／]/).map((p) => p.trim()).filter(Boolean);
  const banks = new Set();
  for (const part of parts) {
    const bank = classifyKaitoVoicebank(part);
    if (bank) banks.add(bank);
  }
  return banks.size ? [...banks] : ["V1"];
}

function buildVoicebankStats(songs) {
  const counts = new Map();
  for (const song of songs) {
    for (const bank of extractVoicebanksFromSong(song)) {
      counts.set(bank, (counts.get(bank) || 0) + 1);
    }
  }
  return VOICEBANK_ORDER.filter((k) => counts.has(k)).map((k) => ({
    id: k,
    name: VOICEBANK_LABELS[k] || k,
    value: counts.get(k),
    color: VOICEBANK_COLORS[k],
  }));
}

function initVoicebankChart(songs, domId = "chart-voicebank") {
  const dom = document.getElementById(domId);
  if (!dom || typeof echarts === "undefined") return null;

  const data = buildVoicebankStats(songs || []);
  if (!data.length) return null;

  const chart = echarts.init(dom);
  const total = data.reduce((s, d) => s + d.value, 0);

  chart.setOption({
    backgroundColor: "transparent",
    title: {
      text: "KAITO 声线版本分布",
      subtext: `基于 VocaDB 演唱标签 · 共 ${formatNumber(total)} 次声库标注（一曲多声线分别计数）`,
      left: 8,
      top: 4,
      textStyle: { color: "#e8f4f8", fontSize: 14, fontWeight: 700 },
      subtextStyle: { color: "#8ba3b8", fontSize: 11 },
    },
    tooltip: {
      trigger: "item",
      backgroundColor: "rgba(6,14,28,0.94)",
      borderColor: "rgba(72,202,228,0.45)",
      formatter: (p) =>
        `<strong>${p.name}</strong><br/>${formatNumber(p.value)} 次 · ${p.percent}%`,
    },
    legend: {
      orient: "vertical",
      right: 4,
      top: "middle",
      itemWidth: 10,
      itemHeight: 10,
      textStyle: { color: "#8ba3b8", fontSize: 10 },
    },
    series: [
      {
        type: "pie",
        radius: ["34%", "62%"],
        center: ["38%", "56%"],
        avoidLabelOverlap: true,
        itemStyle: {
          borderRadius: 6,
          borderColor: "#0f2137",
          borderWidth: 2,
        },
        label: {
          show: true,
          color: "#c8dde8",
          fontSize: 11,
          formatter: "{b}\n{d}%",
        },
        emphasis: {
          scale: true,
          scaleSize: 8,
          itemStyle: { shadowBlur: 16, shadowColor: "rgba(72,202,228,0.45)" },
        },
        data: data.map((d) => ({
          name: d.name,
          value: d.value,
          itemStyle: { color: d.color },
        })),
      },
    ],
  });

  chart.on("click", (params) => {
    const item = data.find((d) => d.name === params.name);
    if (!item || typeof setVerseFilter !== "function") return;
    const kw =
      item.id === "V1" ? "KAITO" : item.id === "SP" ? "KAITO SP" : item.id;
    setVerseFilter({ songKeyword: kw, producer: null, vocalist: null }, "voicebank");
    if (typeof navigateToDataSection === "function") navigateToDataSection("songs");
  });

  return chart;
}

window.VOICEBANK_COLORS = VOICEBANK_COLORS;
window.VOICEBANK_LABELS = VOICEBANK_LABELS;
window.extractVoicebanksFromSong = extractVoicebanksFromSong;
window.classifyKaitoVoicebank = classifyKaitoVoicebank;
