import { useCallback, useEffect, useRef, useState } from 'react';

export const TOP_BAR_HOVER_THRESHOLD_PX = 64;
export const TOP_BAR_IDLE_HIDE_DELAY_MS = 2200;

export interface PlaybackAutoHideTopBarState {
  isTopBarHidden: boolean;
  revealTopBar: () => void;
  hideTopBarNow: () => void;
}

/**
 * Automatically hides the top bar as soon as playback starts (isPlaying === true).
 * While playing, the top bar only reappears when:
 *  1. The mouse is moved over the top bar zone (clientY <= 64px or onMouseEnter/onMouseMove on the top bar), OR
 *  2. The touchpad / mouse wheel is scrolled ('wheel' event).
 * After 2200ms of no top-bar hover or touchpad scroll during playback, it hides again.
 */
export function usePlaybackAutoHideTopBar(
  isPlaying: boolean,
  idleHideDelayMs: number = TOP_BAR_IDLE_HIDE_DELAY_MS
): PlaybackAutoHideTopBarState {
  const [revealedDuringPlayback, setRevealedDuringPlayback] = useState<boolean>(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current !== null) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const scheduleAutoHide = useCallback(() => {
    clearHideTimer();
    hideTimerRef.current = setTimeout(() => {
      setRevealedDuringPlayback(false);
    }, idleHideDelayMs);
  }, [clearHideTimer, idleHideDelayMs]);

  const revealTopBar = useCallback(() => {
    setRevealedDuringPlayback(true);
    scheduleAutoHide();
  }, [scheduleAutoHide]);

  const hideTopBarNow = useCallback(() => {
    clearHideTimer();
    setRevealedDuringPlayback(false);
  }, [clearHideTimer]);

  // Immediately hide the top bar whenever playback starts; reset when playback stops
  useEffect(() => {
    clearHideTimer();
    setRevealedDuringPlayback(false);
    return () => clearHideTimer();
  }, [isPlaying, clearHideTimer]);

  // Listen for mouse movement over the top bar zone (clientY <= 64) and touchpad scrolling ('wheel')
  useEffect(() => {
    if (!isPlaying) return;

    const onWindowMouseMove = (e: MouseEvent) => {
      if (typeof e.clientY === 'number' && e.clientY <= TOP_BAR_HOVER_THRESHOLD_PX) {
        revealTopBar();
      }
    };

    const onWindowWheel = () => {
      revealTopBar();
    };

    window.addEventListener('mousemove', onWindowMouseMove, { passive: true });
    window.addEventListener('wheel', onWindowWheel, { passive: true });

    return () => {
      window.removeEventListener('mousemove', onWindowMouseMove);
      window.removeEventListener('wheel', onWindowWheel);
    };
  }, [isPlaying, revealTopBar]);

  const isTopBarHidden = Boolean(isPlaying && !revealedDuringPlayback);

  return {
    isTopBarHidden,
    revealTopBar,
    hideTopBarNow,
  };
}
