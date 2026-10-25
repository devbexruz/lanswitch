import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import VideoPlayer from '../features/player/components/VideoPlayer';
import CommentsSection from '../features/player/components/CommentsSection';
import { parseTimeSpanToSeconds, formatSecondsToMMSS } from '../utils/timeUtils';
import { useAuth } from '../context/AuthContext';
import { showTelegramBackButton, hideTelegramBackButton } from '../utils/telegram';
import './PlayerPage.css';

interface Episode {
  id: number;
  episodeNumber: number;
  title: string;
  videoUrl: string;
  durationalMinutes: number;
  thumbnailUrl?: string;
}

interface Media {
  id: number;
  title: string;
  description: string;
  videoUrl: string | null;
  isFilm: boolean;
  level?: string;
  durationalMinutes?: number;
  thumbnailUrl?: string;
  episodes?: Episode[];
}

interface Subtitle {
  id: number;
  text: string;
  startTimeSeconds: number;
  endTimeSeconds: number;
  index: number;
  words?: any[];
}

const PlayerPage: React.FC = () => {
  const { mediaId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const [media, setMedia] = useState<Media | null>(null);
  const [subtitles, setSubtitles] = useState<Subtitle[]>([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loading, setLoading] = useState(true);

  const [currentEpisodeId, setCurrentEpisodeId] = useState<number | null>(null);
  const [videoUrl, setVideoUrl] = useState<string>('');

  // Subtitle selection & Fullscreen drawer state
  const [selectedSubtitleIndex, setSelectedSubtitleIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isFullscreenDrawerOpen, setIsFullscreenDrawerOpen] = useState(false);
  const [subSearchQuery, setSubSearchQuery] = useState('');

  // Mobile detection (screen width <= 768px)
  const [isMobile, setIsMobile] = useState<boolean>(() => 
    typeof window !== 'undefined' ? window.innerWidth <= 768 : false
  );

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Telegram Native BackButton handling
  useEffect(() => {
    showTelegramBackButton(() => {
      if (window.history.length > 1) {
        navigate(-1);
      } else {
        navigate('/student');
      }
    });

    return () => {
      hideTelegramBackButton();
    };
  }, [navigate]);

  // Translation Tooltip state
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    text: string;
    meaning: string | null;
  }>({ visible: false, x: 0, y: 0, text: '', meaning: null });

  const lastHeartbeatTimeRef = useRef<number>(0);
  const hasCompletedRef = useRef<boolean>(false);
  const timeoutRef = useRef<any>(null);
  const isUserBrowsingSubsRef = useRef<boolean>(false);
  const browsingTimeoutRef = useRef<any>(null);
  const activeSubScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const mediaRes = await fetch(`/api/media/${mediaId}`);
        if (mediaRes.ok) {
          const found = await mediaRes.json();
          setMedia(found);

          let targetEpisodeId: number | null = null;

          if (!found.isFilm) {
            const params = new URLSearchParams(location.search);
            const epParam = params.get('episodeId');
            if (epParam) {
              targetEpisodeId = Number(epParam);
            } else if (found.episodes && found.episodes.length > 0) {
              targetEpisodeId = found.episodes[0].id;

              if (user) {
                const histRes = await fetch(`/api/watchhistory/continue-watching/${user.id}`);
                if (histRes.ok) {
                  const hist = await histRes.json();
                  const mediaHist = hist.find((h: any) => h.mediaId === found.id);
                  if (mediaHist && mediaHist.episodeId) {
                    targetEpisodeId = mediaHist.episodeId;
                  }
                }
              }
            }
            setCurrentEpisodeId(targetEpisodeId);

            if (targetEpisodeId) {
              const ep = found.episodes?.find((e: Episode) => e.id === targetEpisodeId);
              if (ep) setVideoUrl(ep.videoUrl);
            }
          } else {
            setVideoUrl(found.videoUrl || '');
          }

          // Fetch Subtitles
          const subUrl = targetEpisodeId
            ? `/api/subtitle?episodeId=${targetEpisodeId}`
            : `/api/subtitle?mediaId=${mediaId}`;

          const subRes = await fetch(subUrl);
          if (subRes.ok) {
            const subData = await subRes.json();
            const formattedSubs = subData.map((s: any) => ({
              id: s.id,
              text: s.text,
              index: s.index,
              startTimeSeconds: parseTimeSpanToSeconds(s.startTime),
              endTimeSeconds: parseTimeSpanToSeconds(s.endTime),
              words: s.words || []
            }));
            setSubtitles(formattedSubs);
          }
        }
      } catch (err) {
        console.error('Error fetching media:', err);
      } finally {
        setLoading(false);
      }
    };

    if (mediaId) {
      fetchData();
    }
  }, [mediaId, location.search, user]);

  const sendHeartbeat = async (time: number, isCompleted: boolean) => {
    try {
      await fetch('/api/watchhistory/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.id || 1,
          mediaId: Number(mediaId),
          episodeId: currentEpisodeId,
          currentTimeSeconds: Math.floor(time),
          isCompleted
        })
      });
    } catch (e) {
      console.error('Failed to send heartbeat', e);
    }
  };

  // Track active subtitle based on currentTime
  const activeSubtitles = useMemo(() => {
    return subtitles.filter(
      (sub) => currentTime >= sub.startTimeSeconds && currentTime <= Math.max(sub.endTimeSeconds, sub.startTimeSeconds + 2.5)
    );
  }, [subtitles, currentTime]);

  const activeSubtitleIndex = useMemo(() => {
    return activeSubtitles.length > 0
      ? subtitles.findIndex(s => s.id === activeSubtitles[0].id)
      : -1;
  }, [activeSubtitles, subtitles]);

  // Sync selected subtitle with current video playback unless user is actively browsing
  useEffect(() => {
    if (activeSubtitleIndex !== -1 && !isUserBrowsingSubsRef.current) {
      setSelectedSubtitleIndex(activeSubtitleIndex);
    }
  }, [activeSubtitleIndex]);

  const handleTimeUpdate = (time: number) => {
    setCurrentTime(time);

    // Heartbeat every 20 seconds
    if (Math.abs(time - lastHeartbeatTimeRef.current) >= 20) {
      lastHeartbeatTimeRef.current = time;
      sendHeartbeat(time, false);
    }

    // Auto-complete if within 20 seconds of the end
    if (duration > 0 && time >= duration - 20 && !hasCompletedRef.current) {
      hasCompletedRef.current = true;
      sendHeartbeat(time, true);
    }
  };

  const handleWordClick = async (e: React.MouseEvent, word: string) => {
    e.stopPropagation();
    e.preventDefault();

    const cleanWord = word.replace(/[.,/#!$%^&*;:{}=\-_`~()?"'’]/g, "").trim();
    if (!cleanWord) return;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    const targetEl = e.currentTarget as HTMLElement;
    const rect = targetEl ? targetEl.getBoundingClientRect() : null;

    let posX = e.clientX || window.innerWidth / 2;
    let posY = (e.clientY ? e.clientY - 45 : 100);

    if (rect) {
      posX = Math.min(Math.max(16, rect.left + rect.width / 2), window.innerWidth - 140);
      posY = Math.max(16, rect.top - 46);
    }

    setContextMenu({ visible: true, x: posX, y: posY, text: cleanWord, meaning: null });

    try {
      const res = await fetch(`/api/word/translate?text=${encodeURIComponent(cleanWord)}`);
      if (res.ok) {
        const data = await res.json();
        setContextMenu(prev => ({ ...prev, meaning: data.translation }));
      } else {
        setContextMenu(prev => ({ ...prev, meaning: "Tarjima topilmadi" }));
      }
    } catch {
      setContextMenu(prev => ({ ...prev, meaning: "Tarjima topilmadi" }));
    } finally {
      timeoutRef.current = setTimeout(() => {
        setContextMenu(prev => ({ ...prev, visible: false }));
      }, 4000);
    }
  };

  const closeContextMenu = () => {
    if (contextMenu.visible) {
      setContextMenu(prev => ({ ...prev, visible: false }));
    }
  };

  const handleSelectSubtitle = (index: number) => {
    if (index < 0 || index >= subtitles.length) return;
    setSelectedSubtitleIndex(index);
    isUserBrowsingSubsRef.current = true;

    if (browsingTimeoutRef.current) clearTimeout(browsingTimeoutRef.current);
    browsingTimeoutRef.current = setTimeout(() => {
      isUserBrowsingSubsRef.current = false;
    }, 12000);
  };

  const handlePlaySubtitleSegment = (sub: Subtitle) => {
    window.dispatchEvent(new CustomEvent('play-segment', {
      detail: {
        startTime: sub.startTimeSeconds,
        endTime: sub.endTimeSeconds + 0.4
      }
    }));
  };

  const handleSeekToSubtitle = (sub: Subtitle) => {
    window.dispatchEvent(new CustomEvent('seek-to-time', {
      detail: {
        time: sub.startTimeSeconds
      }
    }));
  };

  const handleSubtitleOverlayClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isFullscreen) {
      setIsFullscreenDrawerOpen(prev => !prev);
    }
  };

  const currentSub = subtitles[selectedSubtitleIndex] || (subtitles.length > 0 ? subtitles[0] : null);

  // Filtered subtitles for transcript search
  const filteredSubtitles = useMemo(() => {
    if (!subSearchQuery.trim()) return subtitles;
    const q = subSearchQuery.toLowerCase();
    return subtitles.filter(s => s.text.toLowerCase().includes(q));
  }, [subtitles, subSearchQuery]);

  // Current Episode Details
  const currentEpisode = useMemo(() => {
    if (!media || media.isFilm || !media.episodes) return null;
    return media.episodes.find(e => e.id === currentEpisodeId) || media.episodes[0] || null;
  }, [media, currentEpisodeId]);

  const currentIndex = media?.episodes?.findIndex(ep => ep.id === currentEpisodeId) ?? -1;
  const prevEpisode = media?.episodes?.[currentIndex - 1];
  const nextEpisode = media?.episodes?.[currentIndex + 1];

  const handleSwitchEpisode = (episodeId: number) => {
    setCurrentEpisodeId(episodeId);
    navigate(`/player/${media?.id}?episodeId=${episodeId}`, { replace: true });
  };

  /**
   * Subtitle Analysis Panel Body (Focused, clean without clutter)
   */
  const renderAnalysisBody = (isDrawer = false) => {
    return (
      <div className={`analysis-body-content ${isDrawer ? 'drawer-mode' : ''}`}>
        {/* Active / Selected Subtitle Focus Card */}
        <div className="current-sub-box">
          <div className="sub-box-header">
            <span className="sub-box-badge">
              {currentSub ? `${selectedSubtitleIndex + 1} / ${subtitles.length}` : 'Subtitr'}
            </span>
            <div className="sub-nav-btns">
              <button
                className="sub-nav-arrow"
                disabled={selectedSubtitleIndex <= 0}
                onClick={() => handleSelectSubtitle(selectedSubtitleIndex - 1)}
                title="Oldingi gap"
              >
                ◀
              </button>
              {currentSub && (
                <button
                  className="sub-play-btn"
                  onClick={() => handlePlaySubtitleSegment(currentSub)}
                  title="Ushbu gapni qayta tinglash"
                >
                  ▶ Tinglash
                </button>
              )}
              <button
                className="sub-nav-arrow"
                disabled={selectedSubtitleIndex >= subtitles.length - 1}
                onClick={() => handleSelectSubtitle(selectedSubtitleIndex + 1)}
                title="Keyingi gap"
              >
                ▶
              </button>
            </div>
          </div>

          <div className="current-sub-text">
            {currentSub ? (
              currentSub.text.split(' ').map((w, i) => (
                <span
                  key={i}
                  className="subtitleWord clickable-word"
                  onClick={(e) => handleWordClick(e, w)}
                  onContextMenu={(e) => handleWordClick(e, w)}
                  title="So'z tarjimasi uchun bosing"
                >
                  {w}{' '}
                </span>
              ))
            ) : (
              <span style={{ opacity: 0.6 }}>Subtitrlar mavjud emas</span>
            )}
          </div>
          <div className="sub-hint-text">
            💡 So'zlar ustiga bosib tarjimasini ko'rishingiz mumkin
          </div>
        </div>

        {/* Subtitles Transcript Section */}
        <div className="transcript-section">
          <div className="transcript-header-row">
            <div className="transcript-title">
              <span>📋 Dialoglar matni</span>
              <span className="transcript-count">{subtitles.length} ta</span>
            </div>

            {subtitles.length > 5 && (
              <div className="sub-search-input-wrap">
                <input
                  type="text"
                  placeholder="Matndan qidirish..."
                  value={subSearchQuery}
                  onChange={(e) => setSubSearchQuery(e.target.value)}
                  className="sub-search-input"
                />
                {subSearchQuery && (
                  <button className="sub-search-clear" onClick={() => setSubSearchQuery('')}>
                    ✕
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="transcript-list-scroll" ref={activeSubScrollRef}>
            {filteredSubtitles.length === 0 ? (
              <div className="transcript-empty">Hech qanday subtitr topilmadi</div>
            ) : (
              filteredSubtitles.map((sub, idx) => {
                const isActive = activeSubtitleIndex !== -1 && subtitles[activeSubtitleIndex]?.id === sub.id;
                const isSelected = subtitles[selectedSubtitleIndex]?.id === sub.id;

                return (
                  <div
                    key={sub.id || idx}
                    className={`transcript-item ${isActive ? 'is-active-line' : ''} ${isSelected ? 'is-selected-line' : ''}`}
                    onClick={() => {
                      const realIndex = subtitles.findIndex(s => s.id === sub.id);
                      if (realIndex !== -1) handleSelectSubtitle(realIndex);
                      handleSeekToSubtitle(sub);
                    }}
                  >
                    <div className="transcript-time-badge">
                      {formatSecondsToMMSS(sub.startTimeSeconds)}
                    </div>
                    <div className="transcript-text">
                      {sub.text.split(' ').map((w, wi) => (
                        <span
                          key={wi}
                          className="clickable-sub-word"
                          onClick={(e) => handleWordClick(e, w)}
                        >
                          {w}{' '}
                        </span>
                      ))}
                    </div>
                    <button
                      className="transcript-play-btn"
                      title="Shu daqiqadan o'ynatish"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSeekToSubtitle(sub);
                      }}
                    >
                      ▶
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="player-loading-container">
        <div className="player-loading-spinner"></div>
        <p>Kino yuklanmoqda...</p>
      </div>
    );
  }

  if (!media) {
    return (
      <div className="player-error-container">
        <h3>Film yoki serial topilmadi</h3>
        <button onClick={() => navigate(-1)} className="btn-return">
          Ortga qaytish
        </button>
      </div>
    );
  }

  // Condition to render subtitle overlay inside video:
  // When mobile and NOT fullscreen: do NOT render inside player (as requested by user).
  // In fullscreen or on desktop: DO render.
  const shouldShowVideoSubtitles = (isFullscreen || !isMobile) && activeSubtitles.length > 0;

  return (
    <div className="player-page-root" onClick={closeContextMenu}>
      {/* Top Header Bar with Clean Back Button and Title */}
      <header className="player-system-top-bar">
        <button
          className="player-back-nav-btn"
          onClick={() => {
            if (window.history.length > 1) {
              navigate(-1);
            } else {
              navigate('/student');
            }
          }}
          title="Ortga qaytish"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="back-arrow-icon">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
          <span>Ortga</span>
        </button>

        <div className="player-header-title-box">
          <h1 className="player-media-title">{media.title}</h1>
          {!media.isFilm && currentEpisode && (
            <span className="player-episode-badge">
              {currentEpisode.episodeNumber}-qism: {currentEpisode.title}
            </span>
          )}
          {media.level && (
            <span className="player-level-badge">{media.level}</span>
          )}
        </div>
      </header>

      {/* Main Container */}
      <main className="player-layout-container">
        {/* Video Player Column */}
        <section className="player-video-section">
          <div className="video-player-frame">
            <VideoPlayer
              src={videoUrl}
              poster={media.thumbnailUrl}
              onTimeUpdate={handleTimeUpdate}
              onDurationChange={setDuration}
              onToggleAnalysis={() => setIsFullscreenDrawerOpen(prev => !prev)}
              isAnalysisOpen={isFullscreenDrawerOpen}
              onFullscreenChange={setIsFullscreen}
            >
              {/* Subtitles Overlay inside Video (Hidden on mobile non-fullscreen) */}
              {shouldShowVideoSubtitles && (
                <div className="video-subtitle-overlay" onClick={handleSubtitleOverlayClick}>
                  <div className="subtitle-stack">
                    {activeSubtitles.map((activeSub) => (
                      <div key={activeSub.id} className="video-subtitle-text subtitle-animate">
                        {activeSub.text.split(' ').map((w, i) => (
                          <span
                            key={i}
                            className="subtitleWord"
                            onClick={(e) => handleWordClick(e, w)}
                            onContextMenu={(e) => handleWordClick(e, w)}
                            title="So'z tarjimasi"
                          >
                            {w}{' '}
                          </span>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Floating Translation Tooltip */}
              {contextMenu.visible && (
                <div
                  className="player-translation-tooltip"
                  style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
                >
                  <span className="tooltip-word">{contextMenu.text}</span>
                  <span className="tooltip-sep">—</span>
                  <span className="tooltip-meaning">{contextMenu.meaning || "Izlanmoqda..."}</span>
                </div>
              )}

              {/* Fullscreen YouTube-Style Subtitles Drawer */}
              {isFullscreen && isFullscreenDrawerOpen && (
                <>
                  <div
                    className="player-drawer-backdrop"
                    onClick={() => setIsFullscreenDrawerOpen(false)}
                  />
                  <div className="player-fullscreen-drawer animate-slide-left">
                    <div className="drawer-header">
                      <div className="drawer-title-group">
                        <span className="drawer-eyebrow">Tahlil</span>
                        <h3 className="drawer-title">Subtitrlar</h3>
                      </div>
                      <button
                        className="drawer-close-btn"
                        onClick={() => setIsFullscreenDrawerOpen(false)}
                        title="Yopish"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="drawer-scroll-body">
                      {renderAnalysisBody(true)}
                    </div>
                  </div>
                </>
              )}
            </VideoPlayer>
          </div>

          {/* Episodes List (Right below Video on both mobile and desktop if multiple episodes exist) */}
          {!media.isFilm && media.episodes && media.episodes.length > 1 && (
            <div className="player-episodes-panel">
              <div className="episodes-panel-header">
                <div className="episodes-title-wrap">
                  <h3>🎬 Qismlar</h3>
                  <span className="episodes-count-pill">{media.episodes.length} ta qism</span>
                </div>

                <div className="episodes-quick-nav">
                  <button
                    className="ep-nav-btn"
                    disabled={!prevEpisode}
                    onClick={() => prevEpisode && handleSwitchEpisode(prevEpisode.id)}
                    title="Oldingi qism"
                  >
                    ◀ Oldingi
                  </button>
                  <button
                    className="ep-nav-btn"
                    disabled={!nextEpisode}
                    onClick={() => nextEpisode && handleSwitchEpisode(nextEpisode.id)}
                    title="Keyingi qism"
                  >
                    Keyingi ▶
                  </button>
                </div>
              </div>

              <div className="episodes-scroll-track">
                {media.episodes.map(ep => {
                  const isActive = ep.id === currentEpisodeId;
                  return (
                    <button
                      key={ep.id}
                      className={`episode-chip-card ${isActive ? 'is-active-ep' : ''}`}
                      onClick={() => handleSwitchEpisode(ep.id)}
                    >
                      <div className="episode-thumb-box">
                        <img
                          src={ep.thumbnailUrl || media.thumbnailUrl || "https://images.unsplash.com/photo-1440404653325-ab127d49abc1?auto=format&fit=crop&w=400&q=80"}
                          alt={ep.title}
                        />
                        {isActive && <div className="now-playing-pill">Ijroda</div>}
                      </div>
                      <div className="episode-meta-text">
                        <span className="ep-num-label">{ep.episodeNumber}-qism</span>
                        <span className="ep-title-label">{ep.title}</span>
                        {ep.durationalMinutes > 0 && (
                          <span className="ep-duration-label">{ep.durationalMinutes} daq</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* On Mobile: Subtitle Analysis comes RIGHT AFTER episodes and BEFORE description */}
          {isMobile && (
            <div className="player-mobile-analysis-card">
              <div className="analysis-card-title">
                <h3>📝 Subtitr tahlili</h3>
              </div>
              {renderAnalysisBody(false)}
            </div>
          )}

          {/* Media Description (Tavsif) */}
          <div className="player-details-card">
            <div className="details-header">
              <h3>ℹ️ Tavsif</h3>
              <div className="details-badges">
                {media.isFilm ? (
                  <span className="badge-film">Film</span>
                ) : (
                  <span className="badge-serial">Serial</span>
                )}
                {media.durationalMinutes && media.durationalMinutes > 0 && (
                  <span className="badge-duration">{media.durationalMinutes} daqiqa</span>
                )}
              </div>
            </div>
            <p className="details-description-text">{media.description || "Ushbu film uchun batafsil tavsif kiritilmagan."}</p>
          </div>

          {/* Comments Section */}
          <div className="player-comments-wrapper">
            <CommentsSection mediaId={media.id} />
          </div>
        </section>

        {/* Desktop Side Analysis Column (Hidden on mobile because it's rendered inline above) */}
        {!isMobile && (
          <aside className="player-desktop-side-panel">
            <div className="side-panel-header">
              <span className="side-panel-eyebrow">Jonli Tahlil</span>
              <h3 className="side-panel-title">Subtitrlar</h3>
            </div>
            {renderAnalysisBody(false)}
          </aside>
        )}
      </main>
    </div>
  );
};

export default PlayerPage;
