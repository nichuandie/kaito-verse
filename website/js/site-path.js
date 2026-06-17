/**
 * 站点相对路径 — 适配子目录部署（GitHub Pages 等）
 */
(function () {
  function getSiteBase() {
    const path = window.location.pathname.replace(/\\/g, "/");
    if (path.endsWith("/")) return path;
    if (/\.[a-z0-9]+$/i.test(path.split("/").pop() || "")) {
      return path.slice(0, path.lastIndexOf("/") + 1);
    }
    return `${path}/`;
  }

  function resolveSitePath(path) {
    if (!path) return path;
    const raw = String(path).trim();
    if (/^https?:\/\//i.test(raw) || /^data:/i.test(raw) || /^blob:/i.test(raw)) {
      return raw;
    }
    const base = getSiteBase();
    const cleaned = raw.replace(/^\/+/, "").replace(/^\.\//, "");
    const encoded = cleaned
      .split("/")
      .filter(Boolean)
      .map((seg) => encodeURIComponent(decodeURIComponent(seg)))
      .join("/");
    return `${base}${encoded}`;
  }

  function fetchSite(path, options) {
    return fetch(resolveSitePath(path), options);
  }

  window.resolveSitePath = resolveSitePath;
  window.fetchSite = fetchSite;
  window.getSiteBase = getSiteBase;
})();
