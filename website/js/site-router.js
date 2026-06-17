/**
 * 站点路由：主站单页滚动 + 角色档案独立页
 */

const SiteRouter = {
  page: "main",
};

function showSitePage(pageId) {
  const id = pageId === "characters" ? "characters" : "main";
  SiteRouter.page = id;

  document.querySelectorAll(".site-page").forEach((el) => {
    el.classList.toggle("is-active", el.dataset.page === id);
  });

  document.querySelectorAll('.site-nav a[data-page="characters"]').forEach((link) => {
    const active = id === "characters";
    link.classList.toggle("active", active);
    if (active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });

  if (id === "characters") {
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  if (id === "main" && typeof resizeHeroTypography === "function") {
    requestAnimationFrame(() => resizeHeroTypography());
  }
  if (id === "main" && typeof resizeWikiMilestoneCharts === "function") {
    requestAnimationFrame(() => resizeWikiMilestoneCharts());
  }
}

function scrollToSection(sectionId) {
  if (!sectionId) return;
  if (SiteRouter.page !== "main") showSitePage("main");
  const target = document.getElementById(sectionId);
  if (!target) return;
  requestAnimationFrame(() => {
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

function navigateToDataSection(sectionId) {
  scrollToSection(sectionId);
  history.replaceState(null, "", `#${sectionId}`);
}

function initSiteRouter() {
  document.querySelectorAll('.site-nav a:not([data-page="characters"])').forEach((link) => {
    link.addEventListener("click", (e) => {
      const href = link.getAttribute("href") || "";
      if (!href.startsWith("#")) return;
      const id = href.slice(1);
      e.preventDefault();
      showSitePage("main");
      if (id === "home" || !id) {
        window.scrollTo({ top: 0, behavior: "smooth" });
        history.replaceState(null, "", "#home");
      } else if (document.getElementById(id)) {
        scrollToSection(id);
        history.replaceState(null, "", `#${id}`);
      }
    });
  });

  document.querySelectorAll('.site-nav a[data-page="characters"]').forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      showSitePage("characters");
      history.replaceState(null, "", "#characters");
    });
  });

  document.querySelector('.logo[href="#"]')?.addEventListener("click", (e) => {
    e.preventDefault();
    showSitePage("main");
    window.scrollTo({ top: 0, behavior: "smooth" });
    history.replaceState(null, "", "#home");
  });

  document.querySelector(".hero-cta")?.addEventListener("click", (e) => {
    e.preventDefault();
    showSitePage("main");
    scrollToSection("about");
    history.replaceState(null, "", "#about");
  });

  const raw = (location.hash || "").replace(/^#/, "");
  if (raw === "characters") {
    showSitePage("characters");
  } else {
    showSitePage("main");
    window.scrollTo({ top: 0, behavior: "auto" });
  }
}
