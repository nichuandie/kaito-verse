/**
 * KAITO 历史时间轴（横向滚动）
 */

const TIMELINE_TAG_LABELS = {
  product: "制品",
  culture: "文化",
  song: "代表曲",
  milestone: "里程碑",
  voice: "声线",
  platform: "平台",
  now: "现在",
};

async function initKaitoTimeline(containerId = "kaito-timeline") {
  const root = document.getElementById(containerId);
  if (!root) return;

  let data;
  try {
    const res = await fetchSite("./data/kaito_timeline.json");
    if (!res.ok) throw new Error("missing");
    data = await res.json();
  } catch {
    root.innerHTML = `<p class="kaito-timeline-empty">时间轴数据加载失败</p>`;
    return;
  }

  const events = data.events || [];
  if (!events.length) return;

  root.innerHTML = `
    <div class="kaito-timeline-head">
      <h3 class="kaito-timeline-title">${escapeHtml(data.title || "KAITO 历史时间轴")}</h3>
      <p class="kaito-timeline-hint">横向滑动浏览 · 点击节点查看详情</p>
    </div>
    <div class="kaito-timeline-track-wrap">
      <div class="kaito-timeline-track" role="list">
        ${events
          .map(
            (ev, i) => `
          <button type="button" class="kaito-timeline-node${ev.highlight ? " is-highlight" : ""}${i === 0 ? " is-active" : ""}"
            role="listitem" data-index="${i}" aria-pressed="${i === 0}">
            <span class="kaito-timeline-dot"></span>
            <span class="kaito-timeline-year">${ev.year}</span>
            <span class="kaito-timeline-node-label">${escapeHtml(ev.label || "")}</span>
          </button>`
          )
          .join("")}
      </div>
    </div>
    <div class="kaito-timeline-detail" id="kaito-timeline-detail"></div>`;

  const detail = document.getElementById("kaito-timeline-detail");
  const nodes = root.querySelectorAll(".kaito-timeline-node");

  function renderDetail(index) {
    const ev = events[index];
    if (!ev || !detail) return;
    const tag = TIMELINE_TAG_LABELS[ev.tag] || ev.tag || "";
    const songLink =
      ev.url && ev.song
        ? `<a href="${ev.url}" target="_blank" rel="noopener">${escapeHtml(ev.song)} · VocaDB</a>`
        : "";
    detail.innerHTML = `
      <div class="kaito-timeline-detail-inner">
        <span class="kaito-timeline-tag">${escapeHtml(tag)}</span>
        <h4>${escapeHtml(ev.title)}</h4>
        <p>${escapeHtml(ev.desc)}</p>
        ${songLink ? `<p class="kaito-timeline-link">${songLink}</p>` : ""}
      </div>`;
  }

  nodes.forEach((node) => {
    node.addEventListener("click", () => {
      const index = Number(node.dataset.index);
      nodes.forEach((n) => {
        n.classList.toggle("is-active", n === node);
        n.setAttribute("aria-pressed", n === node ? "true" : "false");
      });
      renderDetail(index);
      node.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    });
  });

  renderDetail(0);
}
