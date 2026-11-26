import captureSoundUrl from './CaptureSound.mp3';

/** Leading silence in the bundled shutter recording before the mechanical click starts. */
const TRIM_START_SECONDS = 0.48;
const PLAYBACK_VOLUME = 0.85;
const FADE_IN_SECONDS = 0.005;

let cachedAudioData: Promise<ArrayBuffer> | null = null;

/** Fetches and caches the bundled shutter audio bytes so repeated captures start immediately. */
function loadAudioData(): Promise<ArrayBuffer> {
  if (!cachedAudioData) {
    cachedAudioData = fetch(captureSoundUrl)
      .then((response) => {
        if (!response.ok) throw new Error('Failed to load capture sound');
        return response.arrayBuffer();
      })
      .catch((error) => {
        cachedAudioData = null;
        throw error;
      });
  }
  return cachedAudioData;
}

/** Plays the bundled camera shutter sound via Web Audio API, trimmed past its leading silence. */
export async function playCaptureSound(): Promise<void> {
  const AudioCtx =
    globalThis.AudioContext ??
    (globalThis as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioCtx) return;

  let ctx: AudioContext | undefined;
  try {
    const raw = await loadAudioData();
    ctx = new AudioCtx();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    /** Clone the cached buffer because decodeAudioData detaches the transferred ArrayBuffer. */
    const buffer = await ctx.decodeAudioData(raw.slice(0));
    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const gain = ctx.createGain();
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(PLAYBACK_VOLUME, now + FADE_IN_SECONDS);

    source.connect(gain);
    gain.connect(ctx.destination);

    const offset =
      buffer.duration > TRIM_START_SECONDS + 0.1 ? TRIM_START_SECONDS : 0;
    const releaseMs = Math.max(
      200,
      Math.ceil((buffer.duration - offset) * 1000) + 150,
    );

    let closed = false;
    const cleanup = () => {
      if (closed) return;
      closed = true;
      clearTimeout(timer);
      void ctx?.close().catch(() => undefined);
    };
    const timer = setTimeout(cleanup, releaseMs);
    source.onended = cleanup;

    source.start(now, offset);
  } catch {
    void ctx?.close().catch(() => undefined);
  }
}
