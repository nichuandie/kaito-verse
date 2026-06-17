/**
 * 异步加载 ECharts，避免阻塞整站；支持多 CDN 回退
 */
window.loadEchartsLib = function loadEchartsLib() {
  if (typeof echarts !== "undefined") return Promise.resolve(true);

  if (window.__echartsLoadPromise) return window.__echartsLoadPromise;

  const sources = [
    "https://cdn.jsdelivr.net/npm/echarts@5/dist/echarts.min.js",
    "https://unpkg.com/echarts@5/dist/echarts.min.js",
    "https://cdnjs.cloudflare.com/ajax/libs/echarts/5.5.1/echarts.min.js",
  ];

  window.__echartsLoadPromise = (async () => {
    for (const src of sources) {
      try {
        await new Promise((resolve, reject) => {
          const existing = document.querySelector(`script[data-echarts-src="${src}"]`);
          if (existing) {
            existing.addEventListener("load", () => resolve(), { once: true });
            existing.addEventListener("error", () => reject(new Error("load failed")), { once: true });
            return;
          }
          const script = document.createElement("script");
          script.src = src;
          script.async = true;
          script.dataset.echartsSrc = src;
          script.onload = () => resolve();
          script.onerror = () => reject(new Error("load failed"));
          document.head.appendChild(script);
        });
        if (typeof echarts !== "undefined") return true;
      } catch {
        /* try next CDN */
      }
    }
    return false;
  })();

  return window.__echartsLoadPromise;
};
