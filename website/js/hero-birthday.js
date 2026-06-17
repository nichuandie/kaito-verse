/**
 * KAITO 生日（2月17日）— 倒计时 + 生日模式 + 正式页预览
 */

const KAITO_BIRTHDAY = { month: 2, day: 17, label: "02/17", seasonStart: 10, seasonEnd: 24 };
const BIRTHDAY_PREVIEW_KEY = "kaito-birthday-preview";

const BIRTHDAY_PREVIEW_LABELS = {
  today: "生日当天",
  soon: "生日临近",
  afterglow: "生日周",
};

function normalizeBirthdayPreview(value) {
  const v = String(value || "")
    .trim()
    .toLowerCase();
  if (!v || v === "off" || v === "0" || v === "normal") return null;
  if (v === "1" || v === "today") return "today";
  if (v === "soon" || v === "pre") return "soon";
  if (v === "afterglow" || v === "week" || v === "after") return "afterglow";
  return null;
}

function readBirthdayPreviewFromUrl() {
  try {
    return normalizeBirthdayPreview(new URLSearchParams(window.location.search).get("birthday"));
  } catch {
    return null;
  }
}

function readBirthdayPreviewFromStorage() {
  try {
    return normalizeBirthdayPreview(localStorage.getItem(BIRTHDAY_PREVIEW_KEY));
  } catch {
    return null;
  }
}

function getBirthdayPreviewOverride() {
  return readBirthdayPreviewFromUrl() || readBirthdayPreviewFromStorage();
}

function isBirthdayPreviewActive() {
  return !!getBirthdayPreviewOverride();
}

function syncBirthdayPreviewUrl(mode) {
  try {
    const url = new URL(window.location.href);
    if (mode) url.searchParams.set("birthday", mode);
    else url.searchParams.delete("birthday");
    window.history.replaceState({}, "", url);
  } catch {
    /* ignore */
  }
}

function setBirthdayPreviewMode(mode) {
  const normalized = mode ? normalizeBirthdayPreview(mode) : null;
  try {
    if (normalized) localStorage.setItem(BIRTHDAY_PREVIEW_KEY, normalized);
    else localStorage.removeItem(BIRTHDAY_PREVIEW_KEY);
  } catch {
    /* ignore */
  }
  syncBirthdayPreviewUrl(normalized);
  renderBirthdayCountdown();
  updateBirthdayPreviewSelect(normalized);
}

function getNextKaitoBirthday(now = new Date()) {
  let year = now.getFullYear();
  let target = new Date(year, KAITO_BIRTHDAY.month - 1, KAITO_BIRTHDAY.day, 0, 0, 0);
  if (target.getTime() <= now.getTime()) {
    year += 1;
    target = new Date(year, KAITO_BIRTHDAY.month - 1, KAITO_BIRTHDAY.day, 0, 0, 0);
  }
  return target;
}

function isKaitoBirthdayToday(now = new Date()) {
  return now.getMonth() === KAITO_BIRTHDAY.month - 1 && now.getDate() === KAITO_BIRTHDAY.day;
}

function getKaitoBirthdayState(now = new Date()) {
  const preview = getBirthdayPreviewOverride();
  if (preview) return preview;
  if (isKaitoBirthdayToday(now)) return "today";
  const m = now.getMonth() + 1;
  const d = now.getDate();
  if (m === KAITO_BIRTHDAY.month) {
    if (d >= KAITO_BIRTHDAY.seasonStart && d < KAITO_BIRTHDAY.day) return "soon";
    if (d > KAITO_BIRTHDAY.day && d <= KAITO_BIRTHDAY.seasonEnd) return "afterglow";
  }
  return "normal";
}

function formatCountdownParts(ms) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  return { days, hours, minutes, seconds };
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function ensureBirthdayFx() {
  let fx = document.getElementById("hero-birthday-fx");
  if (fx) return fx;
  fx = document.createElement("div");
  fx.id = "hero-birthday-fx";
  fx.className = "hero-birthday-fx";
  fx.setAttribute("aria-hidden", "true");
  fx.innerHTML = Array.from({ length: 18 }, (_, i) => {
    const left = 5 + ((i * 5.3) % 88);
    const top = 8 + ((i * 11) % 72);
    return `<span class="hero-bday-spark" style="--i:${i};left:${left}%;top:${top}%"></span>`;
  }).join("");
  document.querySelector(".hero-showcase")?.appendChild(fx);
  return fx;
}

