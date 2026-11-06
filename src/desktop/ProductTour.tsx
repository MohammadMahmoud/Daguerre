import { driver, type Driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { Editor, type EditorTourState } from '../editor';
import type { Shape, Shot } from '../lib/db';
import type { Action } from '../platform/Desktop';
import { CapturePage } from './CapturePage';
import { Appearance } from './SettingsPage';
import type { Shortcuts } from './Shortcuts';
import type { Theme } from './Theme';

type Preview = { theme: Theme; blend: number };
type TourStep = {
  target: string;
  title: string;
  description: string;
  screen: 'capture' | 'editor' | 'appearance' | 'replay';
  mode?: Action;
  tool?: EditorTourState['tool'];
};

const STEPS: TourStep[] = [
  {
    screen: 'capture',
    mode: 'selection',
    target: 'capture-selection',
    title: 'Select a precise area',
    description:
      'Drag a region with the crosshair to capture exactly the area you need. On Wayland, your desktop provides the screenshot picker. This selected control is a safe preview: no real capture is taken.',
  },
  {
    screen: 'capture',
    mode: 'window',
    target: 'capture-window',
    title: 'Capture a window',
    description:
      'Choose a window and Daguerre uses its boundaries rather than a hand-drawn region. Frames and shadows depend on your operating system. Window picking is unavailable on Wayland.',
  },
  {
    screen: 'capture',
    mode: 'screen',
    target: 'capture-screen',
    title: 'Capture a display',
    description:
      'Capture the whole display under your pointer. With multiple monitors, move the pointer to the display you want. On Wayland, the desktop screenshot service handles the capture.',
  },
  {
    screen: 'capture',
    mode: 'copy-selection',
    target: 'capture-copy-selection',
    title: 'Copy a selected area',
    description:
      'The fourth capture workflow copies a selected region straight to the clipboard and keeps it in History, without opening an editor. Next, we will open a temporary sample to explore editing without touching your captures.',
  },
  {
    screen: 'editor',
    target: 'tools-toggle',
    title: 'Show or hide annotation tools',
    description:
      'This is the real editor with an in-memory sample. Watch the annotation rail expand. The pen button can collapse or expand it; the canvas uses the remaining workspace.',
  },
  {
    screen: 'editor',
    tool: 'blur',
    target: 'tool-blur',
    title: 'Pixelate sensitive information',
    description:
      'Pixelate is selected and the sample email is redacted. Drag over private details to obscure them before sharing. Only this disposable sample is changed during the tour.',
  },
  {
    screen: 'editor',
    tool: 'step',
    target: 'tool-step',
    title: 'Numbered Steps',
    description:
      'Numbered Steps is selected. Each click places the next sequential callout badge, like the two markers on this sample.',
  },
  {
    screen: 'editor',
    tool: 'text',
    target: 'tool-text',
    title: 'Add text annotations',
    description:
      'Text is selected and a sample note is visible. Click the canvas to add a caption; color and size controls style annotations.',
  },
  {
    screen: 'editor',
    tool: 'arrow',
    target: 'tool-arrow',
    title: 'Point with Arrows',
    description:
      'Arrows direct attention to a detail. The sample arrow points to the handoff summary; drag to place your own arrows after a capture.',
  },
  {
    screen: 'editor',
    tool: 'rect',
    target: 'editor-tools',
    title: 'Shapes and markup styling',
    description:
      'Rectangle is selected around the summary. Ellipses, lines, pen, and highlighter are also available. The swatches and size controls style the active annotation.',
  },
  {
    screen: 'editor',
    target: 'copy-actions',
    title: 'Copy text or the annotated image',
    description:
      'Copy Text extracts English text with on-device OCR. Copy to Clipboard shares the annotated image. These output actions are disabled for the tour sample so your clipboard stays untouched.',
  },
  {
    screen: 'editor',
    target: 'export-menu',
    title: 'Explore export options',
    description:
      'The Export menu is open. Save PNG, JPEG, or WebP images, PDF documents, or Searchable PDFs with selectable OCR text. Print provides document output too. The tour never saves or prints its sample.',
  },
  {
    screen: 'appearance',
    target: 'appearance',
    title: 'Preview your appearance',
    description:
      'Watch the appearance change live: Liquid Glass strength on macOS, or Dark and Light on Windows and Linux. The preview then returns to your preference. Nothing is saved, and exiting restores your original design.',
  },
  {
    screen: 'replay',
    target: 'replay',
    title: 'Replay the tour anytime',
    description:
      'Product Tour is directly below Settings. Start here whenever you want another walkthrough. Finishing or closing restores the view and appearance you had before the tour.',
  },
];

const DEMO_SHAPES: Shape[] = [
  {
    id: 'redaction',
    kind: 'blur',
    color: '#111111',
    size: 14,
    pts: [64, 232, 335, 266],
  },
  {
    id: 'step-one',
    kind: 'step',
    color: '#c9372a',
    size: 20,
    pts: [68, 390],
    text: '1',
  },
  {
    id: 'step-two',
    kind: 'step',
    color: '#c9372a',
    size: 20,
    pts: [490, 390],
    text: '2',
  },
  {
    id: 'note',
    kind: 'text',
    color: '#c9372a',
    size: 26,
    pts: [60, 110],
    text: 'Ready for review',
  },
  {
    id: 'direction',
    kind: 'arrow',
    color: '#c9372a',
    size: 5,
    pts: [550, 120, 690, 205],
  },
  {
    id: 'outline',
    kind: 'rect',
    color: '#c9372a',
    size: 4,
    pts: [470, 180, 875, 315],
  },
];
const EDITOR_STATES: EditorTourState[] = Array.from(
  { length: STEPS.length },
  (_, index) => ({
    tool: STEPS[index].tool ?? 'select',
    shapes: DEMO_SHAPES.slice(
      0,
      Math.max(0, Math.min(6, index - 4 + (index > 5 ? 1 : 0))),
    ),
    toolsVisible: true,
    exportOpen: STEPS[index].target === 'export-menu',
  }),
);

function getTarget(step: TourStep) {
  if (step.screen === 'replay') return '[data-tour="replay"]';
  return `[data-tour="walkthrough"] [data-tour="${step.target}"]`;
}

async function createSample(): Promise<Shot> {
  const canvas = document.createElement('canvas');
  canvas.width = 960;
  canvas.height = 600;
  const context = canvas.getContext('2d')!;
  context.fillStyle = '#f0f0f2';
  context.fillRect(0, 0, 960, 600);
  context.fillStyle = '#ffffff';
  context.fillRect(32, 32, 896, 536);
  context.fillStyle = '#111113';
  context.font = 'bold 30px sans-serif';
  context.fillText('Project handoff', 60, 78);
  context.font = '20px sans-serif';
  for (const [text, x, y] of [
    ['Contact', 64, 210],
    ['alex@example.test', 64, 256],
    ['Handoff summary', 490, 220],
    ['Review notes and share the next steps.', 490, 266],
    ['Review the draft', 100, 397],
    ['Share the update', 525, 397],
  ] as const)
    context.fillText(text, x, y);
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((result) => {
      if (result) resolve(result);
      else reject(new Error('Could not create the tour sample.'));
    }),
  );
  return {
    id: 'tour-sample',
    title: 'Tour sample',
    mode: 'screen',
    url: '',
    createdAt: 0,
    updatedAt: 0,
    width: 960,
    height: 600,
    size: blob.size,
    blob,
    thumb: blob,
  };
}

