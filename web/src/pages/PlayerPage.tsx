import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import VideoPlayer from '../features/player/components/VideoPlayer';
import CommentsSection from '../features/player/components/CommentsSection';
import { parseTimeSpanToSeconds, formatSecondsToMMSS } from '../utils/timeUtils';
import { useAuth } from '../context/AuthContext';
import { showTelegramBackButton, hideTelegramBackButton } from '../utils/telegram';
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
  level?: string;
  durationalMinutes?: number;
  thumbnailUrl?: string;
  episodes?: Episode[];
}

interface Gap {
  id: number;
  text: string;
  index: number;
  aiAnalysis?: string;
}

interface SubtitleWordItem {
  id?: number;
  text: string;
  translation?: string;
}

interface Subtitle {
  id: number;
  text: string;
  startTimeSeconds: number;
  endTimeSeconds: number;
  index: number;
  gaps?: Gap[];
  words?: SubtitleWordItem[];
}

interface ChatMessage {
  id?: number;
  role: 'User' | 'AI';
  content: string;
  createdAt?: string;
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

  // Subtitle selection & Drawer states
  const [selectedSubtitleIndex, setSelectedSubtitleIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isFullscreenDrawerOpen, setIsFullscreenDrawerOpen] = useState(false);
  const [subSearchQuery, setSubSearchQuery] = useState('');