function ensureBirthdayPreviewBanner(state) {
  let banner = document.getElementById("birthday-preview-banner");
  const preview = getBirthdayPreviewOverride();
  if (!preview) {
    banner?.remove();
    return;
  }
  if (!banner) {
    banner = document.createElement("div");
    banner.id = "birthday-preview-banner";
    banner.className = "birthday-preview-banner";
    document.body.prepend(banner);
  }
  const label = BIRTHDAY_PREVIEW_LABELS[state] || state;
  banner.innerHTML = `
    <span class="birthday-preview-banner-text">生日模式预览：${label} · 可复制当前链接向他人展示</span>
    <button type="button" class="birthday-preview-banner-exit">关闭预览</button>`;
  banner.querySelector(".birthday-preview-banner-exit")?.addEventListener("click", () => {
    setBirthdayPreviewMode(null);
  });
}

function applyKaitoBirthdayMode(now = new Date()) {
  const state = getKaitoBirthdayState(now);
  const body = document.body;
  body.classList.remove("kaito-birthday-today", "kaito-birthday-soon", "kaito-birthday-afterglow");

  ensureBirthdayPreviewBanner(state);

  if (state === "today") {
    body.classList.add("kaito-birthday-today");
    ensureBirthdayFx()?.classList.add("is-active");
  } else if (state === "soon") {
    body.classList.add("kaito-birthday-soon");
    ensureBirthdayFx()?.classList.remove("is-active");
  } else if (state === "afterglow") {
    body.classList.add("kaito-birthday-afterglow");
    ensureBirthdayFx()?.classList.remove("is-active");
  } else {
    document.getElementById("hero-birthday-fx")?.classList.remove("is-active");
  }

  window.dispatchEvent(
    new CustomEvent("kaito-birthday-mode", {
      detail: { state, isToday: state === "today" },
    })
  );
}

function updateBirthdayPreviewSelect(activeMode) {
  const select = document.getElementById("birthday-preview-select");
  if (!select) return;
  select.value = activeMode || "off";
}

function initBirthdayPreviewControls() {
  const host = document.getElementById("hero-birthday-preview");
  if (!host || host.dataset.ready === "1") return;
  host.dataset.ready = "1";

  const urlMode = readBirthdayPreviewFromUrl();
  if (urlMode) {
    try {
      localStorage.setItem(BIRTHDAY_PREVIEW_KEY, urlMode);
    } catch {
      /* ignore */
    }
  }

  host.innerHTML = `
    <label class="birthday-preview-dock-label" for="birthday-preview-select">生日预览</label>
    <select id="birthday-preview-select" class="birthday-preview-dock-select" aria-label="选择生日主题预览模式">
      <option value="off">跟随真实日期</option>
      <option value="today">生日当天</option>
      <option value="soon">生日临近</option>
      <option value="afterglow">生日周</option>
    </select>
    <button type="button" class="birthday-preview-dock-share" title="复制带预览参数的链接">分享</button>`;

  updateBirthdayPreviewSelect(getBirthdayPreviewOverride());

  host.querySelector("#birthday-preview-select")?.addEventListener("change", (e) => {
    const value = e.target.value;
    setBirthdayPreviewMode(value === "off" ? null : value);
  });

  host.querySelector(".birthday-preview-dock-share")?.addEventListener("click", async () => {
    const mode = getBirthdayPreviewOverride();
    if (!mode) {
      window.alert("请先选择「生日当天 / 临近 / 生日周」预览模式，再复制链接。");
      return;
    }
    syncBirthdayPreviewUrl(mode);
    const link = window.location.href;
    try {
      await navigator.clipboard.writeText(link);
      const btn = host.querySelector(".birthday-preview-dock-share");
      if (btn) {
        const prev = btn.textContent;
        btn.textContent = "已复制";
        setTimeout(() => {
          btn.textContent = prev;
        }, 1600);
      }
    } catch {
      window.prompt("复制此链接分享给他人：", link);
    }
  });
}

