import React, { useState, useRef, useEffect } from 'react';
import './VideoPlayer.css';
import { formatSecondsToMMSS } from '../../../utils/timeUtils';

interface VideoPlayerProps {
  src: string;
  onTimeUpdate: (time: number) => void;
  onDurationChange?: (duration: number) => void;
  poster?: string;
  children?: React.ReactNode;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ src, onTimeUpdate, onDurationChange, poster, children }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);

  const controlsTimeoutRef = useRef<number | ReturnType<typeof setTimeout> | undefined>(undefined);

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current as any);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 2500);
  };

  useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current as any);
      }
    };
  }, []);

  const togglePlay = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
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
        setShowControls(true); // show controls when paused
        targetEndTimeRef.current = null; // cancel any segment play
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
        videoRef.current.play();
        setIsPlaying(true);
        targetEndTimeRef.current = endTime;
      }
    };
    window.addEventListener('play-segment', handlePlaySegment);
    return () => window.removeEventListener('play-segment', handlePlaySegment);
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

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(err => console.log(err));
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  return (
    <div 
      className={`custom-video-container ${isFullscreen ? 'fullscreen' : ''} ${showControls ? 'show-controls' : 'hide-controls'}`}
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isPlaying && setShowControls(false)}
      onClick={togglePlay}
    >
      <video
        ref={videoRef}
        src={src}
        className="video-element"
        poster={poster}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => setIsPlaying(false)}
      />

      <div className="video-controls">
        <div className="center-controls">
          <button className="center-btn skip-btn" onClick={skipBackward}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
              <text x="12" y="16" fontSize="8" fontWeight="bold" textAnchor="middle" fill="currentColor" strokeWidth="0">10</text>
            </svg>
          </button>
          
          <button className="center-btn play-btn" onClick={togglePlay}>
            {isPlaying ? (
               <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
            ) : (
               <svg viewBox="0 0 24 24" fill="currentColor" style={{marginLeft: '4px'}}><path d="M8 5v14l11-7z"/></svg>
            )}
          </button>

          <button className="center-btn skip-btn" onClick={skipForward}>
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
              {formatSecondsToMMSS(currentTime)}/{formatSecondsToMMSS(duration)}
            </span>
            <button className="control-btn fullscreen-btn" onClick={toggleFullscreen}>
              {isFullscreen ? (
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/></svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>
              )}
            </button>
          </div>
        </div>
      </div>
      
      {/* Overlay contents, rendered over video but below controls if configured properly */}
      {children}
    </div>
  );
};

export default VideoPlayer;
