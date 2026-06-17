/**
 * 共享 KAITO 立绘剪影 mask（供 Hero 文字人像 & 里程碑构成图使用）
 */

const KAITO_MASK_CACHE = new Map();

/**
 * 将立绘缩放并居中放入固定画框，保证各角色构成剪影尺寸一致
 */
async function loadKaitoMaskInBox(imageSrc, boxW, boxH, cellSize = 4, dense = false) {
  const key = `box|${imageSrc}|${boxW}|${boxH}|${cellSize}|${dense}`;
  if (KAITO_MASK_CACHE.has(key)) return KAITO_MASK_CACHE.get(key);

  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = imageSrc;

  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
  });

  const scale = Math.min(boxW / img.width, boxH / img.height);
  const drawW = Math.max(1, Math.floor(img.width * scale));
  const drawH = Math.max(1, Math.floor(img.height * scale));
  const offsetX = Math.floor((boxW - drawW) / 2);
  const offsetY = Math.floor((boxH - drawH) / 2);

  const off = document.createElement("canvas");
  off.width = boxW;
  off.height = boxH;
  const offCtx = off.getContext("2d");
  offCtx.clearRect(0, 0, boxW, boxH);
  offCtx.drawImage(img, offsetX, offsetY, drawW, drawH);
  const imageData = offCtx.getImageData(0, 0, boxW, boxH);

  const cells = [];
  for (let y = 0; y < boxH; y += cellSize) {
    for (let x = 0; x < boxW; x += cellSize) {
      const cx = Math.min(x + Math.floor(cellSize / 2), boxW - 1);
      const cy = Math.min(y + Math.floor(cellSize / 2), boxH - 1);
      const i = (cy * boxW + cx) * 4;
      if (imageData.data[i + 3] > 88) {
        cells.push({
          x,
          y,
          cx: x + cellSize / 2,
          cy: y + cellSize / 2,
        });
      }
    }
  }

  let maskCells = cells;
  if (!dense) {
    if (cells.length > 4000) maskCells = cells.filter((_, idx) => idx % 2 === 0);
    if (maskCells.length > 3200) maskCells = maskCells.filter((_, idx) => idx % 2 === 0);
  } else if (maskCells.length > 5500) {
    maskCells = maskCells.filter((_, idx) => idx % 2 === 0);
  }

  const result = { width: boxW, height: boxH, cellSize, maskCells, imageSrc };
  KAITO_MASK_CACHE.set(key, result);
  return result;
}

async function loadKaitoMask(imageSrc, maxWidth = 320, cellSize = 4, dense = false, maxHeight = null) {
  const key = `${imageSrc}|${maxWidth}|${cellSize}|${dense}`;
  if (KAITO_MASK_CACHE.has(key)) return KAITO_MASK_CACHE.get(key);

  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = imageSrc;

  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
  });

  const scale = maxHeight
    ? Math.min(maxWidth / img.width, maxHeight / img.height)
    : maxWidth / img.width;
  const width = Math.floor(img.width * scale);
  const height = Math.floor(img.height * scale);

  const off = document.createElement("canvas");
  off.width = width;
  off.height = height;
  const offCtx = off.getContext("2d");
  offCtx.drawImage(img, 0, 0, width, height);
  const imageData = offCtx.getImageData(0, 0, width, height);

  const cells = [];
  for (let y = 0; y < height; y += cellSize) {
    for (let x = 0; x < width; x += cellSize) {
      const cx = Math.min(x + Math.floor(cellSize / 2), width - 1);
      const cy = Math.min(y + Math.floor(cellSize / 2), height - 1);
      const i = (cy * width + cx) * 4;
      if (imageData.data[i + 3] > 88) {
        cells.push({
          x,
          y,
          cx: x + cellSize / 2,
          cy: y + cellSize / 2,
        });
      }
    }
  }

  let maskCells = cells;
  if (!dense) {
    if (cells.length > 4000) maskCells = cells.filter((_, idx) => idx % 2 === 0);
    if (maskCells.length > 3200) maskCells = maskCells.filter((_, idx) => idx % 2 === 0);
  } else if (maskCells.length > 5500) {
    maskCells = maskCells.filter((_, idx) => idx % 2 === 0);
  }

  const result = { width, height, cellSize, maskCells, imageSrc };
  KAITO_MASK_CACHE.set(key, result);
  return result;
}

function tierColor(tier) {
  return { hall: "#48cae4", legend: "#ffd166", myth: "#ff6b9d" }[tier] || "#3366ff";
}

function shortenLabel(text, maxLen = 5) {
  const t = (text || "").trim();
  if (!t) return "·";
  if (t.length <= maxLen) return t;
  return `${t.slice(0, maxLen - 1)}…`;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function easeOutCubic(t) {
  return 1 - (1 - t) ** 3;
}