function waitForElement(selector: string, signal: AbortSignal) {
  return new Promise<Element>((resolve, reject) => {
    const started = performance.now();
    let frame = 0;
    const abort = () => {
      cancelAnimationFrame(frame);
      reject(new DOMException('Tour closed', 'AbortError'));
    };
    signal.addEventListener('abort', abort, { once: true });
    const check = () => {
      if (signal.aborted) return abort();
      const element = document.querySelector(selector);
      const editor = element?.closest('[data-tour="sample-editor"]');
      if (
        element &&
        !element.closest('[hidden]') &&
        (!editor || editor.hasAttribute('data-tour-ready'))
      ) {
        signal.removeEventListener('abort', abort);
        return resolve(element);
      }
      if (performance.now() - started > 3000) {
        signal.removeEventListener('abort', abort);
        return reject(new Error(`Tour target did not mount: ${selector}`));
      }
      frame = requestAnimationFrame(check);
    };
    frame = requestAnimationFrame(check);
  });
}

function syncPopoverTheme(wrapper: HTMLElement) {
  const app = document.querySelector('.app');
  if (!app) return;
  const styles = getComputedStyle(app);
  for (const token of [
    '--panel',
    '--text',
    '--muted',
    '--line',
    '--accent',
    '--accent-ink',
    '--shadow',
    '--font',
  ])
    wrapper.style.setProperty(token, styles.getPropertyValue(token));
  wrapper.style.colorScheme = styles.colorScheme;
}

