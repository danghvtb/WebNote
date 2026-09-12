import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react';

export type PeriodDragDirection = 'previous' | 'next' | null;

interface PeriodDragFeedback {
  direction: PeriodDragDirection;
  offsetX: number;
  progress: number;
  isDragging: boolean;
}

interface ActiveGesture {
  pointerId: number;
  startX: number;
  startY: number;
  lastX: number;
  startTime: number;
  axis: 'pending' | 'horizontal' | 'vertical';
  startScrollLeft: number;
  edge: 'start' | 'end' | 'both' | 'none';
  direction: PeriodDragDirection;
  navigationDistance: number;
}

interface UsePeriodDragNavigationOptions {
  mode: 'page' | 'scroll';
  onPrevious: () => void;
  onNext: () => void;
  scrollRef?: RefObject<HTMLDivElement | null>;
  resetScrollKey?: string;
  snapColumns?: number;
}

const INTERACTIVE_SELECTOR = [
  'button',
  'a',
  'input',
  'textarea',
  'select',
  '[role="button"]',
  '[data-no-period-drag]',
  '.event-card-container',
].join(',');

const LOCK_DISTANCE = 8;
const CLICK_SUPPRESSION_DISTANCE = 6;
const DIRECTION_RATIO = 1.25;
const EDGE_TOLERANCE = 2;
const FLICK_DISTANCE = 48;
const FLICK_VELOCITY = 0.65;
const MAX_ELASTIC_OFFSET = 56;
const ELASTIC_RESISTANCE = 0.28;