  // Deep AI Analysis & Chat toggle state
  const [isDeepAiOpen, setIsDeepAiOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatSending, setIsChatSending] = useState(false);
  const [isAnalyzingSub, setIsAnalyzingSub] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);

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

          // Fetch Subtitles with Gaps and Words
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
              words: (s.words || []).map((w: any) => ({
                id: w.id,
                text: w.text || '',
                translation: w.translation || null
              }))
            }));
            setSubtitles(formattedSubs);
          }

          // Fetch past chat messages
          const chatUrl = targetEpisodeId 
            ? `/api/EpisodeChat/episode/${targetEpisodeId}` 
            : `/api/MediaChat/media/${mediaId}`;
          try {
            const chatRes = await fetch(chatUrl);
            if (chatRes.ok) {
              const msgs = await chatRes.json();
              if (Array.isArray(msgs)) {
                setChatMessages(msgs.map((m: any) => ({
                  id: m.id,
                  role: m.role === 'AI' || m.role === 'Model' ? 'AI' : 'User',
                  content: m.content || '',
                  createdAt: m.createdAt
                })));
              }
            }
          } catch (chatErr) {
            console.warn('Chat history could not be loaded:', chatErr);
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

  // Trigger on-demand AI analysis if gaps are not yet created
  const handleAnalyzeCurrentSub = async () => {
    if (!currentSub || isAnalyzingSub) return;
    try {
      setIsAnalyzingSub(true);
      const res = await fetch(`/api/subtitle/${currentSub.id}/analyze`, { method: 'POST' });
      if (res.ok) {
        const updated = await res.json();
        if (updated && updated.gaps) {
          setSubtitles(prev => prev.map(s => s.id === currentSub.id ? {
            ...s,
            gaps: updated.gaps,
            words: updated.words || s.words
          } : s));
        }
      }
    } catch (err) {
      console.error('Analysis error:', err);
    } finally {
      setIsAnalyzingSub(false);
    }
  };

  // Send message to AI Tutor
  const handleSendChatMessage = async (msgToSend?: string) => {
    const text = (msgToSend || chatInput).trim();
    if (!text || isChatSending || !media) return;

    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'User', content: text }]);
    setIsChatSending(true);

    try {
      const endpoint = currentEpisodeId ? '/api/EpisodeChat' : '/api/MediaChat';
      const body = currentEpisodeId 
        ? { episodeId: currentEpisodeId, subtitleId: currentSub?.id, message: text }
        : { mediaId: media.id, subtitleId: currentSub?.id, message: text };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (res.ok) {
        const data = await res.json();
        setChatMessages(prev => [...prev, { role: 'AI', content: data.response }]);
      } else {
        const err = await res.json().catch(() => null);
        setChatMessages(prev => [...prev, { role: 'AI', content: err?.message || "Kechirasiz, javob olishda xatolik yuz berdi." }]);
      }
    } catch (e) {
      console.error('Chat error:', e);
      setChatMessages(prev => [...prev, { role: 'AI', content: "Server bilan bog'lanishda xatolik yuz berdi." }]);
    } finally {
      setIsChatSending(false);
      setTimeout(() => {
        chatScrollRef.current?.scrollTo({ top: chatScrollRef.current.scrollHeight, behavior: 'smooth' });
      }, 100);
    }
  };

  // Extract concise summary from pre-generated aiAnalysis
  const summaryData = useMemo(() => {
    if (!currentSub || !currentSub.gaps || currentSub.gaps.length === 0) {
      return { translation: null, grammarNote: null, fullAnalysis: null };
    }

    const firstGap = currentSub.gaps[0];
    const raw = firstGap.aiAnalysis || '';
    if (!raw.trim()) return { translation: null, grammarNote: null, fullAnalysis: null };

    // 1. Try to extract quoted translation: "..." degan ma'noni beradi / bildiradi
    const quoteMatch = raw.match(/["“]([^"”]+)["”]\s+degan\s+ma'noni/i) 
      || raw.match(/["“]([^"”]+)["”]/);
    const translation = quoteMatch ? quoteMatch[1] : null;

    // 2. First paragraph as short grammar / summary note
    const paragraphs = raw.split(/\n\s*\n/).filter(p => p.trim().length > 0);
    let grammarNote = paragraphs[0] || null;

    // Remove the quoted translation part from the grammar note if redundant
    if (grammarNote && translation && grammarNote.includes(translation)) {
      const parts = grammarNote.split(/degan\s+ma'noni\s+(?:beradi|bildiradi)\.?/i);
      if (parts.length > 1 && parts[1].trim()) {
        grammarNote = parts[1].trim();
      }
    }

    return {
      translation,
      grammarNote,
      fullAnalysis: raw
    };
  }, [currentSub]);

  // Words forming this sentence
  const sentenceWords = useMemo(() => {
    if (!currentSub) return [];
    if (currentSub.words && currentSub.words.length > 0) {
      return currentSub.words;
    }
    // Fallback: split by space
    return currentSub.text.split(' ')
      .map(w => w.replace(/[.,/#!$%^&*;:{}=\-_`~()?"'’]/g, "").trim())
      .filter(w => w.length > 0)
      .map((w, idx) => ({ id: idx, text: w, translation: undefined }));
  }, [currentSub]);

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
   * Subtitle Analysis Panel Body
   * Features:
   * 1. Current Subtitle text (clickable words)
   * 2. Qisqacha mazmun (Tarjima & Qisqa grammatika)
   * 3. Gapdagi so'zlar (Sentence words with translations)
   * 4. «Chuqurroq AI tahlili» toggle:
   *    - Oldindan tayyorlangan to'liq AI tahlili (Markdown)
   *    - AI Ustoz bilan muloqot (Interactive Chat)
   * 5. Interactive Transcript (Dialoglar ro'yxati)
   */
  const renderAnalysisBody = (isDrawer = false) => {
    return (
      <div className={`analysis-body-content ${isDrawer ? 'drawer-mode' : ''}`}>
        {/* Main Subtitle Focus Card */}
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

          {/* English Sentence Text */}
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

          {/* Qisqacha Mazmun: Tarjima & Qisqa Grammatik Tahlil */}
          {(summaryData.translation || summaryData.grammarNote) && (
            <div className="sub-quick-summary-box">
              {summaryData.translation && (
                <div className="summary-translation-row">
                  <span className="summary-flag">🇺🇿</span>
                  <span className="summary-trans-text">«{summaryData.translation}»</span>
                </div>
              )}
              {summaryData.grammarNote && (
                <div className="summary-grammar-row">
                  <span className="summary-icon">🎯</span>
                  <div className="summary-grammar-text">
                    <ReactMarkdown>{summaryData.grammarNote}</ReactMarkdown>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Gapni tashkil qilgan so'zlar (Sentence Words List) */}
          {sentenceWords.length > 0 && (
            <div className="sentence-words-section">
              <div className="words-section-label">
                <span>🔤 Gapdagi so'zlar:</span>
              </div>
              <div className="words-chips-grid">
                {sentenceWords.map((sw, idx) => (
                  <div
                    key={idx}
                    className="sentence-word-chip"
                    onClick={(e) => handleWordClick(e, sw.text)}
                    title="Tarjimasi va talaffuzini ko'rish"
                  >
                    <span className="chip-en-text">{sw.text}</span>
                    {sw.translation && (
                      <span className="chip-uz-text">{sw.translation}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Button to toggle Deep AI Analysis & Chat */}
          <div className="deep-ai-toggle-row">
            <button
              className={`btn-deep-ai-toggle ${isDeepAiOpen ? 'active' : ''}`}
              onClick={() => setIsDeepAiOpen(prev => !prev)}
            >
              <span className="ai-sparkle-icon">✨</span>
              <span>{isDeepAiOpen ? "Chuqur tahlilni yopish ▲" : "🧠 Chuqurroq AI tahlili & Savol berish ▼"}</span>
            </button>
          </div>

          {/* Deep Pre-Generated AI Analysis + Interactive Chat Section */}
          {isDeepAiOpen && (
            <div className="deep-ai-accordion-content animate-fade-in">
              {/* 1. Pre-generated Deep AI Analysis (Markdown) */}
              <div className="pre-generated-analysis-card">
                <div className="deep-card-title-row">
                  <span className="deep-card-badge">Oldindan tahlil qilingan</span>
                  <h4>📖 To'liq Grammatik & Mazmun Tahlili</h4>
                </div>

                {currentSub?.gaps && currentSub.gaps.length > 0 ? (
                  currentSub.gaps.map((gap, gIdx) => (
                    <div key={gap.id || gIdx} className="gap-markdown-wrapper">
                      {gap.text && gap.text !== currentSub.text && (
                        <div className="gap-focus-label">🎯 {gap.text}</div>
                      )}
                      <div className="ai-markdown-body">
                        <ReactMarkdown>{gap.aiAnalysis || "Ushbu ibora grammatikasi tahlil qilinmoqda..."}</ReactMarkdown>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="no-deep-analysis-state">
                    <p>Ushbu gap uchun chuqur tahlil hali saqlanmagan.</p>
                    <button
                      className="btn-create-analysis"
                      onClick={handleAnalyzeCurrentSub}
                      disabled={isAnalyzingSub}
                    >
                      {isAnalyzingSub ? "⏳ Tahlil qilinmoqda..." : "⚡ AI tahlilini yaratish"}
                    </button>
                  </div>
                )}
              </div>

              {/* 2. Interactive AI Tutor Chat */}
              <div className="interactive-ai-chat-card">
                <div className="chat-card-header">
                  <div className="chat-tutor-title">
                    <span className="tutor-avatar">🤖</span>
                    <div>
                      <h5>AI Ustoz bilan muloqot</h5>
                      <span className="tutor-status">Ushbu gap yuzasidan savol bering</span>
                    </div>
                  </div>
                </div>

                {/* Quick Prompts Chips */}
                <div className="quick-prompts-row">
                  <button
                    className="quick-prompt-chip"
                    onClick={() => handleSendChatMessage("Nega aynan ushbu zamon ishlatildi?")}
                  >
                    💡 Nega bu zamon?
                  </button>
                  <button
                    className="quick-prompt-chip"
                    onClick={() => handleSendChatMessage("Shunga o'xshash 2 ta kundalik misol keltir.")}
                  >
                    💡 O'xshash 2 ta misol
                  </button>
                  <button
                    className="quick-prompt-chip"
                    onClick={() => handleSendChatMessage("Bu yerdagi iboralar va o'zak so'zlarni tushuntir.")}
                  >
                    💡 Iboralarni tushuntir
                  </button>
                </div>

                {/* Chat Messages Feed */}
                <div className="chat-messages-feed" ref={chatScrollRef}>
                  {chatMessages.length === 0 ? (
                    <div className="chat-empty-hint">
                      AI Ustozga ushbu gap yuzasidan istalgan savolingizni bering!
                    </div>
                  ) : (
                    chatMessages.map((msg, mIdx) => (
                      <div
                        key={mIdx}
                        className={`chat-bubble-row ${msg.role === 'User' ? 'is-user-msg' : 'is-ai-msg'}`}
                      >
                        <div className="chat-bubble-bubble">
                          <span className="bubble-author">{msg.role === 'User' ? 'Siz' : 'AI Ustoz'}</span>
                          <div className="bubble-content-text">
                            <ReactMarkdown>{msg.content}</ReactMarkdown>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                  {isChatSending && (
                    <div className="chat-bubble-row is-ai-msg">
                      <div className="chat-bubble-bubble typing-bubble">
                        <span>AI Ustoz javob yozmoqda...</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Chat Input Row */}
                <div className="chat-input-row">
                  <input
                    type="text"
                    placeholder="Ushbu gap haqida savolingizni yozing..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSendChatMessage();
                    }}
                    className="chat-text-input"
                    disabled={isChatSending}
                  />
                  <button
                    className="chat-send-btn"
                    onClick={() => handleSendChatMessage()}
                    disabled={isChatSending || !chatInput.trim()}
                  >
                    Jo'natish
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Subtitles Transcript Section (📋 Dialoglar matni) */}
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