export function ProductTour({
  mac,
  wayland,
  shortcuts,
  theme,
  blend,
  onPreview,
  onClose,
  onError,
}: {
  mac: boolean;
  wayland: boolean;
  shortcuts: Shortcuts;
  theme: Theme;
  blend: number;
  onPreview: (preview: Preview | undefined) => void;
  onClose: () => void;
  onError: (message: string) => void;
}) {
  const [index, setIndex] = useState(0);
  const [sample, setSample] = useState<Shot>();
  const [expanded, setExpanded] = useState(false);
  const saved = useRef({ theme, blend });
  const [preview, setPreview] = useState(saved.current);
  const tour = useRef<Driver | undefined>(undefined);
  const toggleState = { ...EDITOR_STATES[index], toolsVisible: expanded };

  useEffect(() => {
    onPreview(preview);
    if (preview.theme === 'system')
      delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = preview.theme;
    document.documentElement.style.setProperty(
      '--theme-blend',
      String(preview.blend / 100),
    );
    const frame = requestAnimationFrame(() => {
      const wrapper = document.querySelector<HTMLElement>('.app-tour');
      if (wrapper) syncPopoverTheme(wrapper);
      tour.current?.refresh();
    });
    return () => cancelAnimationFrame(frame);
  }, [preview, onPreview]);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    if (index === 4) {
      setExpanded(false);
      timers.push(setTimeout(() => setExpanded(true), 600));
    }
    if (STEPS[index].screen === 'appearance') {
      setPreview({ theme: mac ? saved.current.theme : 'dark', blend: 0 });
      timers.push(
        setTimeout(
          () =>
            setPreview({
              theme: mac ? saved.current.theme : 'light',
              blend: mac ? 100 : 0,
            }),
          900,
        ),
      );
      timers.push(setTimeout(() => setPreview(saved.current), 2400));
    } else setPreview(saved.current);
    return () => timers.forEach(clearTimeout);
  }, [index, mac]);

  useEffect(() => {
    const controller = new AbortController();
    const root = document.documentElement;
    const originalTheme = root.dataset.theme;
    const originalBlend = root.style.getPropertyValue('--theme-blend');
    const originalTitle = document.title;
    let closed = false;
    let transitioning = false;
    let samplePromise: Promise<Shot> | undefined;
    const finish = () => {
      if (closed) return;
      closed = true;
      controller.abort();
      if (originalTheme === undefined) delete root.dataset.theme;
      else root.dataset.theme = originalTheme;
      if (originalBlend) root.style.setProperty('--theme-blend', originalBlend);
      else root.style.removeProperty('--theme-blend');
      document.title = originalTitle;
      onPreview(undefined);
      localStorage.setItem('hasCompletedOnboardingTour', 'true');
      onClose();
    };
    const transition = async (direction: 1 | -1) => {
      if (closed || transitioning) return;
      const next = (instance.getActiveIndex() ?? 0) + direction;
      if (next >= STEPS.length) return instance.destroy();
      if (next < 0) return;
      transitioning = true;
      try {
        if (STEPS[next].screen === 'editor') {
          samplePromise ??= createSample();
          const nextSample = await samplePromise;
          if (closed) return;
          flushSync(() => setSample(nextSample));
        }
        flushSync(() => setIndex(next));
        await waitForElement(getTarget(STEPS[next]), controller.signal);
        if (closed) return;
        if (direction === 1) instance.moveNext();
        else instance.movePrevious();
      } catch (error) {
        if (!controller.signal.aborted) {
          onError(`Could not continue the product tour: ${String(error)}`);
          instance.destroy();
        }
      } finally {
        transitioning = false;
      }
    };
    const instance = driver({
      popoverClass: 'app-tour',
      showProgress: true,
      animate: !matchMedia('(prefers-reduced-motion: reduce)').matches,
      disableActiveInteraction: true,
      nextBtnText: 'Next',
      prevBtnText: 'Back',
      doneBtnText: 'Done',
      steps: STEPS.map((step) => ({
        element: getTarget(step),
        disableActiveInteraction: ![
          'tools-toggle',
          'editor-tools',
          'appearance',
          'export-menu',
        ].includes(step.target),
        popover: { title: step.title, description: step.description },
      })),
      onPopoverRender: ({ wrapper }) => syncPopoverTheme(wrapper),
      onNextClick: () => transition(1),
      onPrevClick: () => transition(-1),
      onDestroyStarted: () => {
        finish();
        instance.destroy();
      },
      onDestroyed: finish,
    });
    tour.current = instance;
    void waitForElement(getTarget(STEPS[0]), controller.signal)
      .then(() => {
        if (!closed) instance.drive();
      })
      .catch(() => undefined);
    return () => {
      finish();
      instance.destroy();
      tour.current = undefined;
    };
  }, [onClose, onPreview, onError]);

  const step = STEPS[index];
  return (
    <div className='tour-workspace' data-tour='walkthrough'>
      {(step.screen === 'capture' || step.screen === 'replay') && (
        <CapturePage
          shortcuts={shortcuts}
          mac={mac}
          wayland={wayland}
          delay={0}
          onDelay={() => {}}
          onCapture={() => {}}
          shots={[]}
          onOpen={() => {}}
          onCopy={() => {}}
          onViewAll={() => {}}
          previewMode={step.mode}
        />
      )}
      {step.screen === 'editor' && sample && (
        <Editor
          sample={sample}
          tourState={index === 4 ? toggleState : EDITOR_STATES[index]}
        />
      )}
      {step.screen === 'appearance' && (
        <div className='page'>
          <header className='page-head'>
            <h1>Settings</h1>
          </header>
          <Appearance
            mac={mac}
            blend={preview.blend}
            theme={preview.theme}
            onBlend={(value) => setPreview({ ...preview, blend: value })}
            onTheme={(value) => setPreview({ ...preview, theme: value })}
          />
        </div>
      )}
    </div>
  );
}
