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

  async function fetchSiteJson(path, options = {}) {
    const retries = options.retries ?? 3;
    const required = options.required !== false;
    let lastError = null;

    for (let attempt = 0; attempt < retries; attempt += 1) {
      try {
        const res = await fetchSite(path, options.fetchOptions);
        if (!res.ok) {
          lastError = new Error(`HTTP_${res.status}:${path}`);
          if (attempt < retries - 1) {
            await new Promise((r) => setTimeout(r, 700 * (attempt + 1)));
          }
          continue;
        }
        return await res.json();
      } catch (err) {
        lastError = err;
        if (attempt < retries - 1) {
          await new Promise((r) => setTimeout(r, 700 * (attempt + 1)));
        }
      }
    }

    if (!required) return null;
    const msg = lastError?.message || "FETCH_FAILED";
    throw new Error(`DATA_FETCH_FAILED:${path}:${msg}`);
  }

  window.resolveSitePath = resolveSitePath;
  window.fetchSite = fetchSite;
  window.fetchSiteJson = fetchSiteJson;
  window.getSiteBase = getSiteBase;
})();
