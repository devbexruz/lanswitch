import React, { useState, useRef, useEffect, useCallback } from 'react';
import './VideoPlayer.css';
import { formatSecondsToMMSS } from '../../../utils/timeUtils';

interface VideoPlayerProps {
  src: string;
  title?: string;
  initialTime?: number;
  onTimeUpdate: (time: number) => void;
  onDurationChange?: (duration: number) => void;
  poster?: string;
  children?: React.ReactNode;
  onToggleAnalysis?: () => void;
  isAnalysisOpen?: boolean;
  onFullscreenChange?: (isFullscreen: boolean) => void;
  onOpenAiChat?: () => void;
}

const PLAYBACK_SPEEDS = [0.75, 1, 1.25, 1.5, 1.75, 2];

const VideoPlayer: React.FC<VideoPlayerProps> = ({
  src,
  title,
  initialTime,
  onTimeUpdate,
  onDurationChange,
  poster,
  children,
  onToggleAnalysis,
  isAnalysisOpen,
  onFullscreenChange,
  onOpenAiChat
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const showControlsRef = useRef<boolean>(true);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);

  // Loading & Buffering states
  const [isLoading, setIsLoading] = useState(true);
  const [isBuffering, setIsBuffering] = useState(false);
  const [bufferedPercent, setBufferedPercent] = useState(0);
  const shouldAutoResumeOnBufferRef = useRef<boolean>(false);

  // Calculate loaded / buffered percentage of the video & maintain healthy buffer cushion
  const updateBufferedAmount = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.duration) return;
    const dur = video.duration;
    const buf = video.buffered;
    if (buf && buf.length > 0) {
      let activeRangeEnd = 0;
      let maxEnd = 0;
      let isInRange = false;

      for (let i = 0; i < buf.length; i++) {
        const start = buf.start(i);
        const end = buf.end(i);
        if (end > maxEnd) maxEnd = end;
        if (start <= video.currentTime && video.currentTime <= end) {
          activeRangeEnd = end;
          isInRange = true;
        }
      }

      const displayEnd = isInRange ? Math.max(activeRangeEnd, video.currentTime) : maxEnd;
      const pct = Math.min(100, Math.max(0, (displayEnd / dur) * 100));
      setBufferedPercent(pct);

      const ahead = isInRange ? activeRangeEnd - video.currentTime : 0;
      // If currently buffering/waiting, wait for at least 3.5s cushion or end of video before resuming
      if (isBuffering && (ahead >= 3.5 || (isInRange && activeRangeEnd >= dur - 0.5))) {
        setIsBuffering(false);
        if (shouldAutoResumeOnBufferRef.current && video.paused) {
          video.play().then(() => {
            setIsPlaying(true);
          }).catch(() => {});
        }
      }
    }
  }, [isBuffering]);

  // Periodic buffer polling to continuously show downloading stream chunks
  useEffect(() => {
    const interval = setInterval(() => {
      updateBufferedAmount();
    }, 400);
    return () => clearInterval(interval);
  }, [updateBufferedAmount]);

  useEffect(() => {
    setIsLoading(true);
    setIsBuffering(false);
    setBufferedPercent(0);
  }, [src]);

  useEffect(() => {
    showControlsRef.current = showControls;
  }, [showControls]);

  // Ripple feedback for 10+ / 10- seeking
  const [seekFeedback, setSeekFeedback] = useState<{
    direction: 'left' | 'right';
    amount: number;
    key: number;
  } | null>(null);

  // Center play/pause pulse animation
  const [centerPulse, setCenterPulse] = useState<'play' | 'pause' | null>(null);

  const controlsTimeoutRef = useRef<any>(null);
  const seekFeedbackTimerRef = useRef<any>(null);
  const accumulatedSeekRef = useRef<{ direction: 'left' | 'right'; amount: number }>({
    direction: 'right',
    amount: 0
  });

  const touchStartRef = useRef<{ time: number; x: number; y: number } | null>(null);
  const lastTouchTapRef = useRef<{ time: number; x: number; y: number } | null>(null);
  const touchHandledRecentlyRef = useRef<boolean>(false);
  const controlsWereVisibleOnTouchStartRef = useRef<boolean>(true);
  const lastTapRef = useRef<{ time: number; x: number; y: number } | null>(null);
  const singleTapTimeoutRef = useRef<any>(null);
  const targetEndTimeRef = useRef<number | null>(null);

  // Auto-hide controls timer (3.5s - gives user sufficient time to view or tap)
  const resetControlsTimeout = useCallback(() => {
    setShowControls(true);
    showControlsRef.current = true;
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused) {
        setShowControls(false);
        showControlsRef.current = false;
        setShowSpeedMenu(false);
      }
    }, 3500);
  }, []);

  const handleMouseMove = () => {
    // Only react on desktop pointer devices
    if (touchHandledRecentlyRef.current || (typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches)) {
      return;
    }
    resetControlsTimeout();
  };

  const handleMouseLeave = () => {
    // Never hide controls on mouseleave on mobile/touch devices (prevents instant vanish on finger lift!)
    if (touchHandledRecentlyRef.current || (typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches)) {
      return;
    }
    if (isPlaying) {
      setShowControls(false);
      showControlsRef.current = false;
      setShowSpeedMenu(false);
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    }
  };

  useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
      if (singleTapTimeoutRef.current) clearTimeout(singleTapTimeoutRef.current);
      if (seekFeedbackTimerRef.current) clearTimeout(seekFeedbackTimerRef.current);
    };
  }, []);

  // Play / Pause Toggle
  const togglePlay = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!videoRef.current) return;

    if (videoRef.current.paused) {
      shouldAutoResumeOnBufferRef.current = true;
      videoRef.current.play().then(() => {
        setIsPlaying(true);
        setCenterPulse('play');
        setTimeout(() => setCenterPulse(null), 600);
        resetControlsTimeout();
      }).catch(err => console.log('Playback error:', err));
    } else {
      shouldAutoResumeOnBufferRef.current = false;
      videoRef.current.pause();
      setIsPlaying(false);
      setShowControls(true);
      setCenterPulse('pause');
      setTimeout(() => setCenterPulse(null), 600);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    }
  }, [resetControlsTimeout]);

  // YouTube-style Seeking with Visual Feedback & Accumulation
  const triggerSeek = useCallback((direction: 'left' | 'right', delta: number = 10) => {
    if (!videoRef.current) return;

    resetControlsTimeout();

    const current = videoRef.current.currentTime;
    let newTime = current;
    if (direction === 'left') {
      newTime = Math.max(0, current - delta);
    } else {
      newTime = Math.min(videoRef.current.duration || 999999, current + delta);
    }

    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
    onTimeUpdate(newTime);

    // Accumulate if same direction within 700ms
    if (accumulatedSeekRef.current.direction === direction && accumulatedSeekRef.current.amount > 0) {
      accumulatedSeekRef.current.amount += delta;
    } else {
      accumulatedSeekRef.current = { direction, amount: delta };
    }

    setSeekFeedback({
      direction,
      amount: accumulatedSeekRef.current.amount,
      key: Date.now()
    });

    if (seekFeedbackTimerRef.current) clearTimeout(seekFeedbackTimerRef.current);
    seekFeedbackTimerRef.current = setTimeout(() => {
      setSeekFeedback(null);
      accumulatedSeekRef.current = { direction: 'right', amount: 0 };
    }, 750);
  }, [onTimeUpdate, resetControlsTimeout]);



  // Dedicated Gesture Surface: Mobile Touch (Instant, 0ms lag, Double-Tap -10s/+10s)
  const handleGestureTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    touchStartRef.current = {
      time: Date.now(),
      x: t.clientX,
      y: t.clientY
    };
    controlsWereVisibleOnTouchStartRef.current = showControlsRef.current;
    touchHandledRecentlyRef.current = true;
  };

  const handleGestureTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!touchStartRef.current) return;
    const now = Date.now();
    const t = e.changedTouches[0];
    const dx = Math.abs(t.clientX - touchStartRef.current.x);
    const dy = Math.abs(t.clientY - touchStartRef.current.y);
    const touchDuration = now - touchStartRef.current.time;

    touchStartRef.current = null;

    // Suppress synthetic mouse events on mobile for 800ms
    touchHandledRecentlyRef.current = true;
    setTimeout(() => {
      touchHandledRecentlyRef.current = false;
    }, 800);

    // If finger moved or was held long (> 450ms), treat as swipe/scroll, not tap
    if (dx > 16 || dy > 16 || touchDuration > 450) {
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = t.clientX - rect.left;
    const width = rect.width;
    const percent = (clickX / width) * 100;

    const lastTap = lastTouchTapRef.current;
    const isDoubleTap = Boolean(
      lastTap &&
      (now - lastTap.time < 300) &&
      Math.abs(t.clientX - lastTap.x) < 55 &&
      Math.abs(t.clientY - lastTap.y) < 55
    );

    if (isDoubleTap) {
      // Cancel pending single-tap action
      if (singleTapTimeoutRef.current) {
        clearTimeout(singleTapTimeoutRef.current);
        singleTapTimeoutRef.current = null;
      }
      lastTouchTapRef.current = null;

      // 50% split: left half rewinds 10s, right half forwards 10s
      if (percent < 50) {
        triggerSeek('left', 10);
      } else {
        triggerSeek('right', 10);
      }
    } else {
      // First tap: record and schedule single tap action
      lastTouchTapRef.current = { time: now, x: t.clientX, y: t.clientY };

      if (singleTapTimeoutRef.current) {
        clearTimeout(singleTapTimeoutRef.current);
      }

      const wasVisible = controlsWereVisibleOnTouchStartRef.current;

      singleTapTimeoutRef.current = setTimeout(() => {
        singleTapTimeoutRef.current = null;
        lastTouchTapRef.current = null;

        const isCurrentlyPaused = videoRef.current ? videoRef.current.paused : !isPlaying;

        if (isCurrentlyPaused) {
          // 1. Agar video pause bo'lsa: keyingi touch ijro qiladi (play) va biroz turib panel avtomatik yashirinadi
          togglePlay();
        } else if (!wasVisible) {
          // 2. Agar video ijro bo'layotgan bo'lsa va panel yashirin bo'lsa: touch panelni visible qiladi (va 3.5s dan keyin hide qiladi)
          setShowControls(true);
          showControlsRef.current = true;
          resetControlsTimeout();
        } else {
          // 3. Agar video ijro bo'layotgan bo'lsa va panel visible bo'lsa: touch videoni PAUSE qiladi!
          // Pause paytida esa panel doimiy ravishda visible bo'lib turadi.
          togglePlay();
        }
      }, 220);
    }
  };

  // Desktop Mouse Click Handling
  const handleGestureClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();

    // Prevent duplicate synthetic click after touch on mobile
    if (touchHandledRecentlyRef.current || (typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches)) {
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    const percent = (clickX / width) * 100;

    const now = Date.now();
    const isDoubleTap = Boolean(
      lastTapRef.current &&
      (now - lastTapRef.current.time < 300) &&
      Math.abs(e.clientX - lastTapRef.current.x) < 50
    );

    if (isDoubleTap) {
      if (singleTapTimeoutRef.current) {
        clearTimeout(singleTapTimeoutRef.current);
        singleTapTimeoutRef.current = null;
      }
      lastTapRef.current = null;

      if (percent < 40) {
        triggerSeek('left', 10);
      } else if (percent > 60) {
        triggerSeek('right', 10);
      } else {
        toggleFullscreen();
      }
    } else {
      lastTapRef.current = { time: now, x: e.clientX, y: e.clientY };

      if (singleTapTimeoutRef.current) clearTimeout(singleTapTimeoutRef.current);
      singleTapTimeoutRef.current = setTimeout(() => {
        singleTapTimeoutRef.current = null;
        lastTapRef.current = null;

        togglePlay();
      }, 200);
    }
  };

  // Volume & Mute handling
  const toggleMute = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!videoRef.current) return;
    if (isMuted) {
      videoRef.current.muted = false;
      setIsMuted(false);
      videoRef.current.volume = volume || 0.8;
    } else {
      videoRef.current.muted = true;
      setIsMuted(true);
    }
  }, [isMuted, volume]);

  const handleVolumeChange = (newVol: number) => {
    if (!videoRef.current) return;
    const clamped = Math.min(1, Math.max(0, newVol));
    videoRef.current.volume = clamped;
    videoRef.current.muted = clamped === 0;
    setVolume(clamped);
    setIsMuted(clamped === 0);
  };

  // Playback Rate
  const handleSpeedSelect = (rate: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!videoRef.current) return;
    videoRef.current.playbackRate = rate;
    setPlaybackRate(rate);
    setShowSpeedMenu(false);
    resetControlsTimeout();
  };

  // Keyboard Shortcuts (ArrowLeft, ArrowRight, Space, J, L, K, F, M, Up, Down)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger when user is typing in inputs or textareas
      const activeEl = document.activeElement;
      const isInput = activeEl && (
        activeEl.tagName === 'INPUT' ||
        activeEl.tagName === 'TEXTAREA' ||
        (activeEl as HTMLElement).isContentEditable
      );
      if (isInput) return;

      if (e.key === 'ArrowLeft' || e.code === 'ArrowLeft' || e.key === 'j' || e.key === 'J') {
        e.preventDefault();
        triggerSeek('left', 10);
      } else if (e.key === 'ArrowRight' || e.code === 'ArrowRight' || e.key === 'l' || e.key === 'L') {
        e.preventDefault();
        triggerSeek('right', 10);
      } else if (e.key === ' ' || e.code === 'Space' || e.key === 'k' || e.key === 'K') {
        e.preventDefault();
        togglePlay();
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        toggleMute();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        handleVolumeChange(volume + 0.1);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        handleVolumeChange(volume - 0.1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [triggerSeek, togglePlay, toggleMute, volume]);

  // Video Event Handlers
  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const time = videoRef.current.currentTime;
    setCurrentTime(time);
    onTimeUpdate(time);

    updateBufferedAmount();

    if (targetEndTimeRef.current !== null && time >= targetEndTimeRef.current) {
      videoRef.current.pause();
      setIsPlaying(false);
      setShowControls(true);
      showControlsRef.current = true;
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
      targetEndTimeRef.current = null;
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
      if (onDurationChange) {
        onDurationChange(videoRef.current.duration);
      }
      setIsLoading(false);
      updateBufferedAmount();
    }
  };

  const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = Number(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = newTime;
      setCurrentTime(newTime);
      onTimeUpdate(newTime);
      updateBufferedAmount();
      resetControlsTimeout();
    }
  };

  // Custom Events from outside (Subtitles segment player & External pause)
  useEffect(() => {
    const handlePauseEvent = () => {
      if (videoRef.current) {
        videoRef.current.pause();
        setIsPlaying(false);
        setShowControls(true);
        showControlsRef.current = true;
        if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
        targetEndTimeRef.current = null;
      }
    };

    const handlePlaySegment = (e: Event) => {
      const customEvent = e as CustomEvent;
      const { startTime, endTime } = customEvent.detail;
      if (videoRef.current) {
        videoRef.current.currentTime = startTime;
        videoRef.current.play().catch(err => console.log(err));
        setIsPlaying(true);
        targetEndTimeRef.current = endTime;
      }
    };

    const handleSeekToTime = (e: Event) => {
      const customEvent = e as CustomEvent;
      const { time } = customEvent.detail;
      if (videoRef.current) {
        videoRef.current.currentTime = time;
        videoRef.current.play().catch(err => console.log(err));
        setIsPlaying(true);
        targetEndTimeRef.current = null;
      }
    };

    window.addEventListener('pause-video', handlePauseEvent);
    window.addEventListener('play-segment', handlePlaySegment);
    window.addEventListener('seek-to-time', handleSeekToTime);
    return () => {
      window.removeEventListener('pause-video', handlePauseEvent);
      window.removeEventListener('play-segment', handlePlaySegment);
      window.removeEventListener('seek-to-time', handleSeekToTime);
    };
  }, []);

  // Initial seek when resuming video playback from last position
  const hasAppliedInitialTimeRef = useRef<boolean>(false);

  useEffect(() => {
    hasAppliedInitialTimeRef.current = false;
  }, [src]);

  useEffect(() => {
    if (initialTime !== undefined && initialTime > 0 && !hasAppliedInitialTimeRef.current) {
      const applyInitialTime = () => {
        if (videoRef.current && initialTime > 0 && !hasAppliedInitialTimeRef.current) {
          hasAppliedInitialTimeRef.current = true;
          videoRef.current.currentTime = initialTime;
          setCurrentTime(initialTime);
          onTimeUpdate(initialTime);
        }
      };

      const video = videoRef.current;
      if (!video) return;

      if (video.readyState >= 1) {
        applyInitialTime();
      } else {
        video.addEventListener('loadedmetadata', applyInitialTime, { once: true });
        return () => video.removeEventListener('loadedmetadata', applyInitialTime);
      }
    }
  }, [src, initialTime, onTimeUpdate]);

  // Fullscreen management (TMA, Browser Fullscreen, Landscape Lock)
  const enterFullscreen = useCallback(async () => {
    try {
      const tg = (window as any).Telegram?.WebApp;
      if (tg) {
        tg.expand?.();
        if (typeof tg.requestFullscreen === 'function') {
          try { tg.requestFullscreen(); } catch (e) {}
        }
      }

      const elem = containerRef.current;
      if (elem) {
        if (elem.requestFullscreen) {
          await elem.requestFullscreen().catch(() => {});
        } else if ((elem as any).webkitRequestFullscreen) {
          await (elem as any).webkitRequestFullscreen().catch(() => {});
        }
      }

      try {
        const orientation = screen.orientation as any;
        if (orientation && typeof orientation.lock === 'function') {
          await orientation.lock('landscape').catch(() => {});
        }
      } catch (e) {}
    } catch (err) {
      console.log('Error entering fullscreen:', err);
    }

    setIsFullscreen(true);
    if (onFullscreenChange) onFullscreenChange(true);
  }, [onFullscreenChange]);

  const exitFullscreen = useCallback(async () => {
    try {
      const tg = (window as any).Telegram?.WebApp;
      if (tg && typeof tg.exitFullscreen === 'function') {
        try { tg.exitFullscreen(); } catch (e) {}
      }

      if (document.fullscreenElement) {
        await document.exitFullscreen().catch(() => {});
      } else if ((document as any).webkitFullscreenElement) {
        await (document as any).webkitExitFullscreen().catch(() => {});
      }

      try {
        const orientation = screen.orientation as any;
        if (orientation && typeof orientation.unlock === 'function') {
          orientation.unlock();
        }
      } catch (e) {}
    } catch (err) {
      console.log('Error exiting fullscreen:', err);
    }

    setIsFullscreen(false);
    if (onFullscreenChange) onFullscreenChange(false);
  }, [onFullscreenChange]);

  // Support external enter/exit fullscreen requests (e.g. from AI Tutor modal transitions)
  useEffect(() => {
    const handleEnterFsEvent = () => {
      enterFullscreen();
    };

    const handleExitFsEvent = () => {
      exitFullscreen();
    };

    window.addEventListener('enter-fullscreen', handleEnterFsEvent);
    window.addEventListener('exit-fullscreen', handleExitFsEvent);
    return () => {
      window.removeEventListener('enter-fullscreen', handleEnterFsEvent);
      window.removeEventListener('exit-fullscreen', handleExitFsEvent);
    };
  }, [enterFullscreen, exitFullscreen]);

  const toggleFullscreen = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (isFullscreen) {
      exitFullscreen();
    } else {
      enterFullscreen();
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      const isCurrentlyFs = Boolean(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement
      );
      if (!isCurrentlyFs && isFullscreen) {
        setIsFullscreen(false);
        if (onFullscreenChange) onFullscreenChange(false);
        try {
          const orientation = screen.orientation as any;
          if (orientation && typeof orientation.unlock === 'function') {
            orientation.unlock();
          }
        } catch (e) {}
      }
    };

    document.addEventListener('fullscreenchange', handleFsChange);
    document.addEventListener('webkitfullscreenchange', handleFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
      document.removeEventListener('webkitfullscreenchange', handleFsChange);
    };
  }, [isFullscreen, onFullscreenChange]);

  return (
    <div
      className={`custom-video-container ${isFullscreen ? 'fullscreen' : ''} ${showControls ? 'show-controls' : 'hide-controls'}`}
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <video
        ref={videoRef}
        src={src}
        className="video-element"
        poster={poster}
        preload="auto"
        playsInline
        webkit-playsinline="true"
        onLoadStart={() => {
          setIsLoading(true);
          updateBufferedAmount();
        }}
        onLoadedData={() => {
          setIsLoading(false);
          updateBufferedAmount();
        }}
        onLoadedMetadata={handleLoadedMetadata}
        onTimeUpdate={handleTimeUpdate}
        onProgress={updateBufferedAmount}
        onWaiting={() => {
          setIsBuffering(true);
          shouldAutoResumeOnBufferRef.current = !videoRef.current?.paused;
        }}
        onSeeking={() => setIsBuffering(true)}
        onSeeked={() => {
          updateBufferedAmount();
        }}
        onCanPlay={() => {
          setIsLoading(false);
          updateBufferedAmount();
        }}
        onCanPlayThrough={() => {
          setIsLoading(false);
          setIsBuffering(false);
          updateBufferedAmount();
        }}
        onPlaying={() => {
          setIsLoading(false);
          setIsBuffering(false);
          updateBufferedAmount();
        }}
        onEnded={() => {
          setIsPlaying(false);
          setShowControls(true);
          showControlsRef.current = true;
          if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
        }}
      />

      {/* Central Loading & Buffering Spinner Ring */}
      {(isLoading || isBuffering) && (
        <div className="video-loading-spinner-overlay" title="Yuklanmoqda...">
          <div className="video-spinner-ring" />
        </div>
      )}

      {/* Dedicated Gesture Surface: Handles Mobile Tap & Double-Tap (Left -10s, Right +10s) */}
      <div
        className="video-gesture-layer"
        onTouchStart={handleGestureTouchStart}
        onTouchEnd={handleGestureTouchEnd}
        onClick={handleGestureClick}
        title="Ijro/to'xtatish (2 marta bosish: 10s oldinga/orqaga)"
      />

      {/* YouTube-Style Double-Tap Ripple Feedback */}
      {seekFeedback && (
        <div
          key={seekFeedback.key}
          className={`seek-ripple-overlay seek-ripple-${seekFeedback.direction}`}
        >
          <div className="seek-ripple-content">
            <div className="seek-arrows">
              {seekFeedback.direction === 'left' ? '◀◀◀' : '▶▶▶'}
            </div>
            <span className="seek-amount-text">
              {seekFeedback.direction === 'left' ? '-' : '+'}{seekFeedback.amount} soniya
            </span>
          </div>
        </div>
      )}

      {/* Center Play/Pause Animated Pulse Icon */}
      {centerPulse && (
        <div className="center-pulse-indicator animate-pulse-fade">
          {centerPulse === 'play' ? (
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
            </svg>
          )}
        </div>
      )}

      {/* Controls Overlay */}
      <div 
        className="video-controls" 
        onClick={(e) => {
          e.stopPropagation();
          resetControlsTimeout();
        }}
        onTouchStart={() => {
          touchHandledRecentlyRef.current = true;
          resetControlsTimeout();
        }}
      >
        {/* Fullscreen Top Bar with Safe Area & Telegram Clearance */}
        {isFullscreen && (
          <div className="fullscreen-top-bar">
            <button
              type="button"
              className="fullscreen-top-back-btn"
              onClick={toggleFullscreen}
              title="To'liq ekrandan chiqish"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="19" y1="12" x2="5" y2="12"></line>
                <polyline points="12 19 5 12 12 5"></polyline>
              </svg>
              <span>Chiqish</span>
            </button>

            {title && (
              <div className="fullscreen-top-title" title={title}>
                {title}
              </div>
            )}

            {/* Telegram Header clearance spacer to avoid covering native X and ... */}
            <div className="fullscreen-tg-spacer" />
          </div>
        )}

        {/* Single Center Play Button - ONLY displayed when video is paused */}
        {!isPlaying && (
          <div className="center-pause-action">
            <button
              type="button"
              className="center-single-play-btn"
              onClick={togglePlay}
              title="Ijro etish (Space yoki K)"
              aria-label="Ijro etish"
            >
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            </button>
          </div>
        )}

        {/* Bottom Controls Bar */}
        <div className="controls-bottom">
          <div className="progress-container">
            <div className="progress-track-bg">
              {/* Buffered progress track (yuklangan / kesh qismi) */}
              <div
                className="progress-buffered-bar"
                style={{ width: `${bufferedPercent}%` }}
              />
              {/* Played progress track */}
              <div
                className="progress-played-bar"
                style={{ width: `${(currentTime * 100) / (duration || 1)}%` }}
              />
            </div>
            <input
              type="range"
              min="0"
              max={duration || 100}
              step="any"
              value={currentTime}
              onChange={handleProgressChange}
              className="progress-slider"
              title="Vaqtni o'tkazish"
              aria-label="Vaqt o'tkazgich"
            />
          </div>

          <div className="bottom-row">
            <div className="bottom-left-group">
              <button
                type="button"
                className="control-btn bottom-play-btn"
                onClick={togglePlay}
                title={isPlaying ? "To'xtatish (Space yoki K)" : "Ijro etish (Space yoki K)"}
                aria-label={isPlaying ? "To'xtatish" : "Ijro etish"}
              >
                {isPlaying ? (
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </button>

              <span className="time-display">
                {formatSecondsToMMSS(currentTime)} / {formatSecondsToMMSS(duration)}
              </span>

              {/* Volume / Mute Control */}
              <div className="volume-control-wrap">
                <button
                  type="button"
                  className="control-btn volume-btn"
                  onClick={toggleMute}
                  title={isMuted ? "Ovozni yoqish (M)" : "Ovozni o'chirish (M)"}
                >
                  {isMuted || volume === 0 ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                      <line x1="23" y1="9" x2="17" y2="15"></line>
                      <line x1="17" y1="9" x2="23" y2="15"></line>
                    </svg>
                  ) : volume < 0.5 ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                      <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                      <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                    </svg>
                  )}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={isMuted ? 0 : volume}
                  onChange={(e) => handleVolumeChange(Number(e.target.value))}
                  className="volume-slider"
                  title="Ovoz balandligi"
                />
              </div>
            </div>

            <div className="bottom-right-actions">
              {/* Playback Speed Menu */}
              <div className="speed-dropdown-wrapper">
                <button
                  type="button"
                  className="control-btn speed-toggle-btn"
                  onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                  title="Ijro tezligi"
                >
                  <span>{playbackRate === 1 ? '1.0x' : `${playbackRate}x`}</span>
                </button>

                {showSpeedMenu && (
                  <div className="speed-menu-popover">
                    <div className="speed-menu-header">Tezlik</div>
                    {PLAYBACK_SPEEDS.map(rate => (
                      <button
                        key={rate}
                        type="button"
                        className={`speed-option-btn ${playbackRate === rate ? 'is-selected' : ''}`}
                        onClick={(e) => handleSpeedSelect(rate, e)}
                      >
                        <span>{rate}x</span>
                        {playbackRate === rate && <span className="speed-check">✓</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Subtitle Analysis Drawer button */}
              {onToggleAnalysis && (
                <button
                  type="button"
                  className={`control-btn analysis-btn ${isAnalysisOpen ? 'active' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleAnalysis();
                  }}
                  title="Subtitr tahlili"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                  </svg>
                  <span className="btn-label-text">Tahlil</span>
                </button>
              )}

              {/* AI Chat button */}
              {onOpenAiChat && (
                <button
                  type="button"
                  className="control-btn ai-chat-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenAiChat();
                  }}
                  title="AI Ustoz bilan tahlil va chat"
                >
                  <span className="ai-btn-sparkle">✨</span>
                  <span className="btn-label-text">AI Ustoz</span>
                </button>
              )}

              {/* Fullscreen toggle button */}
              <button
                type="button"
                className="control-btn fullscreen-btn"
                onClick={toggleFullscreen}
                title={isFullscreen ? "To'liq ekrandan chiqish (F)" : "To'liq ekran (F)"}
              >
                {isFullscreen ? (
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Overlay contents (Subtitles, YouTube-style drawer, etc.) with isolated pointer events */}
      <div className="video-custom-overlays" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
};

export default VideoPlayer;
