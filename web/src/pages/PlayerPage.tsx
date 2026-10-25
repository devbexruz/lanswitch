import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import VideoPlayer from '../features/player/components/VideoPlayer';
import CommentsSection from '../features/player/components/CommentsSection';
import { parseTimeSpanToSeconds } from '../utils/timeUtils';
import { useAuth } from '../context/AuthContext';
import ReactMarkdown from 'react-markdown';
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
  thumbnailUrl?: string;
  episodes?: Episode[];
}

interface Subtitle {
  id: number;
  text: string;
  startTimeSeconds: number;
  endTimeSeconds: number;
  index: number;
  gaps?: any[];
  words?: any[];
}

const PlayerPage: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(true);
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
  const [mediaType, setMediaType] = useState<'film' | 'serial'>('film');
  const [chatMessages, setChatMessages] = useState<any[]>([]);

  // Subtitle selection & Analysis tab state
  const [selectedSubtitleIndex, setSelectedSubtitleIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<'qoidalar' | 'sozlar' | 'ai'>('qoidalar');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isFullscreenDrawerOpen, setIsFullscreenDrawerOpen] = useState(false);

  // Context menu for translation
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

  // AI Chat state
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const drawerChatScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const mediaRes = await fetch(`/api/media/${mediaId}`);
        if (mediaRes.ok) {
          const found = await mediaRes.json();
          setMedia(found);
          setMediaType(found.isFilm ? 'film' : 'serial');

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
              gaps: s.gaps || [],
              words: s.words || []
            }));
            setSubtitles(formattedSubs);
          }

          // Get Chat Session
          if (!targetEpisodeId) {
            const chatRes = await fetch(`/api/MediaChat/media/${mediaId}`);
            if (chatRes.ok) {
              setChatMessages(await chatRes.json());
            }
          } else {
            const chatRes = await fetch(`/api/EpisodeChat/episode/${targetEpisodeId}`);
            if (chatRes.ok) {
              setChatMessages(await chatRes.json());
            }
          }
        }
      } catch (err) {
        console.error(err);
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
      (sub) => currentTime >= sub.startTimeSeconds && currentTime <= Math.max(sub.endTimeSeconds, sub.startTimeSeconds + 3.0)
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

  const handleSendChatMessage = async () => {
    if (!chatInput.trim() || !media) return;

    const message = chatInput;
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'User', content: message }]);
    setIsChatLoading(true);

    try {
      const endpoint = mediaType === 'film' ? '/api/MediaChat' : '/api/EpisodeChat';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          episodeId: currentEpisodeId || (media.episodes && media.episodes.length > 0 ? media.episodes[0].id : 0),
          subtitleId: subtitles[selectedSubtitleIndex]?.id,
          mediaId: media.id,
          message: message
        })
      });

      if (res.ok) {
        const data = await res.json();
        setChatMessages(prev => [...prev, { role: 'AI', content: data.response }]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsChatLoading(false);
      setTimeout(() => {
        if (chatScrollRef.current) {
          chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
        }
        if (drawerChatScrollRef.current) {
          drawerChatScrollRef.current.scrollTop = drawerChatScrollRef.current.scrollHeight;
        }
      }, 100);
    }
  };

  const handleWordRightClick = async (e: React.MouseEvent, word: string) => {
    e.preventDefault();
    e.stopPropagation();

    const cleanWord = word.replace(/[^a-zA-Zа-яА-ЯёЁ']/g, '');
    if (!cleanWord) return;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    setContextMenu({ visible: true, x: e.clientX, y: e.clientY - 40, text: cleanWord, meaning: null });

    try {
      const res = await fetch(`/api/word/translate?text=${encodeURIComponent(cleanWord)}`);
      if (res.ok) {
        const data = await res.json();
        setContextMenu(prev => ({ ...prev, meaning: data.translation }));
      } else {
        setContextMenu(prev => ({ ...prev, meaning: "Topilmadi" }));
      }
    } catch (error) {
      setContextMenu(prev => ({ ...prev, meaning: "Xatolik yuz berdi" }));
    } finally {
      timeoutRef.current = setTimeout(() => {
        setContextMenu(prev => ({ ...prev, visible: false }));
      }, 3500);
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
    }, 15000); // 15 seconds after user manual interaction, resume auto-following
  };

  const handlePlaySubtitleSegment = (sub: Subtitle) => {
    window.dispatchEvent(new CustomEvent('play-segment', {
      detail: {
        startTime: sub.startTimeSeconds,
        endTime: sub.endTimeSeconds + 0.5
      }
    }));
  };

  const handleSubtitleOverlayClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isFullscreen) {
      setIsFullscreenDrawerOpen(true);
    }
  };

  const handleNextEpisode = () => {
    if (media && !media.isFilm && media.episodes) {
      const currentIndex = media.episodes.findIndex(e => e.id === currentEpisodeId);
      if (currentIndex !== -1 && currentIndex < media.episodes.length - 1) {
        navigate(`/player/${media.id}?episodeId=${media.episodes[currentIndex + 1].id}`);
      }
    }
  };

  if (loading) {
    return <div className="player-loading">Yuklanmoqda...</div>;
  }

  if (!media) {
    return (
      <div className="player-error">
        <h2>Video topilmadi</h2>
        <button onClick={() => navigate('/movies')}>Ortga qaytish</button>
      </div>
    );
  }

  const currentSub = subtitles[selectedSubtitleIndex];
  const isNearEnd = duration > 0 && currentTime >= duration - 20;
  const hasNextEpisode = !media.isFilm && media.episodes && media.episodes.findIndex(e => e.id === currentEpisodeId) < media.episodes.length - 1;

  // Shared Subtitle Analysis Content Component
  const renderAnalysisBody = (inDrawer: boolean = false) => {
    return (
      <div className="analysis-inner-container">
        {/* Selected Subtitle Box */}
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
                  title="Ushbu gapni qayta eshitish"
                >
                  ▶ Eshitish
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
                  onClick={(e) => handleWordRightClick(e, w)}
                  onContextMenu={(e) => handleWordRightClick(e, w)}
                  title="Tarjimasini ko'rish uchun bosing"
                >
                  {w}{' '}
                </span>
              ))
            ) : (
              <span style={{ opacity: 0.6 }}>Subtitr mavjud emas</span>
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="analysis-tabs">
          <button
            className={`analysis-tab ${activeTab === 'qoidalar' ? 'active' : ''}`}
            onClick={() => setActiveTab('qoidalar')}
          >
            📖 Qoidalar
          </button>
          <button
            className={`analysis-tab ${activeTab === 'sozlar' ? 'active' : ''}`}
            onClick={() => setActiveTab('sozlar')}
          >
            📝 So'zlar
          </button>
          <button
            className={`analysis-tab ${activeTab === 'ai' ? 'active' : ''}`}
            onClick={() => setActiveTab('ai')}
          >
            🤖 AI Ustoz
          </button>
        </div>

        {/* Tab Content */}
        <div className="analysis-content-area">
          {activeTab === 'qoidalar' && (
            <div className="rules-content animate-fade-in">
              {currentSub?.gaps && currentSub.gaps.length > 0 ? (
                currentSub.gaps.map((gap: any) => (
                  <div key={gap.id} className="grammar-card">
                    <h4 className="grammar-gap-title">🎯 {gap.text}</h4>
                    <div className="grammar-analysis-markdown">
                      <ReactMarkdown>{gap.aiAnalysis || "Ushbu ibora grammatikasi tahlil qilinmoqda..."}</ReactMarkdown>
                    </div>
                  </div>
                ))
              ) : (
                <div className="empty-analysis-state">
                  <div className="empty-icon">📖</div>
                  <h4>Grammatik tahlil</h4>
                  <p>
                    Ushbu subtitr uchun maxsus grammatik qoida biriktirilmagan.
                    Iboralar va zamonlar haqida <strong>"AI Ustoz"</strong> tabida to'liq so'rashingiz mumkin!
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'sozlar' && (
            <div className="words-content animate-fade-in">
              {currentSub?.words && currentSub.words.length > 0 ? (
                <div className="words-chips-grid">
                  {currentSub.words.map((w: any, idx: number) => (
                    <div key={idx} className="word-card-chip">
                      <span className="word-chip-original">{w.text}</span>
                      {w.translation && (
                        <span className="word-chip-trans">— {w.translation}</span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-analysis-state">
                  <div className="empty-icon">📝</div>
                  <h4>So'zlar ro'yxati</h4>
                  <p>
                    Yuqoridagi har qanday so'zni ustiga bossangiz, uning tarjimasini ko'rishingiz mumkin!
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'ai' && (
            <div className="ai-chat-container animate-fade-in">
              <div
                className="ai-messages-scroll"
                ref={inDrawer ? drawerChatScrollRef : chatScrollRef}
              >
                {chatMessages.length === 0 && (
                  <div className="empty-chat-state">
                    <div className="empty-icon">🤖</div>
                    <h4>AI Ustoz yordamga tayyor</h4>
                    <p>Ushbu videodagi yangi so'zlar, iboralar yoki grammatika haqida savol bering!</p>
                  </div>
                )}
                {chatMessages.map((msg, i) => (
                  <div key={i} className={`ai-message-row ${msg.role === 'User' ? 'user-side' : 'ai-side'}`}>
                    <div className={`ai-message-bubble ${msg.role === 'User' ? 'user-bubble' : 'ai-bubble'}`}>
                      {msg.role === 'User' ? msg.content : <ReactMarkdown>{msg.content}</ReactMarkdown>}
                    </div>
                  </div>
                ))}
                {isChatLoading && (
                  <div className="ai-message-row ai-side">
                    <div className="ai-message-bubble ai-bubble loading-dots">
                      <span>•</span><span>•</span><span>•</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="ai-input-wrap">
                <input
                  type="text"
                  className="ai-input-field"
                  placeholder="AI ga savol bering..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendChatMessage()}
                />
                <button
                  className="ai-send-btn"
                  onClick={handleSendChatMessage}
                  disabled={isChatLoading || !chatInput.trim()}
                >
                  Jo'natish
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="player-page-container" onClick={closeContextMenu}>
      <div className="player-main-layout">
        {/* Top Header Bar */}
        <div className="player-top-bar">
          <button className="player-back-btn" onClick={() => navigate(-1)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '18px', height: '18px' }}>
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
            Ortga
          </button>
          <h2 className="player-title">
            {media.title}
            {!media.isFilm && currentEpisodeId && (
              <span className="episode-title-badge">
                - {media.episodes?.find(e => e.id === currentEpisodeId)?.episodeNumber}-qism
              </span>
            )}
          </h2>
        </div>

        {/* Main Content: Desktop Side-by-Side / Mobile Vertical */}
        <div className="player-content-wrapper">
          {/* Left Column: Video Player + Episodes List */}
          <div className="player-video-column">
            <div className="video-section">
              <VideoPlayer
                src={videoUrl}
                onTimeUpdate={handleTimeUpdate}
                onDurationChange={setDuration}
                onToggleAnalysis={() => setIsFullscreenDrawerOpen(prev => !prev)}
                isAnalysisOpen={isFullscreenDrawerOpen}
                onFullscreenChange={setIsFullscreen}
              >
                {/* Active Subtitle Overlay on Video */}
                {activeSubtitles.length > 0 && (
                  <div className="video-subtitle-overlay" onClick={handleSubtitleOverlayClick}>
                    <div className="subtitle-stack">
                      {activeSubtitles.map((activeSub) => (
                        <div key={activeSub.id} className="video-subtitle-text subtitle-animate">
                          {activeSub.text.split(' ').map((w, i) => (
                            <span
                              key={i}
                              className="subtitleWord"
                              onClick={(e) => handleWordRightClick(e, w)}
                              onContextMenu={(e) => handleWordRightClick(e, w)}
                              title="Tarjimasini ko'rish uchun bosing"
                            >
                              {w}{' '}
                            </span>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Translation Context Tooltip */}
                {contextMenu.visible && (
                  <div
                    className="player-translation-tooltip"
                    style={{ top: contextMenu.y, left: contextMenu.x }}
                  >
                    <strong style={{ color: '#60a5fa' }}>{contextMenu.text}</strong> — {contextMenu.meaning || "Izlanmoqda..."}
                  </div>
                )}

                {/* Video Ending Action Overlay */}
                {isNearEnd && (
                  <div className="player-ending-overlay">
                    {hasNextEpisode ? (
                      <button className="btn btn-primary ending-btn" onClick={handleNextEpisode}>
                        Keyingi qism ⏭
                      </button>
                    ) : (
                      <button className="btn btn-glass ending-btn" onClick={() => window.location.reload()}>
                        Qayta ko'rish 🔄
                      </button>
                    )}
                  </div>
                )}

                {/* YouTube-style Fullscreen Slide-in Drawer */}
                {isFullscreen && (
                  <>
                    <div
                      className={`player-drawer-backdrop ${isFullscreenDrawerOpen ? 'active' : ''}`}
                      onClick={() => setIsFullscreenDrawerOpen(false)}
                    />
                    <div
                      className={`player-fullscreen-drawer ${isFullscreenDrawerOpen ? 'open' : ''}`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="drawer-header">
                        <div className="drawer-title-wrap">
                          <span className="drawer-badge">YouTube uslubida</span>
                          <h3 className="drawer-title">📖 Subtitr Tahlili</h3>
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

            {/* Serial Episodes List under Video (if serial) */}
            {!media.isFilm && media.episodes && (
              <div className="player-episodes-under-video glass-panel">
                <div className="episodes-header-row">
                  <h3 className="episodes-title">Qismlar ({media.episodes.length} ta)</h3>
                  <button
                    className="episodes-toggle-btn"
                    onClick={() => setIsExpanded(!isExpanded)}
                  >
                    {isExpanded ? "Yashirish ▲" : "Ko'rsatish ▼"}
                  </button>
                </div>

                {isExpanded && (
                  <div className="episodes-scroll-list">
                    {media.episodes.map(ep => {
                      const isActive = ep.id === currentEpisodeId;
                      return (
                        <button
                          key={ep.id}
                          className={`episode-card-item ${isActive ? 'active' : ''}`}
                          onClick={() => navigate(`/player/${media.id}?episodeId=${ep.id}`)}
                        >
                          <div className="episode-thumbnail-wrap">
                            <img
                              src={ep.thumbnailUrl || media.thumbnailUrl || "https://images.unsplash.com/photo-1440404653325-ab127d49abc1?auto=format&fit=crop&w=400&q=80"}
                              alt={ep.title}
                            />
                            {isActive && <div className="now-playing-badge">Ijroda</div>}
                          </div>
                          <div className="episode-info-meta">
                            <span className="episode-meta-num">{ep.episodeNumber}-qism</span>
                            <span className="episode-meta-title">{ep.title}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Media Description and Comments */}
            <div className="player-details-section">
              <div className="media-description glass-panel">
                <h3>Tavsif</h3>
                <p>{media.description}</p>
              </div>
              <CommentsSection mediaId={media.id} />
            </div>
          </div>

          {/* Right Column: Subtitle Analysis Panel (Desktop: side-by-side / Mobile: below video) */}
          <div className="player-side-analysis-panel">
            <div className="analysis-panel-header">
              <div className="analysis-title-group">
                <span className="analysis-eyebrow">Jonli Tahlil</span>
                <h3 className="analysis-panel-title">Subtitr va Grammatika</h3>
              </div>
            </div>
            {renderAnalysisBody(false)}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlayerPage;
