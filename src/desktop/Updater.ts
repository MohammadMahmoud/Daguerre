import { relaunch } from '@tauri-apps/plugin-process';
import { check, type Update } from '@tauri-apps/plugin-updater';
import { useCallback, useEffect, useRef, useState } from 'react';

export type UpdateState =
  | { status: 'idle' | 'checking' | 'latest' | 'unpublished' }
  | { status: 'available' | 'ready'; version: string }
  | { status: 'downloading'; version: string; progress?: number }
  | { status: 'error'; message: string };

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
// The updater's error when the latest GitHub release has no latest.json (an unsigned build).
const NO_MANIFEST = 'Could not fetch a valid release JSON';

/** Checks GitHub releases for a newer version; with `auto` on, it also installs it at launch and daily. */
export function useUpdater() {
  const [auto, setAuto] = useState(
    () => localStorage.getItem('autoUpdate') === 'true',
  );
  const [state, setState] = useState<UpdateState>({ status: 'idle' });
  const update = useRef<Update | null>(null);
  const busy = useRef(false);
  // An installed update only applies after a restart, so stop checking until then.
  const installed = useRef(false);

  const run = useCallback(async (task: () => Promise<void>) => {
    if (busy.current || installed.current) return;
    busy.current = true;
    try {
      await task();
    } catch (e) {
      setState({ status: 'error', message: String(e) });
    } finally {
      busy.current = false;
    }
  }, []);

  const download = useCallback(async (found: Update) => {
    const { version } = found;
    let total = 0;
    let received = 0;
    setState({ status: 'downloading', version });
    await found.downloadAndInstall((e) => {
      if (e.event === 'Started') total = e.data.contentLength ?? 0;
      if (e.event !== 'Progress' || !total) return;
      received += e.data.chunkLength;
      setState({ status: 'downloading', version, progress: received / total });
    });
    installed.current = true;
    setState({ status: 'ready', version });
  }, []);

  const checkNow = useCallback(
    (install: boolean) =>
      run(async () => {
        setState({ status: 'checking' });
        localStorage.setItem('lastUpdateCheck', String(Date.now()));
        try {
          update.current = await check();
        } catch (e) {
          if (!String(e).includes(NO_MANIFEST)) throw e;
          return setState({ status: 'unpublished' });
        }
        if (!update.current) return setState({ status: 'latest' });
        if (install) return download(update.current);
        setState({ status: 'available', version: update.current.version });
      }),
    [run, download],
  );

  useEffect(() => {
    if (!auto) return;
    void checkNow(true);
    const timer = setInterval(() => {
      const last = Number(localStorage.getItem('lastUpdateCheck'));
      if (Date.now() - last >= DAY) void checkNow(true);
    }, HOUR);
    return () => clearInterval(timer);
  }, [auto, checkNow]);

  return {
    state,
    auto,
    changeAuto(on: boolean) {
      setAuto(on);
      localStorage.setItem('autoUpdate', String(on));
    },
    check: () => void checkNow(false),
    install: () =>
      void run(async () => {
        if (update.current) await download(update.current);
      }),
    restart: () => void relaunch(),
  };
}

export type Updater = ReturnType<typeof useUpdater>;
