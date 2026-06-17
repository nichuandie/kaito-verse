/**
 * 里程碑角色 → 立绘路径（含 Piapro 六人 + GUMI / IA / 可不 等）
 */

let VOCALIST_IMAGE_MAP = {};

async function loadVocalistImageMap() {
  try {
    const res = await fetchSite("./data/vocalist_images.json");
    if (!res.ok) throw new Error("missing");
    const data = await res.json();
    VOCALIST_IMAGE_MAP = data.vocalists || {};
  } catch {
    VOCALIST_IMAGE_MAP = {};
  }
  window.VOCALIST_IMAGE_MAP = VOCALIST_IMAGE_MAP;
  return VOCALIST_IMAGE_MAP;
}

function resolveMosaicProfile(vocalistTag) {
  const tag = vocalistTag || "KAITO";

  const piapro = (window.PIAPRO_CHARACTERS || []).find((c) => c.vocalistTag === tag);
  if (piapro) {
    return { id: piapro.id, name: piapro.name, image: piapro.image, vocalistTag: tag };
  }

  const extra = VOCALIST_IMAGE_MAP[tag] || window.VOCALIST_IMAGE_MAP?.[tag];
  if (extra?.image) {
    return { id: extra.id || tag, name: tag, image: extra.image, vocalistTag: tag };
  }

  return {
    id: "kaito",
    name: tag,
    image: "assets/characters/kaito-v3.png",
    vocalistTag: tag,
  };
}

async function setMosaicForFocusVocalist(vocalistTag, rerender = true) {
  const profile = resolveMosaicProfile(vocalistTag);
  if (typeof setMosaicCharacter === "function") {
    await setMosaicCharacter(profile, rerender);
  }
  return profile;
}