const idleFeedback: PeriodDragFeedback = {
  direction: null,
  offsetX: 0,
  progress: 0,
  isDragging: false,
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function getNavigationThreshold(width: number): number {
  return clamp(width * 0.18, 72, 120);
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(INTERACTIVE_SELECTOR) !== null;
}

export function usePeriodDragNavigation({
  mode,
  onPrevious,
  onNext,
  scrollRef,
  resetScrollKey,
  snapColumns,
}: UsePeriodDragNavigationOptions) {
  const gestureRef = useRef<ActiveGesture | null>(null);
  const suppressClickUntilRef = useRef(0);
  const [feedback, setFeedback] = useState<PeriodDragFeedback>(idleFeedback);

  useEffect(() => {
    if (mode === 'scroll' && scrollRef?.current) {
      scrollRef.current.scrollLeft = 0;
    }
  }, [mode, resetScrollKey, scrollRef]);

  const snapToNearestColumn = useCallback(() => {
    const scroller = scrollRef?.current;
    if (mode !== 'scroll' || !scroller || !snapColumns || snapColumns < 1) return;

    const columnWidth = scroller.scrollWidth / snapColumns;
    const maxScrollLeft = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
    const target = clamp(Math.round(scroller.scrollLeft / columnWidth) * columnWidth, 0, maxScrollLeft);
    scroller.scrollTo({ left: target, behavior: 'smooth' });
  }, [mode, scrollRef, snapColumns]);

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return;
      if (isInteractiveTarget(event.target)) return;

      const scroller = mode === 'scroll' ? scrollRef?.current : null;
      const maxScrollLeft = scroller
        ? Math.max(0, scroller.scrollWidth - scroller.clientWidth)
        : 0;
      const atStart = !scroller || scroller.scrollLeft <= EDGE_TOLERANCE;
      const atEnd = !scroller || scroller.scrollLeft >= maxScrollLeft - EDGE_TOLERANCE;

      gestureRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        lastX: event.clientX,
        startTime: event.timeStamp,
        axis: 'pending',
        startScrollLeft: scroller?.scrollLeft || 0,
        edge: atStart && atEnd ? 'both' : atStart ? 'start' : atEnd ? 'end' : 'none',
        direction: null,
        navigationDistance: 0,
      };
      suppressClickUntilRef.current = 0;
    },
    [mode, scrollRef],
  );

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const gesture = gestureRef.current;
      if (!gesture || gesture.pointerId !== event.pointerId || gesture.axis === 'vertical') return;

      gesture.lastX = event.clientX;
      const deltaX = event.clientX - gesture.startX;
      const deltaY = event.clientY - gesture.startY;
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);

      if (gesture.axis === 'pending') {
        if (Math.max(absX, absY) < LOCK_DISTANCE) return;
        if (absX < absY * DIRECTION_RATIO) {
          gesture.axis = 'vertical';
          return;
        }
        gesture.axis = 'horizontal';
        try {
          event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
          // Pointer capture is an enhancement; the gesture can still continue without it.
        }
      }

      event.preventDefault();
      const threshold = getNavigationThreshold(event.currentTarget.clientWidth);
      let direction: PeriodDragDirection = null;
      let navigationDistance = 0;

      if (mode === 'page') {
        direction = deltaX > 0 ? 'previous' : deltaX < 0 ? 'next' : null;
        navigationDistance = absX;
      } else {
        const scroller = scrollRef?.current;
        const canPullPrevious = (gesture.edge === 'start' || gesture.edge === 'both') && deltaX > 0;
        const canPullNext = (gesture.edge === 'end' || gesture.edge === 'both') && deltaX < 0;

        if (canPullPrevious) {
          direction = 'previous';
          navigationDistance = deltaX;
        } else if (canPullNext) {
          direction = 'next';
          navigationDistance = -deltaX;
        } else if (scroller) {
          const maxScrollLeft = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
          scroller.scrollTo({
            left: clamp(gesture.startScrollLeft - deltaX, 0, maxScrollLeft),
            behavior: 'auto',
          });
        }
      }

      gesture.direction = direction;
      gesture.navigationDistance = navigationDistance;
      const offsetSign = direction === 'previous' ? 1 : direction === 'next' ? -1 : 0;
      const offsetX = offsetSign * Math.min(MAX_ELASTIC_OFFSET, navigationDistance * ELASTIC_RESISTANCE);

      setFeedback({
        direction,
        offsetX,
        progress: direction ? clamp(navigationDistance / threshold, 0, 1) : 0,
        isDragging: true,
      });
    },
    [mode, scrollRef],
  );

  const finishGesture = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>, cancelled: boolean) => {
      const gesture = gestureRef.current;
      if (!gesture || gesture.pointerId !== event.pointerId) return;

      const totalDistance = Math.abs(event.clientX - gesture.startX);
      const elapsed = Math.max(1, event.timeStamp - gesture.startTime);
      const velocity = gesture.navigationDistance / elapsed;
      const threshold = getNavigationThreshold(event.currentTarget.clientWidth);
      const shouldNavigate =
        !cancelled &&
        gesture.axis === 'horizontal' &&
        gesture.direction !== null &&
        (gesture.navigationDistance >= threshold ||
          (gesture.navigationDistance >= FLICK_DISTANCE && velocity >= FLICK_VELOCITY));

      if (gesture.axis === 'horizontal' && totalDistance > CLICK_SUPPRESSION_DISTANCE) {
        suppressClickUntilRef.current = performance.now() + 350;
      }

      if (shouldNavigate) {
        if (gesture.direction === 'previous') onPrevious();
        else onNext();
      } else if (!cancelled && gesture.axis === 'horizontal' && gesture.direction === null) {
        snapToNearestColumn();
      }

      try {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
      } catch {
        // The browser may already have released capture after pointercancel.
      }

      gestureRef.current = null;
      setFeedback(idleFeedback);
    },
    [onNext, onPrevious, snapToNearestColumn],
  );

  const handlePointerUp = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => finishGesture(event, false),
    [finishGesture],
  );

  const handlePointerCancel = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => finishGesture(event, true),
    [finishGesture],
  );

  const handleClickCapture = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    if (performance.now() <= suppressClickUntilRef.current) {
      event.preventDefault();
      event.stopPropagation();
      suppressClickUntilRef.current = 0;
    }
  }, []);

  const contentStyle: CSSProperties = {
    transform: `translate3d(${feedback.offsetX}px, 0, 0)`,
    transition: feedback.isDragging ? 'none' : 'transform 160ms cubic-bezier(0.22, 1, 0.36, 1)',
    willChange: feedback.isDragging ? 'transform' : undefined,
  };

  const surfaceStyle: CSSProperties = {
    touchAction: 'pan-y',
    cursor: feedback.isDragging ? 'grabbing' : 'grab',
  };

  return {
    feedback,
    thresholdReached: feedback.progress >= 1,
    contentStyle,
    surfaceStyle,
    bind: {
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
      onPointerCancel: handlePointerCancel,
      onClickCapture: handleClickCapture,
    },
  };
}
