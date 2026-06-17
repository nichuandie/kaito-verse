/**

 * Piapro 角色档案独立分页（参考 piapro.net）

 * 新增角色：编辑 data/characters.json 的 characters 或 extendedCharacters 数组

 */



let PIAPRO_CHARACTERS = [];

let activeCharacterId = "kaito";



async function loadPiaproCharacters() {

  try {

    const res = await fetchSite("./data/characters.json");

    if (!res.ok) throw new Error("missing");

    const data = await res.json();

    PIAPRO_CHARACTERS = [

      ...(data.characters || []),

      ...(data.extendedCharacters || []),

    ];

  } catch {

    PIAPRO_CHARACTERS = [];

  }

  window.PIAPRO_CHARACTERS = PIAPRO_CHARACTERS;

  return PIAPRO_CHARACTERS;

}



function getPiaproCharacter(id) {

  return PIAPRO_CHARACTERS.find((c) => c.id === id) || PIAPRO_CHARACTERS[0];

}



function renderCharactersPageHTML() {

  return `

    <div class="characters-page-inner">

      <header class="characters-header">

        <h1 class="characters-page-title">Piapro &amp; VOCALOID 角色档案</h1>

        <p class="section-desc">

          Crypton 六角色 + 里程碑生态常见歌姬 · 资料参考

          <a href="https://piapro.net/intl/zh-cn_character.html" target="_blank" rel="noopener">piapro.net</a>

          · 在 <code>data/characters.json</code> 追加条目即可扩展

        </p>

      </header>

      <div class="characters-layout">

        <nav class="characters-nav" id="characters-nav" aria-label="角色选择"></nav>

        <article class="characters-detail" id="characters-detail"></article>

      </div>

    </div>`;

}



function renderCharacterDetail(char) {

  if (!char) return "";

  const releases = (char.releases || [])

    .map(

      (r) => `

      <li>

        <span class="char-release-title">${escapeHtml(r.title)}</span>

        <span class="char-release-date">${escapeHtml(r.date)}</span>

      </li>`

    )

    .join("");



  const demos =

    char.id === "kaito" && char.productUrl

      ? `

      <div class="char-demos">

        <h3>KAITO V3 官方试听</h3>

        <p class="char-demos-note">

          Demo 曲目来自

          <a href="${char.productUrl}" target="_blank" rel="noopener">VOCALOID SHOP · KAITO V3</a>

        </p>

        <ul class="char-demo-list">

          ${(char.demos || [])

            .map(

              (d) =>

                `<li><a href="${char.productUrl}" target="_blank" rel="noopener">${escapeHtml(d.title)} · ${escapeHtml(d.artist)}</a></li>`

            )

            .join("")}

        </ul>

        <a class="char-shop-btn" href="${char.productUrl}" target="_blank" rel="noopener">前往官方试听 / 购买页</a>

      </div>`

      : "";



  return `

    <div class="char-hero" style="--char-accent:${char.color}">

      <div class="char-figure-wrap">

        <img src="${char.image}" alt="${escapeHtml(char.name)}" class="char-figure" loading="lazy" />

      </div>

      <div class="char-copy">

        <p class="char-name-en">${escapeHtml(char.nameEn)}</p>

        <h2 class="char-name">${escapeHtml(char.name)}</h2>

        <p class="char-summary">${escapeHtml(char.summary)}</p>

        <dl class="char-specs">

          <div><dt>声源</dt><dd>${escapeHtml(char.voice)}</dd></div>

          ${char.age && char.age !== "—" ? `<div><dt>年龄</dt><dd>${escapeHtml(char.age)}</dd></div>` : ""}

          ${char.height && char.height !== "—" ? `<div><dt>身高</dt><dd>${escapeHtml(char.height)}</dd></div>` : ""}

          <div><dt>代表色</dt><dd><span class="char-color-dot" style="background:${char.color}"></span>${escapeHtml(char.colorLabel)}</dd></div>

          <div><dt>人设</dt><dd>Art by ${escapeHtml(char.artist)}</dd></div>

        </dl>

        <div class="char-actions">

          <button type="button" class="char-action-btn" data-char-filter="${escapeHtml(char.vocalistTag)}">在里程碑中查看</button>

          <button type="button" class="char-action-btn secondary" data-char-mosaic="${char.id}">切换构成剪影</button>

        </div>

      </div>

    </div>

    ${

      releases

        ? `<div class="char-releases"><h3>软件版本</h3><ul>${releases}</ul></div>`

        : ""

    }

    ${demos}`;

}



function renderCharactersNav(activeId) {

  const nav = document.getElementById("characters-nav");

  if (!nav) return;

  nav.innerHTML = PIAPRO_CHARACTERS.map(

    (c) => `

    <button type="button" class="characters-nav-btn${c.id === activeId ? " active" : ""}" data-char-id="${c.id}" style="--char-accent:${c.color}">

      <img src="${c.image}" alt="" class="characters-nav-thumb" loading="lazy" />

      <span>${escapeHtml(c.name)}</span>

    </button>`

  ).join("");



  nav.querySelectorAll(".characters-nav-btn").forEach((btn) => {

    btn.addEventListener("click", () => selectCharacter(btn.dataset.charId));

  });

}



function selectCharacter(id) {

  activeCharacterId = id;

  const char = getPiaproCharacter(id);

  const detail = document.getElementById("characters-detail");

  if (detail && char) detail.innerHTML = renderCharacterDetail(char);

  renderCharactersNav(id);

  bindCharacterDetailActions();

}



function bindCharacterDetailActions() {

  const detail = document.getElementById("characters-detail");

  if (!detail) return;



  detail.querySelector("[data-char-filter]")?.addEventListener("click", (e) => {

    const tag = e.currentTarget.dataset.charFilter;

    if (typeof navigateToDataSection === "function") navigateToDataSection("milestones");

    if (typeof selectMilestoneFocusVocalist === "function") {

      selectMilestoneFocusVocalist(tag);

    } else if (typeof setVerseFilter === "function") {

      setVerseFilter({ vocalist: tag, producer: null, songKeyword: null }, "characters");

    }

  });



  detail.querySelector("[data-char-mosaic]")?.addEventListener("click", (e) => {

    const id = e.currentTarget.dataset.charMosaic;

    const char = PIAPRO_CHARACTERS.find((c) => c.id === id);

    if (typeof navigateToDataSection === "function") navigateToDataSection("milestones");

    if (char && typeof selectMilestoneFocusVocalist === "function") {

      selectMilestoneFocusVocalist(char.vocalistTag);

    }

  });

}



async function initCharactersPage() {

  await loadPiaproCharacters();

  const root = document.getElementById("page-characters");

  if (!root || !PIAPRO_CHARACTERS.length) return;



  if (!root.querySelector(".characters-page-inner")) {

    root.innerHTML = renderCharactersPageHTML();

  }

  selectCharacter(activeCharacterId);

}



function scrollToCharacter(id) {

  if (typeof showSitePage === "function") showSitePage("characters");

  selectCharacter(id || activeCharacterId);

}


