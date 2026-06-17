/**
 * 首页声浪 — 频段模拟 + 节拍 + 鼠标位置扰动
 */

let heroSoundwaveRaf = null;

function initHeroSoundwave(canvasId = "hero-soundwave") {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  const barCount = 52;
  const bars = Array.from({ length: barCount }, (_, i) => ({
    height: 0.08,
    speed: 0.04 + (i / barCount) * 0.08,
    jitter: Math.random() * Math.PI * 2,
    xNorm: i / (barCount - 1),
  }));

  let width = 0;
  let height = 0;
  let dpr = 1;
  let t = 0;
  let beatPhase = 0;
  let beatStrength = 0;
  let mouseXNorm = 0.5;
  let mouseBoost = 0;
  let mouseActive = false;

  const bandEl = canvas.closest(".hero-soundwave-band") || canvas.parentElement;

  function onMouseMove(event) {
    if (!bandEl) return;
    const rect = bandEl.getBoundingClientRect();
    if (!rect.width) return;
    mouseXNorm = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    mouseBoost = Math.min(1, mouseBoost + 0.35);
    mouseActive = true;
  }

  function onMouseLeave() {
    mouseActive = false;
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    width = Math.max(rect.width, 320);
    height = Math.max(rect.height, 100);
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function bandProfile(xNorm) {
    const bass = Math.exp(-xNorm * 3.8) * 0.55;
    const mid = Math.exp(-Math.pow((xNorm - 0.42) / 0.28, 2)) * 0.38;
    const treble = Math.pow(xNorm, 1.6) * 0.32;
    return bass + mid + treble;
  }

  function mouseRipple(xNorm) {
    if (mouseBoost < 0.02) return 0;
    const dist = Math.abs(xNorm - mouseXNorm);
    const core = Math.exp(-dist * dist * 28);
    const ripple = Math.sin(dist * 22 - t * 4.5) * 0.12 * core;
    return (core * 0.42 + Math.max(0, ripple)) * mouseBoost;
  }

  function targetHeight(bar) {
    const { xNorm, jitter } = bar;
    const profile = bandProfile(xNorm);
    const metrics =
      typeof getAudioReactiveMetrics === "function" ? getAudioReactiveMetrics() : null;
    const live = metrics?.playing ? metrics : null;

    let audioBoost = 0;
    if (live?.freqData) {
      const bin = Math.floor(xNorm * (live.freqData.length - 1));
      audioBoost = (live.freqData[bin] / 255) * (0.35 + live.energy * 0.45);
    }

    const beatKick =
      (live ? live.bass * 0.55 + live.energy * 0.25 : beatStrength) * profile * (0.55 + Math.random() * 0.35);
    const slowWave = Math.sin(t * 0.45 + xNorm * 4.5 + jitter) * 0.1 * profile;
    const midRipple = Math.sin(t * 1.35 + xNorm * 11 + jitter * 0.5) * 0.07;
    const trebleFizz =
      xNorm > 0.55
        ? Math.max(0, Math.sin(t * 5.5 + bar.jitter * 3)) * 0.12 * xNorm * (live ? 0.6 + live.treble : 1)
        : 0;
    const micro = (Math.random() - 0.5) * 0.06 * (0.25 + (live?.energy || beatStrength));
    const mouse = mouseRipple(xNorm);

    const idle = live ? 0.08 + profile * 0.12 : 0.05 + profile * 0.1;
    return Math.max(
      0.04,
      Math.min(0.96, idle + beatKick + audioBoost + slowWave + midRipple + trebleFizz + micro + mouse)
    );
  }

  function tickBeat() {
    const metrics =
      typeof getAudioReactiveMetrics === "function" ? getAudioReactiveMetrics() : null;
    if (metrics?.playing) {
      beatStrength += (Math.min(1, metrics.bass * 1.1 + metrics.energy * 0.35) - beatStrength) * 0.28;
      if (typeof applyAudioReactiveGlow === "function") {
        applyAudioReactiveGlow(document.querySelector(".hero-showcase"), metrics);
        applyAudioReactiveGlow(document.querySelector(".hero-glow"), metrics);
      }
      return;
    }

    beatPhase += 0.018;
    const pulse = Math.max(0, Math.sin(beatPhase * 2.4));
    const accent = Math.random() < 0.012 ? 0.35 + Math.random() * 0.25 : 0;
    beatStrength += (Math.max(pulse ** 3.2, accent) - beatStrength) * 0.22;

    if (mouseActive) {
      mouseBoost = Math.min(1, mouseBoost + 0.08);
    } else {
      mouseBoost *= 0.94;
    }
  }

  function draw() {
    t += 0.014;
    tickBeat();
    ctx.clearRect(0, 0, width, height);

    const gap = width / barCount;
    const barW = Math.max(2.5, gap * 0.48);
    const radius = Math.min(barW / 2, 2.5);

    for (let i = 0; i < barCount; i++) {
      const bar = bars[i];
      const target = targetHeight(bar);
      const reactSpeed = bar.speed + mouseBoost * 0.12;
      bar.height += (target - bar.height) * reactSpeed;

      const barH = bar.height * height * 0.9;
      const x = i * gap + (gap - barW) / 2;
      const y = height - barH;
      const hot = bar.height > 0.55;

      const grad = ctx.createLinearGradient(0, y, 0, height);
      grad.addColorStop(0, hot ? "rgba(160, 230, 255, 0.9)" : "rgba(120, 210, 255, 0.75)");
      grad.addColorStop(0.45, "rgba(0, 90, 220, 0.5)");
      grad.addColorStop(1, "rgba(0, 50, 130, 0.04)");

      ctx.fillStyle = grad;
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(x, y, barW, barH, [radius, radius, 0, 0]);
      } else {
        ctx.rect(x, y, barW, barH);
      }
      ctx.fill();
    }

    heroSoundwaveRaf = requestAnimationFrame(draw);
  }

  resize();
  window.addEventListener("resize", resize);
  window.addEventListener("mousemove", onMouseMove, { passive: true });
  bandEl?.addEventListener("mouseleave", onMouseLeave);

  document.addEventListener("visibilitychange", () => {
    if (document.hidden && heroSoundwaveRaf) {
      cancelAnimationFrame(heroSoundwaveRaf);
      heroSoundwaveRaf = null;
    } else if (!document.hidden && !heroSoundwaveRaf) {
      heroSoundwaveRaf = requestAnimationFrame(draw);
    }
  });

  if (heroSoundwaveRaf) cancelAnimationFrame(heroSoundwaveRaf);
  heroSoundwaveRaf = requestAnimationFrame(draw);
}
