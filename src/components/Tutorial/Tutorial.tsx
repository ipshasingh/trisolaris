import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';

/*
 * Each step highlights one element, found with a CSS selector that
 * matches the class names used by the other components.
 *
 * A step whose element isn't on screen (panel collapsed, hidden on a
 * small screen, ...) is skipped automatically. A step without a
 * target is shown as a centered message.
 */
interface TutorialStep {
  target?: string;
  title: string;
  text: string;
}

const STEPS: TutorialStep[] = [
  {
    title: 'Welcome to Trisolaris',
    text: 'A quick tour of what you can do in this simulator. Press Next to continue, or Skip to jump straight in.',
  },
  {
    target: '.dock.top',
    title: 'Add celestial bodies',
    text: 'Use the + buttons to add the number of celestial bodies: a star, planet, moon or generic body.',
  },
  {
    target: '.dock.bottom',
    title: 'Playback controls',
    text: 'Play or pause, advance one step at a time, reset the system, or toggle body labels. The spacebar also plays and pauses.',
  },
  {
    target: '.dock .spd',
    title: 'Simulation speed',
    text: 'Speed time up or slow it down to watch the chaos unfold.',
  },
  {
    target: '.float.right .const-row',
    title: 'Physics constants',
    text: 'Tune the gravitational constant (G), the softening (ε) and the time step (dt).',
  },
  {
    target: '.float.right .views',
    title: 'Vectors & trails',
    text: 'Show or hide the velocity arrows, the gravity arrows and the orbit trails.',
  },
  {
    target: '.float.right .body-block',
    title: 'Edit & remove bodies',
    text: "Change any body's mass, position and velocity and the simulation reacts instantly. Bodies you added have a ✕ button to remove them.",
  },
  {
    target: '.float.left',
    title: 'Planet status',
    text: 'Live climate, water, atmosphere and life readouts for each planet, and whether its era is stable or chaotic.',
  },
  {
    target: '.float.right .fhead',
    title: 'Collapse panels',
    text: "Click a panel's header to fold it away and leave more room for the simulation.",
  },
  {
    target: '.theme-toggle',
    title: 'Dark / light mode',
    text: 'Switch the look of the whole simulator.',
  },
  {
    target: '.dock.bottom > button:last-child',
    title: 'Generate a report',
    text: 'Once the system has run undisturbed for 30 seconds, this unlocks a detailed analysis you can read and download as Markdown.',
  },
  {
    target: '.help-btn',
    title: 'Replay this tour',
    text: 'Click the ? button any time to see this tutorial again.',
  },
];

const STORAGE_KEY = 'trisolaris_tutorial_done';
const PAD = 8;
const GAP = 16;

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

function findTarget(step: TutorialStep): HTMLElement | null {
  if (!step.target) return null;

  const element = document.querySelector<HTMLElement>(step.target);
  if (!element) return null;

  const rect = element.getBoundingClientRect();

  // hidden elements are treated as missing
  return rect.width === 0 && rect.height === 0 ? null : element;
}

/*
 * Open / closed state. Opens by itself on a first visit and
 * remembers that it was dismissed.
 */
export function useTutorial() {
  const [open, setOpen] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) !== '1';
    } catch {
      return true;
    }
  });

  const start = useCallback(() => setOpen(true), []);

  const close = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      /* storage unavailable: ignore */
    }

    setOpen(false);
  }, []);

  return { open, start, close };
}