function renderBirthdayCountdown(containerId = "hero-birthday") {
  const box = document.getElementById(containerId);
  if (!box) return;

  const now = new Date();
  const mode = getKaitoBirthdayState(now);
  applyKaitoBirthdayMode(now);
  updateBirthdayPreviewSelect(getBirthdayPreviewOverride());

  if (mode === "today") {
    box.className = "hero-birthday hero-birthday--today";
    box.innerHTML = `
      <span class="hero-birthday-dot" aria-hidden="true"></span>
      <span class="hero-birthday-text">生日快乐，KAITO！</span>
      <span class="hero-birthday-sub">${KAITO_BIRTHDAY.label} · 生日模式已开启</span>`;
    return;
  }

  if (mode === "soon") {
    const target = getNextKaitoBirthday(now);
    const parts = formatCountdownParts(target - now);
    box.className = "hero-birthday hero-birthday--soon";
    box.innerHTML = `
      <span class="hero-birthday-dot" aria-hidden="true"></span>
      <span class="hero-birthday-label">KAITO 生日临近</span>
      <span class="hero-birthday-digits">
        <span class="hero-birthday-unit"><strong>${parts.days}</strong><em>天</em></span>
        <span class="hero-birthday-sep">·</span>
        <span class="hero-birthday-unit"><strong>${pad2(parts.hours)}</strong><em>时</em></span>
      </span>
      <span class="hero-birthday-meta">${KAITO_BIRTHDAY.label} · 生日季主题</span>`;
    return;
  }

  if (mode === "afterglow") {
    box.className = "hero-birthday hero-birthday--afterglow";
    box.innerHTML = `
      <span class="hero-birthday-dot" aria-hidden="true"></span>
      <span class="hero-birthday-text">KAITO 生日周</span>
      <span class="hero-birthday-sub">感谢一起庆祝 ${KAITO_BIRTHDAY.label}</span>`;
    return;
  }

  const target = getNextKaitoBirthday(now);
  const parts = formatCountdownParts(target - now);
  const nth = target.getFullYear() - 2006 + 1;

  box.className = "hero-birthday hero-birthday--countdown";
  box.innerHTML = `
    <span class="hero-birthday-dot" aria-hidden="true"></span>
    <span class="hero-birthday-label">KAITO 生日倒计时</span>
    <span class="hero-birthday-digits">
      <span class="hero-birthday-unit"><strong>${parts.days}</strong><em>天</em></span>
      <span class="hero-birthday-sep">·</span>
      <span class="hero-birthday-unit"><strong>${pad2(parts.hours)}</strong><em>时</em></span>
      <span class="hero-birthday-sep">·</span>
      <span class="hero-birthday-unit"><strong>${pad2(parts.minutes)}</strong><em>分</em></span>
      <span class="hero-birthday-sep">·</span>
      <span class="hero-birthday-unit"><strong>${pad2(parts.seconds)}</strong><em>秒</em></span>
    </span>
    <span class="hero-birthday-meta">至第 ${nth} 个生日 · ${KAITO_BIRTHDAY.label}</span>`;
}

function initHeroBirthdayCountdown(containerId = "hero-birthday") {
  initBirthdayPreviewControls();
  renderBirthdayCountdown(containerId);
  setInterval(() => renderBirthdayCountdown(containerId), 1000);
}

window.KAITO_BIRTHDAY = KAITO_BIRTHDAY;
window.isKaitoBirthdayToday = isKaitoBirthdayToday;
window.getKaitoBirthdayState = getKaitoBirthdayState;
window.applyKaitoBirthdayMode = applyKaitoBirthdayMode;
window.initHeroBirthdayCountdown = initHeroBirthdayCountdown;
window.getBirthdayPreviewOverride = getBirthdayPreviewOverride;
window.isBirthdayPreviewActive = isBirthdayPreviewActive;
window.setBirthdayPreviewMode = setBirthdayPreviewMode;
