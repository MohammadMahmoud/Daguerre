import { playCaptureSound } from './lib/CaptureSound';

const IDLE_CLOSE_MS = 2000;
let closeTimer: ReturnType<typeof setTimeout> | undefined;

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (
    sender.id !== chrome.runtime.id ||
    message?.target !== 'offscreen' ||
    message.type !== 'play-capture-sound'
  )
    return;

  clearTimeout(closeTimer);
  void playCaptureSound()
    .then(
      () => respond({ ok: true }),
      () => respond({ ok: false }),
    )
    .finally(() => {
      closeTimer = setTimeout(() => window.close(), IDLE_CLOSE_MS);
    });
  return true;
});
