import React, { useEffect, useState, useRef } from 'react';
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

  const [contextMenu, setContextMenu] = useState<{ visible: boolean, x: number, y: number, text: string, meaning: string | null }>({ visible: false, x: 0, y: 0, text: '', meaning: null });

  const lastHeartbeatTimeRef = useRef<number>(0);
  const hasCompletedRef = useRef<boolean>(false);

  const timeoutRef = React.useRef<number | null>(null);

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
              // Default to first episode if no history
              targetEpisodeId = found.episodes[0].id;

              // Attempt to find last watched episode from history
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

          // Get Chat Session for Episode
          if (!targetEpisodeId) {
            const chatRes = await fetch(`/api/MediaChat/media/${mediaId}`);
            if (chatRes.ok) {
              const chatData = await chatRes.json();
              setChatMessages(chatData);
            }
          } else {
            const chatRes = await fetch(`/api/EpisodeChat/episode/${targetEpisodeId}`);
            if (chatRes.ok) {
              const chatData = await chatRes.json();
              setChatMessages(chatData);
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

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSubtitleIndex, setSelectedSubtitleIndex] = useState(-1);
  const [activeTab, setActiveTab] = useState<'qoidalar' | 'sozlar' | 'ai'>('qoidalar');

  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  const handleSendChatMessage = async () => {
    if (!chatInput.trim() || !media) return;

    const message = chatInput;
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'User', content: message }]);
    setIsChatLoading(true);

    try {
      let endpoint = "/api";
      if (mediaType === "film") {
        endpoint += "/MediaChat";
      } else {
        endpoint += "/EpisodeChat";
      }
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
      }, 100);
    }
  };

  // Removed auto-analyze useEffect to prevent infinite loops when gaps/words are naturally empty.

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

  const activeSubtitles = subtitles.filter(
    (sub) => currentTime >= sub.startTimeSeconds && currentTime <= Math.max(sub.endTimeSeconds, sub.startTimeSeconds + 3.0)
  );
  const activeSubtitleIndex = activeSubtitles.length > 0
    ? subtitles.findIndex(s => s.id === activeSubtitles[0].id)
    : -1;

  const handleSubtitleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    window.dispatchEvent(new Event('pause-video'));

    let targetIndex = activeSubtitleIndex !== -1 ? activeSubtitleIndex : subtitles.findIndex(s => s.startTimeSeconds > currentTime);
    if (targetIndex === -1) targetIndex = 0;

    setSelectedSubtitleIndex(targetIndex);
    setIsModalOpen(true);
  };
  const handleWordRightClick = async (e: React.MouseEvent, word: string) => {
    e.preventDefault();
    e.stopPropagation();

    const cleanWord = word.replace(/[^a-zA-Zа-яА-ЯёЁ']/g, '');
    if (!cleanWord) return;

    // 1. Agar oldingi taymer bo'lsa, uni tozalaymiz (menyuni vaqtidan oldin yopilib ketmasligi uchun)
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    setContextMenu({ visible: true, x: e.clientX, y: e.clientY - 40, text: cleanWord, meaning: null });

    try {
      const res = await fetch(`/api/word/translate?text=${encodeURIComponent(cleanWord)}`); // encodeURIComponent qo'shildi

      if (res.ok) {
        const data = await res.json();
        setContextMenu(prev => ({ ...prev, meaning: data.translation }));
      } else {
        setContextMenu(prev => ({ ...prev, meaning: "Topilmadi" }));
      }
    } catch (error) {
      setContextMenu(prev => ({ ...prev, meaning: "Xatolik yuz berdi" }));
    } finally {
      // 2. try yoki catch tugaganidan qat'i nazar, bitta umumiy taymer ishga tushadi
      timeoutRef.current = setTimeout(() => {
        setContextMenu(prev => ({ ...prev, visible: false }));
      }, 3000);
    }
  };

  const closeContextMenu = () => {
    if (contextMenu.visible) {
      setContextMenu(prev => ({ ...prev, visible: false }));
    }
  };

  const handleScrollUp = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedSubtitleIndex(prev => Math.max(0, prev - 1));
  };
  const handleScrollDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedSubtitleIndex(prev => Math.min(subtitles.length - 1, prev + 1));
  };

  const handleModalSubtitleClick = (clickedSub: Subtitle) => {
    const index = subtitles.findIndex(s => s.id === clickedSub.id);
    if (index === -1) return;

    setSelectedSubtitleIndex(index);

    let playStartTime = clickedSub.startTimeSeconds;
    let playEndTime = clickedSub.endTimeSeconds;

    // Check up to 2 previous subtitles
    let addedPrevChars = 0;
    let prevIndex = index - 1;
    let lastStartTime = clickedSub.startTimeSeconds;

    while (prevIndex >= Math.max(0, index - 2)) {
      const prevSub = subtitles[prevIndex];
      // Max 1.5 seconds gap
      if (lastStartTime - prevSub.endTimeSeconds > 1.5) break;

      if (addedPrevChars + prevSub.text.length <= 30) {
        playStartTime = Math.min(playStartTime, prevSub.startTimeSeconds);
        addedPrevChars += prevSub.text.length;
        lastStartTime = prevSub.startTimeSeconds;
        prevIndex--;
      } else {
        break;
      }
    }

    // Check up to 2 next subtitles
    let addedNextChars = 0;
    let nextIndex = index + 1;
    let lastEndTime = clickedSub.endTimeSeconds;

    while (nextIndex <= Math.min(subtitles.length - 1, index + 2)) {
      const nextSub = subtitles[nextIndex];
      // Max 1.5 seconds gap
      if (nextSub.startTimeSeconds - lastEndTime > 1.5) break;

      if (addedNextChars + nextSub.text.length <= 30) {
        playEndTime = Math.max(playEndTime, nextSub.endTimeSeconds);
        addedNextChars += nextSub.text.length;
        lastEndTime = nextSub.endTimeSeconds;
        nextIndex++;
      } else {
        break;
      }
    }

    window.dispatchEvent(new CustomEvent('play-segment', { detail: { startTime: playStartTime, endTime: playEndTime } }));
  };

  const getVisibleSubtitles = () => {
    if (subtitles.length === 0 || selectedSubtitleIndex === -1) return [];
    const start = Math.max(0, selectedSubtitleIndex - 2);
    const end = Math.min(subtitles.length, start + 5);
    const adjustedStart = Math.max(0, end - 5);
    return subtitles.slice(adjustedStart, end);
  };

  const handleNextEpisode = () => {
    if (media && !media.isFilm && media.episodes) {
      const currentIndex = media.episodes.findIndex(e => e.id === currentEpisodeId);
      if (currentIndex !== -1 && currentIndex < media.episodes.length - 1) {
        navigate(`/player/${media.id}?episodeId=${media.episodes[currentIndex + 1].id}`);
      }
    }
  };

  const isNearEnd = duration > 0 && currentTime >= duration - 20;
  const hasNextEpisode = !media.isFilm && media.episodes && media.episodes.findIndex(e => e.id === currentEpisodeId) < media.episodes.length - 1;

  return (
    <div className="player-page-container" onClick={closeContextMenu}>
      <div className="player-main-layout">
        <div style={{ display: 'flex', alignItems: 'center', width: '100%', maxWidth: '1200px', marginBottom: '15px', flexShrink: 0 }}>
          <button
            className="player-back-btn"
            onClick={() => navigate(-1)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '18px', height: '18px' }}>
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
            Ortga
          </button>
          <h2 className="player-title" style={{ margin: 0, textAlign: 'left', flex: 1 }}>
            {media.title || "Anime Name"}
            {!media.isFilm && currentEpisodeId && (
              <span style={{ marginLeft: '10px', color: 'var(--accent-secondary)' }}>
                - {media.episodes?.find(e => e.id === currentEpisodeId)?.episodeNumber}-qism
              </span>
            )}
          </h2>
        </div>

        <div className="player-content-wrapper">
          <div className="video-section">
            <VideoPlayer
              src={videoUrl}
              onTimeUpdate={handleTimeUpdate}
              onDurationChange={setDuration}
            >
              {/* Normal Subtitle (when modal is closed) */}
              {!isModalOpen && activeSubtitles.length > 0 && (
                <div className="video-subtitle-overlay" onClick={handleSubtitleClick}>
                  <div className="subtitle-stack" style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'flex-start', maxWidth: '90%' }}>
                    {activeSubtitles.map((activeSub) => (
                      <div key={activeSub.id} className="video-subtitle-text subtitle-animate" style={{ marginBottom: 0 }}>
                        {activeSub.text.split(' ').map((w, i) => (
                          <span
                            key={i}
                            className='subtitleWord'
                            onContextMenu={(e) => handleWordRightClick(e, w)}
                            style={{ cursor: 'context-menu', marginRight: '5px' }}
                            title="Tarjimasi uchun o'ng tugmani bosing"
                          >
                            {w}
                          </span>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Context Menu for translation */}
              {contextMenu.visible && (
                <div
                  style={{
                    position: 'fixed',
                    top: contextMenu.y,
                    left: contextMenu.x,
                    background: 'rgba(0,0,0,0.8)',
                    color: '#fff',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    zIndex: 10000,
                    pointerEvents: 'none',
                    backdropFilter: 'blur(10px)',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                    transform: 'translate(-50%, -100%)',
                    fontSize: '14px'
                  }}
                >
                  <strong style={{ color: '#60a5fa' }}>{contextMenu.text}</strong> - {contextMenu.meaning || "Izlanmoqda..."}
                </div>
              )}

              {/* End of video overlay */}
              {isNearEnd && (
                <div style={{ position: 'absolute', bottom: '150px', right: '50px', zIndex: 30 }}>
                  {hasNextEpisode ? (
                    <button className="btn btn-primary" onClick={handleNextEpisode} style={{ padding: '15px 30px', fontSize: '18px', borderRadius: '30px', boxShadow: '0 10px 20px rgba(0,0,0,0.5)' }}>
                      Keyingi qism ⏭
                    </button>
                  ) : (
                    <button className="btn btn-glass" onClick={() => window.location.reload()} style={{ padding: '15px 30px', fontSize: '18px', borderRadius: '30px', boxShadow: '0 10px 20px rgba(0,0,0,0.5)', background: 'rgba(255,255,255,0.2)' }}>
                      Qayta ko'rish 🔄
                    </button>
                  )}
                </div>
              )}

              {/* Modal Overlay */}
              {isModalOpen && (
                <div className="subtitle-modal-overlay" onClick={(e) => e.stopPropagation()}>
                  <button className="modal-close-btn" onClick={() => setIsModalOpen(false)}>Yopish (X)</button>
                  <div className="subtitle-modal-content">
                    {/* Left: Subtitles list */}
                    <div className="modal-left-panel">
                      <div className="modal-subtitles-list">
                        {getVisibleSubtitles().map(sub => (
                          <div
                            key={sub.id}
                            className={`modal-subtitle-item ${sub.id === subtitles[selectedSubtitleIndex]?.id ? 'active' : ''}`}
                            onClick={() => handleModalSubtitleClick(sub)}
                          >
                            {sub.text}
                          </div>
                        ))}
                      </div>
                      <div className="modal-scroll-buttons">
                        <button className="modal-scroll-btn" onClick={handleScrollUp}>
                          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 14l5-5 5 5z" /></svg>
                        </button>
                        <button className="modal-scroll-btn" onClick={handleScrollDown}>
                          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 10l5 5 5-5z" /></svg>
                        </button>
                      </div>
                    </div>

                    {/* Right: Tabs and content */}
                    <div className="modal-right-panel">
                      <div className="modal-tabs">
                        <button className={`modal-tab ${activeTab === 'qoidalar' ? 'active' : ''}`} onClick={() => setActiveTab('qoidalar')}>Qoidalar</button>
                        <button className={`modal-tab ${activeTab === 'sozlar' ? 'active' : ''}`} onClick={() => setActiveTab('sozlar')}>So'zlar</button>
                        <button className={`modal-tab ${activeTab === 'ai' ? 'active' : ''}`} onClick={() => setActiveTab('ai')}>AI dan so'rash</button>
                      </div>
                      <div className="modal-tab-content-area">
                        <>
                          {activeTab === 'qoidalar' && (
                            <div className="rules-content">
                              {subtitles[selectedSubtitleIndex]?.gaps && subtitles[selectedSubtitleIndex].gaps!.length > 0 ? (
                                subtitles[selectedSubtitleIndex].gaps!.map((gap: any) => (
                                  <div key={gap.id} style={{ marginBottom: '20px', padding: '15px', background: 'rgba(0,0,0,0.05)', borderRadius: '12px' }}>
                                    <h3 style={{ margin: '0 0 10px 0', color: '#1e40af' }}>Gap: {gap.text}</h3>
                                    <div style={{ background: 'rgba(255,255,255,0.7)', padding: '15px', borderRadius: '8px', lineHeight: '1.6' }}>
                                      <ReactMarkdown>{gap.aiAnalysis || "Tahlil qilinmagan"}</ReactMarkdown>
                                    </div>
                                  </div>
                                ))
                              ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', textAlign: 'center', color: 'rgba(255,255,255,0.6)', background: 'rgba(0,0,0,0.2)', borderRadius: '12px', marginTop: '20px' }}>
                                  <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '15px', opacity: 0.5 }}>
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <line x1="12" y1="8" x2="12" y2="12"></line>
                                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                                  </svg>
                                  <h4 style={{ margin: '0 0 8px 0', fontSize: '1.1rem', color: 'rgba(255,255,255,0.9)' }}>Kechirasiz, ma'lumot topilmadi</h4>
                                  <p style={{ margin: 0, fontSize: '0.95rem' }}>Ushbu subtitr (so'z yoki ibora) uchun hozircha grammatik tahlil mavjud emas. Ammo "AI dan so'rash" bo'limiga o'tib, bu haqida to'g'ridan-to'g'ri so'rashingiz mumkin!</p>
                                </div>
                              )}
                            </div>
                          )}

                          {activeTab === 'sozlar' && (
                            <div className="words-content">
                              {subtitles[selectedSubtitleIndex]?.words && subtitles[selectedSubtitleIndex].words!.length > 0 ? (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                                  {subtitles[selectedSubtitleIndex].words!.map((word: any) => (
                                    <div key={word.id} style={{ background: 'white', padding: '8px 16px', borderRadius: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                                      <strong>{word.text}</strong> {word.translation && <span style={{ color: '#666' }}>- {word.translation}</span>}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', textAlign: 'center', color: 'rgba(255,255,255,0.6)', background: 'rgba(0,0,0,0.2)', borderRadius: '12px', marginTop: '20px' }}>
                                  <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '15px', opacity: 0.5 }}>
                                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                                  </svg>
                                  <h4 style={{ margin: '0 0 8px 0', fontSize: '1.1rem', color: 'rgba(255,255,255,0.9)' }}>So'zlar mavjud emas</h4>
                                  <p style={{ margin: 0, fontSize: '0.95rem' }}>Ushbu subtitr uchun alohida o'zak so'zlar ajratilmagan.</p>
                                </div>
                              )}
                            </div>
                          )}

                          {activeTab === 'ai' && (
                            <div
                              className="ai-content"
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                height: '100%',
                                maxHeight: 'calc(100dvh - 200px)', // Dinamik mobil oyna balandligi (100vh o'rniga 100dvh)
                                minHeight: '350px'
                              }}
                            >
                              {/* Chat xabarlari maydoni */}
                              <div
                                ref={chatScrollRef}
                                style={{
                                  flex: 1,
                                  overflowY: 'auto',
                                  marginBottom: '10px',
                                  padding: '10px',
                                  background: 'rgba(255,255,255,0.5)',
                                  borderRadius: '8px'
                                }}
                              >
                                {chatMessages.length === 0 && (
                                  <p style={{ textAlign: 'center', color: '#666', marginTop: '20px' }}>AI ustozdan videodagi iboralar haqida so'rang!</p>
                                )}
                                {chatMessages.map((msg, i) => (
                                  <div key={i} style={{ marginBottom: '10px', textAlign: msg.role === 'User' ? 'right' : 'left' }}>
                                    <div style={{ display: 'inline-block', padding: '10px 15px', borderRadius: '15px', background: msg.role === 'User' ? '#3b82f6' : '#fff', color: msg.role === 'User' ? '#fff' : '#000', boxShadow: '0 2px 5px rgba(0,0,0,0.1)', maxWidth: '90%', textAlign: 'left' }}>
                                      {msg.role === 'User' ? msg.content : <ReactMarkdown>{msg.content}</ReactMarkdown>}
                                    </div>
                                  </div>
                                ))}
                                {isChatLoading && (
                                  <div style={{ textAlign: 'left', marginBottom: '10px' }}>
                                    <div style={{ display: 'inline-block', padding: '10px 15px', borderRadius: '15px', background: '#fff', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' }}>
                                      <div className="spinner" style={{ width: '20px', height: '20px', border: '3px solid rgba(0,0,0,0.1)', borderLeftColor: '#3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Input va Jo'natish paneli */}
                              <div
                                style={{
                                  display: 'flex',
                                  gap: '10px',
                                  position: 'relative', // fixed yoki absolute buzilishini oldini oladi
                                  background: 'transparent',
                                  paddingTop: '5px'
                                }}
                              >
                                <input
                                  type="text"
                                  placeholder="Savolingizni yozing..."
                                  value={chatInput}
                                  onChange={(e) => setChatInput(e.target.value)}
                                  onKeyDown={(e) => e.key === 'Enter' && handleSendChatMessage()}
                                  // Mobil klaviatura ochilganda input joyida qolishi uchun foks hodisasi:
                                  onFocus={(e) => {
                                    setTimeout(() => {
                                      e.target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                                    }, 300);
                                  }}
                                  style={{
                                    flex: 1,
                                    padding: '12px 15px', // Mobil qurilma uchun sal kattaroq bosish maydoni
                                    borderRadius: '20px',
                                    border: '1px solid #ccc',
                                    outline: 'none',
                                    fontSize: '16px' // MUHIM: iOS da input 16px dan kichik bo'lsa ekran avtomatik yaqinlashib (zoom) ketadi va joylashuv buziladi!
                                  }}
                                />
                                <button
                                  onClick={handleSendChatMessage}
                                  disabled={isChatLoading || !chatInput.trim()}
                                  style={{ background: '#3b82f6', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '20px', cursor: 'pointer', fontWeight: 'bold' }}
                                >
                                  Jo'natish
                                </button>
                              </div>
                            </div>
                          )}
                        </>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </VideoPlayer>
          </div>

          {/* Sidebar / Episode List */}
          {!media.isFilm && (
            <div
              className="player-sidebar"
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '15px',
                minWidth: "350px",
                maxHeight: isExpanded ? '65vh' : '130px',
                transition: 'width 0.3s ease',
                overflow: 'hidden',
                background: 'rgba(0,0,0,0.2)',
                padding: '15px',
                borderRadius: '12px'
              }}
            >
              {/* Yuqori qism: Navigatsiya va Pleylistni yopish/ochish */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ margin: 0, color: 'white', fontSize: '18px' }}>Qismlar</h3>

                  {/* Oching / Yopish tugmasi */}
                  {isExpanded && <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: '5px', marginLeft: 'auto' }}
                    title={isExpanded ? "Yopish" : "Ochish"}
                  >
                    ✕
                  </button>}
                </div>

                {/* Oldingi va Keyingi tugmalari (Faqat pleylist ochiqligida chiroyli ko'rinadi) */}
                <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
                  {(() => {
                    const currentIndex = media.episodes?.findIndex(ep => ep.id === currentEpisodeId) ?? -1;
                    const prevEpisode = media.episodes?.[currentIndex - 1];
                    const nextEpisode = media.episodes?.[currentIndex + 1];

                    return (
                      <>
                        <button
                          disabled={!prevEpisode}
                          onClick={() => {
                            if (prevEpisode) {
                              navigate(`/player/${media.id}?episodeId=${prevEpisode.id}`);
                            }
                          }}
                          style={{
                            flex: 1,
                            padding: '8px',
                            borderRadius: '6px',
                            border: 'none',
                            background: prevEpisode ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.05)',
                            color: prevEpisode ? 'white' : '#666',
                            cursor: prevEpisode ? 'pointer' : 'not-allowed',
                            fontWeight: '500'
                          }}
                        >
                          ◀ Oldingi
                        </button>
                        <button
                          disabled={!nextEpisode}
                          onClick={() => {
                            if (nextEpisode) {
                              navigate(`/player/${media.id}?episodeId=${nextEpisode.id}`);
                            }
                          }}
                          style={{
                            flex: 1,
                            padding: '8px',
                            borderRadius: '6px',
                            border: 'none',
                            background: nextEpisode ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.05)',
                            color: nextEpisode ? 'white' : '#666',
                            cursor: nextEpisode ? 'pointer' : 'not-allowed',
                            fontWeight: '500'
                          }}
                        >
                          Keyingi ▶
                        </button>
                      </>
                    );
                  })()}
                </div>
                {/* Oching / Yopish tugmasi */}
                {!isExpanded && <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: '5px', marginLeft: 'auto' }}
                  title={isExpanded ? "Yopish" : "Ochish"}
                >
                  Ko'proq
                </button>}

              </div>

              {/* Qismlar Ro'yxati */}
              {isExpanded && <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  overflowY: 'auto',
                  overflowX: 'hidden',
                  flex: 1,
                  paddingRight: '5px'
                }}
              >
                {media.episodes?.map(ep => {
                  const isActive = ep.id === currentEpisodeId;
                  return (
                    <button
                      key={ep.id}
                      className={`sidebar-action-btn ${isActive ? 'active' : ''}`}
                      onClick={() => navigate(`/player/${media.id}?episodeId=${ep.id}`)}
                      style={{
                        justifyContent: 'flex-start',
                        padding: '10px',
                        background: isActive ? 'var(--accent-primary, #e50914)' : 'rgba(255,255,255,0.05)',
                        display: 'flex',
                        gap: '15px',
                        alignItems: 'center',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        color: 'white',
                        width: '100%',
                        transition: 'background 0.2s'
                      }}
                      title={`${ep.episodeNumber}-qism: ${ep.title}`}
                    >
                      {/* Qism rasmi (Miniyatura) */}
                      <div style={{ flexShrink: 0, width: '100px', height: '60px', borderRadius: '6px', overflow: 'hidden', transition: 'all 0.3s' }}>
                        <img src={ep.thumbnailUrl || media.thumbnailUrl || "https://images.unsplash.com/photo-1440404653325-ab127d49abc1?auto=format&fit=crop&w=400&q=80"} alt={ep.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>

                      {/* Qism matni (Faqat sidebar ochiq bo'lsa ko'rinadi) */}
                      {isExpanded && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                          <span style={{ fontWeight: 'bold', textAlign: 'left', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', fontSize: '14px' }}>
                            {ep.episodeNumber}-qism: {ep.title}
                          </span>
                          {ep.durationalMinutes && (
                            <span style={{ fontSize: '12px', opacity: 0.7, marginTop: '4px' }}>
                              {ep.durationalMinutes} daq
                            </span>
                          )}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>}

              {/* Oching / Yopish tugmasi */}
              {isExpanded && <button
                onClick={() => setIsExpanded(!isExpanded)}
                style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: '5px', marginLeft: 'auto' }}
                title={isExpanded ? "Yopish" : "Ochish"}
              >
                Yopish
              </button>}
            </div>
          )}

        </div>

        {/* Description and Comments Section */}
        <div className="player-details-section" style={{ width: '100%', maxWidth: '1200px', marginTop: '20px', paddingBottom: '50px' }}>
          <div className="media-description glass-panel" style={{ padding: '20px', borderRadius: '16px', marginBottom: '20px' }}>
            <h3 style={{ marginTop: 0, color: 'white' }}>Tavsif</h3>
            <p style={{ color: 'rgba(255,255,255,0.8)', lineHeight: '1.6' }}>{media.description}</p>
          </div>

          <CommentsSection mediaId={media.id} />
        </div>


      </div>
    </div>
  );
};

export default PlayerPage;
