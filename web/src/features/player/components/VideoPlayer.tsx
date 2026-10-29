import React, { useState, useRef, useEffect, useCallback } from 'react';
import './VideoPlayer.css';
import { formatSecondsToMMSS } from '../../../utils/timeUtils';

interface VideoPlayerProps {
  src: string;
  onTimeUpdate: (time: number) => void;
  onDurationChange?: (duration: number) => void;
  poster?: string;
  children?: React.ReactNode;
  onToggleAnalysis?: () => void;
  isAnalysisOpen?: boolean;
  onFullscreenChange?: (isFullscreen: boolean) => void;
  onOpenAiChat?: () => void;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({
  src,
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

  const controlsTimeoutRef = useRef<any>(null);

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 2800);
  };

  useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, []);

  const togglePlay = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play().catch(err => console.log('Playback error:', err));
      }
      setIsPlaying(!isPlaying);
    }
  };

  // Allow external components to pause the video (e.g. when subtitle is clicked)
  useEffect(() => {
    const handlePauseEvent = () => {
      if (videoRef.current) {
        videoRef.current.pause();
        setIsPlaying(false);
        setShowControls(true);
        targetEndTimeRef.current = null;
      }
    };
    window.addEventListener('pause-video', handlePauseEvent);
    return () => window.removeEventListener('pause-video', handlePauseEvent);
  }, []);

  const targetEndTimeRef = useRef<number | null>(null);

  useEffect(() => {
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

    window.addEventListener('play-segment', handlePlaySegment);
    window.addEventListener('seek-to-time', handleSeekToTime);
    return () => {
      window.removeEventListener('play-segment', handlePlaySegment);
      window.removeEventListener('seek-to-time', handleSeekToTime);
    };
  }, []);

  const skipForward = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (videoRef.current) {
      videoRef.current.currentTime = Math.min(videoRef.current.currentTime + 10, duration);
    }
  };

  const skipBackward = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(videoRef.current.currentTime - 10, 0);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const time = videoRef.current.currentTime;
      setCurrentTime(time);
      onTimeUpdate(time);
      
      if (targetEndTimeRef.current !== null && time >= targetEndTimeRef.current) {
         videoRef.current.pause();
         setIsPlaying(false);
         setShowControls(true);
         targetEndTimeRef.current = null;
      }
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
      if (onDurationChange) {
        onDurationChange(videoRef.current.duration);
      }
    }
  };

  const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = Number(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  // Fullscreen management supporting TMA, Native Fullscreen, and Mobile Landscape orientation
  const enterFullscreen = useCallback(async () => {
    try {
      // 1. Telegram WebApp Fullscreen if supported (TMA Bot API 8.0)
      const tg = (window as any).Telegram?.WebApp;
      if (tg) {
        tg.expand?.();
        if (typeof tg.requestFullscreen === 'function') {
          try { tg.requestFullscreen(); } catch (e) { /* fallback */ }
        }
      }

      // 2. Browser DOM Fullscreen
      const elem = containerRef.current;
      if (elem) {
        if (elem.requestFullscreen) {
          await elem.requestFullscreen().catch(() => {});
        } else if ((elem as any).webkitRequestFullscreen) {
          await (elem as any).webkitRequestFullscreen().catch(() => {});
        }
      }

      // 3. Screen orientation lock to landscape on mobile
      try {
        const orientation = screen.orientation as any;
        if (orientation && typeof orientation.lock === 'function') {
          await orientation.lock('landscape').catch(() => {});
        } else if ((screen as any).lockOrientation) {
          (screen as any).lockOrientation('landscape');
        }
      } catch (e) {
        // Ignored if device/browser doesn't permit orientation lock
      }
    } catch (err) {
      console.log('Error entering fullscreen:', err);
    }

    setIsFullscreen(true);
    if (onFullscreenChange) onFullscreenChange(true);
  }, [onFullscreenChange]);

  const exitFullscreen = useCallback(async () => {
    try {
      // 1. Telegram WebApp exit fullscreen
      const tg = (window as any).Telegram?.WebApp;
      if (tg && typeof tg.exitFullscreen === 'function') {
        try { tg.exitFullscreen(); } catch (e) { /* fallback */ }
      }

      // 2. Browser DOM exit fullscreen
      if (document.fullscreenElement) {
        await document.exitFullscreen().catch(() => {});
      } else if ((document as any).webkitFullscreenElement) {
        await (document as any).webkitExitFullscreen().catch(() => {});
      }

      // 3. Screen orientation unlock
      try {
        const orientation = screen.orientation as any;
        if (orientation && typeof orientation.unlock === 'function') {
          orientation.unlock();
        } else if ((screen as any).unlockOrientation) {
          (screen as any).unlockOrientation();
        }
      } catch (e) {
        // Ignored
      }
    } catch (err) {
      console.log('Error exiting fullscreen:', err);
    }

    setIsFullscreen(false);
    if (onFullscreenChange) onFullscreenChange(false);
  }, [onFullscreenChange]);

  const toggleFullscreen = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (isFullscreen) {
      exitFullscreen();
    } else {
      enterFullscreen();
    }
  };

  // Sync fullscreen state with DOM changes (e.g. user presses ESC key)
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
      onTouchStart={handleMouseMove}
      onMouseLeave={() => isPlaying && setShowControls(false)}
      onClick={togglePlay}
    >
      <video
        ref={videoRef}
        src={src}
        className="video-element"
        poster={poster}
        playsInline
        webkit-playsinline="true"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => setIsPlaying(false)}
      />

      <div className="video-controls">
        <div className="center-controls">
          <button className="center-btn skip-btn" onClick={skipBackward} title="10 soniya orqaga">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
              <text x="12" y="16" fontSize="8" fontWeight="bold" textAnchor="middle" fill="currentColor" strokeWidth="0">10</text>
            </svg>
          </button>
          
          <button className="center-btn play-btn" onClick={togglePlay} title={isPlaying ? "To'xtatish" : "Ijro etish"}>
            {isPlaying ? (
               <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
            ) : (
               <svg viewBox="0 0 24 24" fill="currentColor" style={{marginLeft: '4px'}}><path d="M8 5v14l11-7z"/></svg>
            )}
          </button>

          <button className="center-btn skip-btn" onClick={skipForward} title="10 soniya oldinga">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12a9 9 0 1 1-9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
              <path d="M21 3v5h-5" />
              <text x="12" y="16" fontSize="8" fontWeight="bold" textAnchor="middle" fill="currentColor" strokeWidth="0">10</text>
            </svg>
          </button>
        </div>

        <div className="controls-bottom" onClick={(e) => e.stopPropagation()}>
          <div className="progress-container">
            <input
              type="range"
              min="0"
              max={duration || 100}
              value={currentTime}
              onChange={handleProgressChange}
              className="progress-slider"
              style={{ backgroundSize: `${(currentTime * 100) / (duration || 1)}% 100%` }}
            />
          </div>
          <div className="bottom-row">
            <span className="time-display">
              {formatSecondsToMMSS(currentTime)} / {formatSecondsToMMSS(duration)}
            </span>

            <div className="bottom-right-actions" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {/* Tahlil (Analysis) toggle button */}
              {onToggleAnalysis && (
                <button
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

              {/* AI Chat quick button in video player controls */}
              {onOpenAiChat && (
                <button
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
                className="control-btn fullscreen-btn"
                onClick={toggleFullscreen}
                title={isFullscreen ? "To'liq ekrandan chiqish" : "To'liq ekran"}
              >
                {isFullscreen ? (
                  <svg viewBox="0 0 24 24" fill="currentColor"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/></svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Overlay contents (Subtitles, YouTube-style drawer, etc.) */}
      {children}
    </div>
  );
};

export default VideoPlayer;