export function Tutorial({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [steps, setSteps] = useState<TutorialStep[]>(STEPS);
  const [index, setIndex] = useState(0);
  const [box, setBox] = useState<Box | null>(null);
  const [cardPos, setCardPos] = useState({ top: 0, left: 0 });
  const cardRef = useRef<HTMLDivElement>(null);

  const step = steps[Math.min(index, steps.length - 1)];
  const isLast = index >= steps.length - 1;

  /*
   * Each time it opens: restart, and drop the steps whose element
   * isn't visible. Deferred by one tick so the page has finished
   * rendering before it is measured.
   */
  useEffect(() => {
    if (!open) return;

    setIndex(0);

    const id = window.setTimeout(() => {
      setSteps(STEPS.filter((s) => !s.target || findTarget(s)));
    }, 0);

    return () => window.clearTimeout(id);
  }, [open]);

  const place = useCallback(() => {
    const card = cardRef.current;
    if (!card || !step) return;

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const cw = card.offsetWidth;
    const ch = card.offsetHeight;

    const clamp = (value: number, min: number, max: number) =>
      Math.max(min, Math.min(max, value));

    const element = findTarget(step);

    if (!element) {
      setBox(null);
      setCardPos({
        top: Math.max(12, (vh - ch) / 2),
        left: Math.max(12, (vw - cw) / 2),
      });
      return;
    }

    const rect = element.getBoundingClientRect();

    setBox({
      top: rect.top - PAD,
      left: rect.left - PAD,
      width: rect.width + PAD * 2,
      height: rect.height + PAD * 2,
    });

    let top: number;
    let left = rect.left + rect.width / 2 - cw / 2;

    if (rect.bottom + PAD + GAP + ch <= vh) {
      // below the target
      top = rect.bottom + PAD + GAP;
    } else if (rect.top - PAD - GAP - ch >= 0) {
      // above the target
      top = rect.top - PAD - GAP - ch;
    } else {
      // beside it (tall targets such as the side panels)
      top = rect.top;
      left =
        rect.right + PAD + GAP + cw <= vw
          ? rect.right + PAD + GAP
          : rect.left - PAD - GAP - cw;
    }

    setCardPos({
      top: clamp(top, 12, vh - ch - 12),
      left: clamp(left, 12, vw - cw - 12),
    });
  }, [step]);

  useLayoutEffect(() => {
    if (!open) return;

    place();
  }, [open, step, place]);

  useEffect(() => {
    if (!open) return;

    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);

    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, place]);

  const next = useCallback(() => {
    if (isLast) onClose();
    else setIndex((value) => value + 1);
  }, [isLast, onClose]);

  const back = useCallback(() => {
    setIndex((value) => Math.max(0, value - 1));
  }, []);

  /*
   * Keyboard: Esc closes, arrows navigate. Space is swallowed so the
   * simulator's play/pause shortcut doesn't fire during the tour.
   */
  useEffect(() => {
    if (!open) return;

    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      else if (event.key === 'ArrowRight') next();
      else if (event.key === 'ArrowLeft') back();
      else if (event.code === 'Space') event.stopPropagation();
    };

    document.addEventListener('keydown', handler, true);

    return () => {
      document.removeEventListener('keydown', handler, true);
    };
  }, [open, next, back, onClose]);

  if (!open || !step) return null;

  return createPortal(
    <>
      {/* blocks clicks from reaching the simulator mid-tour */}
      <div className="tour-block" />

      <div
        className="tour-hole"
        style={
          box ?? {
            top: window.innerHeight / 2,
            left: window.innerWidth / 2,
            width: 0,
            height: 0,
          }
        }
      />

      <div
        ref={cardRef}
        className="tour-card"
        role="dialog"
        aria-label="Simulator tutorial"
        style={cardPos}
      >
        <button
          className="tour-x"
          aria-label="Close tutorial"
          onClick={onClose}
        >
          &times;
        </button>

        <h3>{step.title}</h3>

        <p>{step.text}</p>

        <div className="tour-foot">
          <span className="tour-count">
            {index + 1} / {steps.length}
          </span>

          {!isLast && (
            <button className="tour-btn tour-skip" onClick={onClose}>
              Skip
            </button>
          )}

          {index > 0 && (
            <button className="tour-btn tour-back" onClick={back}>
              Back
            </button>
          )}

          <button className="tour-btn tour-next" onClick={next}>
            {isLast ? 'Done' : 'Next'}
          </button>
        </div>
      </div>
    </>,
    document.body
  );
}