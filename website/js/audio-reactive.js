/**
 * 共享音频分析总线 — 首页播放器驱动 Hero / 试听区背景
 */

const AudioReactive = {
  analyser: null,
  freqData: null,
  playing: false,
  voicebankColor: "#48cae4",
};

function setAudioReactiveAnalyser(analyser, freqData) {
  AudioReactive.analyser = analyser || null;
  AudioReactive.freqData = freqData || null;
}

function setAudioReactivePlaying(playing) {
  AudioReactive.playing = !!playing;
}

function setAudioReactiveVoicebankColor(color) {
  if (color) AudioReactive.voicebankColor = color;
}

function getAudioReactiveMetrics() {
  const { analyser, freqData, playing } = AudioReactive;
  const idle = { energy: 0, bass: 0, mid: 0, treble: 0, playing: false };

  if (!playing || !analyser || !freqData?.length) return idle;

  analyser.getByteFrequencyData(freqData);
  const len = freqData.length;
  let sum = 0;
  let bassSum = 0;
  let midSum = 0;
  let trebleSum = 0;
  const bassEnd = Math.floor(len * 0.12);
  const midEnd = Math.floor(len * 0.45);

  for (let i = 0; i < len; i++) {
    const v = freqData[i];
    sum += v;
    if (i < bassEnd) bassSum += v;
    else if (i < midEnd) midSum += v;
    else trebleSum += v;
  }

  const scale = 255 * len;
  return {
    energy: sum / scale,
    bass: bassSum / (255 * Math.max(1, bassEnd)),
    mid: midSum / (255 * Math.max(1, midEnd - bassEnd)),
    treble: trebleSum / (255 * Math.max(1, len - midEnd)),
    playing: true,
    freqData,
  };
}

function applyAudioReactiveGlow(el, metrics) {
  if (!el) return;
  const e = metrics?.energy || 0;
  el.style.setProperty("--audio-energy", String(Math.min(1, e * 1.35)));
  el.style.setProperty("--audio-bass", String(metrics?.bass || 0));
}

window.setAudioReactiveAnalyser = setAudioReactiveAnalyser;
window.setAudioReactivePlaying = setAudioReactivePlaying;
window.setAudioReactiveVoicebankColor = setAudioReactiveVoicebankColor;
window.getAudioReactiveMetrics = getAudioReactiveMetrics;
window.applyAudioReactiveGlow = applyAudioReactiveGlow;
