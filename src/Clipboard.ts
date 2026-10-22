import { getShot } from './lib/db';
import { copyPng } from './lib/export';

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (
    sender.id !== chrome.runtime.id ||
    message?.target !== 'clipboard' ||
    message.type !== 'copy-capture' ||
    typeof message.id !== 'string'
  )
    return;

  void getShot(message.id)
    .then(async (shot) => {
      if (!shot) throw new Error('Screenshot not found in History.');
      await copyPng(shot.blob);
    })
    .then(
      () => respond({ ok: true }),
      (error: unknown) =>
        respond({
          ok: false,
          error:
            error instanceof Error ? error.message : 'Clipboard write failed.',
        }),
    );
  return true;
});
