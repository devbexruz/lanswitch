import React, { useEffect, useState, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import VideoPlayer from '../features/player/components/VideoPlayer';
import CommentsSection from '../features/player/components/CommentsSection';
import { parseTimeSpanToSeconds, formatSecondsToMMSS } from '../utils/timeUtils';
import { useAuth } from '../context/AuthContext';
import { showTelegramBackButton, hideTelegramBackButton } from '../utils/telegram';
import ReactMarkdown from 'react-markdown';
import './PlayerPage.css';
import SubscriptionPlansModal from '../components/SubscriptionPlansModal';

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
  const { user, canClaimBonus, bonusAmount, minAmount, claimBonus } = useAuth();

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

  // AI Tutor Modal & Streaming Chat state
  const [showAiTutorModal, setShowAiTutorModal] = useState(false);
  const [aiModalActiveTab, setAiModalActiveTab] = useState<'analysis' | 'chat'>('chat');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatSending, setIsChatSending] = useState(false);
  const [isAnalyzingSub, setIsAnalyzingSub] = useState(false);
  const [streamingAiText, setStreamingAiText] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);

  const typewriterIntervalRef = useRef<any>(null);
  const latestAiMsgRef = useRef<HTMLDivElement | null>(null);
  const latestUserMsgRef = useRef<HTMLDivElement | null>(null);
  const modalChatFeedRef = useRef<HTMLDivElement | null>(null);

  // Index of the most recent user message
  const lastUserMsgIndex = useMemo(() => {
    for (let i = chatMessages.length - 1; i >= 0; i--) {
      if (chatMessages[i].role === 'User') return i;
    }
    return -1;
  }, [chatMessages]);

  // Mobile detection (screen width <= 768px)
  const [isMobile, setIsMobile] = useState<boolean>(() => 
    typeof window !== 'undefined' ? window.innerWidth <= 768 : false
  );

  // Subscription verification state (Students need Student Premium for movies)
  const [hasSubscription, setHasSubscription] = useState<boolean | null>(null);
  const [isSubscriptionModalOpen, setIsSubscriptionModalOpen] = useState(false);

  const checkSubscription = async () => {
    if (user?.isAdmin) {
      setHasSubscription(true);
      return;
    }
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/subscription/my', {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      if (res.ok) {
        const data = await res.json();
        setHasSubscription(Boolean(data.hasActiveSubscription && data.subscription?.isActive));
      } else {
        setHasSubscription(false);
      }
    } catch {
      setHasSubscription(false);
    }
  };

  useEffect(() => {
    checkSubscription();
  }, [user]);

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

  // Dynamic mount node for AI Tutor modal (in Fullscreen mode, it mounts inside the fullscreen element)
  const [modalMountNode, setModalMountNode] = useState<Element | null>(null);

  useEffect(() => {
    const updateMountNode = () => {
      if (typeof document === 'undefined') return;
      const fsEl = 
        document.fullscreenElement || 
        (document as any).webkitFullscreenElement || 
        document.querySelector('.custom-video-container.fullscreen') || 
        document.body;
      setModalMountNode(fsEl);
    };

    updateMountNode();
    document.addEventListener('fullscreenchange', updateMountNode);
    document.addEventListener('webkitfullscreenchange', updateMountNode);
    window.addEventListener('resize', updateMountNode);
    return () => {
      document.removeEventListener('fullscreenchange', updateMountNode);
      document.removeEventListener('webkitfullscreenchange', updateMountNode);
      window.removeEventListener('resize', updateMountNode);
    };
  }, [isFullscreen, showAiTutorModal]);

  // Open AI Tutor Modal & automatically pause video
  const handleOpenAiTutorModal = (targetSubtitleIndex?: number | React.MouseEvent) => {
    if (typeof targetSubtitleIndex === 'number' && targetSubtitleIndex >= 0 && targetSubtitleIndex < subtitles.length) {
      setSelectedSubtitleIndex(targetSubtitleIndex);
    }
    window.dispatchEvent(new CustomEvent('pause-video'));
    const video = document.querySelector('video');
    if (video) video.pause();

    const fsEl = 
      (typeof document !== 'undefined' && (
        document.fullscreenElement || 
        (document as any).webkitFullscreenElement || 
        document.querySelector('.custom-video-container.fullscreen')
      )) || 
      (typeof document !== 'undefined' ? document.body : null);
    setModalMountNode(fsEl);
    setShowAiTutorModal(true);
  };

  const handleCloseAiTutorModal = () => {
    setShowAiTutorModal(false);
    if (typewriterIntervalRef.current) {
      clearInterval(typewriterIntervalRef.current);
      typewriterIntervalRef.current = null;
    }
    setIsStreaming(false);
    setStreamingAiText(null);
  };

  // Close modal on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showAiTutorModal) {
        handleCloseAiTutorModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showAiTutorModal]);

  // Cleanup typewriter interval on unmount
  useEffect(() => {
    return () => {
      if (typewriterIntervalRef.current) {
        clearInterval(typewriterIntervalRef.current);
      }
    };
  }, []);

  // Send message to AI Tutor with Typewriter streaming and smooth scroll to user sent message
  const handleSendChatMessage = async (msgToSend?: string) => {
    const text = (msgToSend || chatInput).trim();
    if (!text || isChatSending || isStreaming || !media) return;

    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'User', content: text }]);
    setIsChatSending(true);

    // CRITICAL REQUIREMENT: Smooth scroll user's sent message so it aligns with the VERY TOP of the scroll container
    setTimeout(() => {
      latestUserMsgRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);

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

      let reply = '';
      if (res.ok) {
        const data = await res.json();
        reply = data.response || "Javob topilmadi.";
      } else {
        const err = await res.json().catch(() => null);
        reply = err?.message || "Kechirasiz, javob olishda xatolik yuz berdi.";
      }

      // Start typewriter streaming animation
      setIsChatSending(false);
      setIsStreaming(true);
      setStreamingAiText('');

      // CRITICAL: Do NOT scroll to the reply! The user's sent message remains anchored at the top of the container!

      let charIndex = 0;
      const totalChars = reply.length;
      const step = Math.max(2, Math.ceil(totalChars / 55));

      if (typewriterIntervalRef.current) clearInterval(typewriterIntervalRef.current);

      typewriterIntervalRef.current = setInterval(() => {
        charIndex += step;
        if (charIndex >= totalChars) {
          clearInterval(typewriterIntervalRef.current);
          typewriterIntervalRef.current = null;
          setStreamingAiText(null);
          setIsStreaming(false);
          setChatMessages(prev => [...prev, { role: 'AI', content: reply }]);
        } else {
          setStreamingAiText(reply.slice(0, charIndex));
        }
      }, 20);

    } catch (e) {
      console.error('Chat error:', e);
      setIsChatSending(false);
      setChatMessages(prev => [...prev, { role: 'AI', content: "Server bilan bog'lanishda xatolik yuz berdi." }]);
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
            <div className="sub-header-left-group">
              <span className="sub-box-badge">
                {currentSub ? `${selectedSubtitleIndex + 1} / ${subtitles.length}` : 'Subtitr'}
              </span>
              <button
                className="sub-header-ai-quick-btn"
                onClick={() => handleOpenAiTutorModal()}
                title="AI Ustoz bilan muloqot va tahlil"
              >
                <span className="quick-ai-sparkle">✨</span>
                <span className="quick-ai-label">AI Chat</span>
              </button>
            </div>
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

          {/* Button to Launch AI Tutor Modal */}
          <div className="ai-tutor-launch-row">
            <button
              className="btn-ai-tutor-launch"
              onClick={() => handleOpenAiTutorModal()}
              title="AI Ustoz bilan tahlil qilish va savol-javob oynasini ochish"
            >
              <div className="launch-btn-left">
                <span className="ai-sparkle-icon">✨</span>
                <span className="launch-btn-title">AI Ustoz Bilan Tahlil</span>
              </div>
              <span className="launch-btn-badge">Interaktiv Chat ➔</span>
            </button>
          </div>
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

  if (loading || hasSubscription === null) {
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
        {!hasSubscription ? (
          <div className="player-premium-lock-card">
            <div 
              className="premium-lock-badge" 
              style={
                canClaimBonus 
                  ? { background: 'linear-gradient(135deg, #10B981, #059669)', color: '#fff' } 
                  : { background: 'linear-gradient(135deg, #EF4444, #DC2626)', color: '#fff' }
              }
            >
              {canClaimBonus ? `🎁 ${bonusAmount.toLocaleString('uz-UZ')} so'm Bepul Bonus` : "⚠️ Tarif muddati tugagan"}
            </div>
            <h2 className="premium-lock-title">
              {canClaimBonus 
                ? `${bonusAmount.toLocaleString('uz-UZ')} so'm bonus bilan kinoni bepul boshlang!` 
                : "Tarif muddati tugagan — Kinoni ko'rishda davom eting!"}
            </h2>
            <p className="premium-lock-desc">
              {canClaimBonus 
                ? `Sizda yangi foydalanuvchi sifatida ${bonusAmount.toLocaleString('uz-UZ')} so'm boshlang'ich bonus mavjud! Bonusni oling va filmni darhol tomosha qilishni boshlang.`
                : `Kinolarni tomosha qilish va AI yordamchidan foydalanish uchun balansingizni minimal ${minAmount.toLocaleString('uz-UZ')}+ so'mga to'ldiring. Mablag'ingiz faqat ko'rgan daqiqalaringizgacha sarflanadi!`}
            </p>

            <div className="premium-lock-features">
              <div className="lock-feature-item">
                <span>🎬</span>
                <div>
                  <strong>Cheksiz kinolar va seriallar</strong>
                  <p>Ingliz tilidagi eng sara filmlar va interaktiv subtitrlar</p>
                </div>
              </div>
              <div className="lock-feature-item">
                <span>🤖</span>
                <div>
                  <strong>AI Ustoz tahlili va Chat</strong>
                  <p>Har bir gap bo'yicha grammatik tahlil va interaktiv suhbat</p>
                </div>
              </div>
              <div className="lock-feature-item">
                <span>{canClaimBonus ? '🎁' : '💳'}</span>
                <div>
                  <strong>
                    {canClaimBonus 
                      ? `${bonusAmount.toLocaleString('uz-UZ')} so'm Bepul Bonus` 
                      : `Balansni to'ldirish (Minimal ${minAmount.toLocaleString('uz-UZ')} so'm)`}
                  </strong>
                  <p>
                    {canClaimBonus 
                      ? "Bonus bilan bepul ko'ring — minutigacha hisoblab beriladi" 
                      : "Istalgan summa bilan to'ldiring — minutigacha hisoblab beriladi"}
                  </p>
                </div>
              </div>
            </div>

            <div className="premium-lock-actions">
              {canClaimBonus ? (
                <button 
                  className="btn-unlock-premium"
                  style={{ background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)', boxShadow: '0 4px 16px rgba(16, 185, 129, 0.4)' }}
                  onClick={async () => {
                    const ok = await claimBonus('student_premium');
                    if (ok) {
                      await checkSubscription();
                    } else {
                      setIsSubscriptionModalOpen(true);
                    }
                  }}
                >
                  🎁 {bonusAmount.toLocaleString('uz-UZ')} bonusni olish va boshlash
                </button>
              ) : (
                <button 
                  className="btn-unlock-premium"
                  style={{ background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)', boxShadow: '0 4px 16px rgba(16, 185, 129, 0.4)' }}
                  onClick={() => setIsSubscriptionModalOpen(true)}
                >
                  💳 Balansni to'ldirish ({minAmount.toLocaleString('uz-UZ')}+)
                </button>
              )}
              <button 
                className="btn-lock-back"
                onClick={() => {
                  if (window.history.length > 1) {
                    navigate(-1);
                  } else {
                    navigate('/student');
                  }
                }}
              >
                ← Ortga qaytish
              </button>
            </div>
          </div>
        ) : (
          <>
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
              onOpenAiChat={() => handleOpenAiTutorModal()}
            >
              {/* Subtitles Overlay inside Video (Hidden on mobile non-fullscreen) */}
              {shouldShowVideoSubtitles && (
                <div className="video-subtitle-overlay" onClick={handleSubtitleOverlayClick}>
                  <div className="subtitle-stack">
                    {activeSubtitles.map((activeSub) => (
                      <div key={activeSub.id} className="video-subtitle-line-wrap">
                        <div className="video-subtitle-text subtitle-animate">
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
                        <button
                          className="video-sub-ai-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            const realIdx = subtitles.findIndex(s => s.id === activeSub.id);
                            handleOpenAiTutorModal(realIdx !== -1 ? realIdx : undefined);
                          }}
                          title="AI Ustoz bilan gap tahlili va chat"
                        >
                          ✨ AI
                        </button>
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
          </>
        )}
      </main>

      {/* AI Ustoz Bilan Tahlil - Dark Style Popup Screen Modal (Portaled into fullscreen element when in fullscreen) */}
      {showAiTutorModal && (modalMountNode || typeof document !== 'undefined') && createPortal(
        <div 
          className={`ai-tutor-modal-overlay ${(isFullscreen || Boolean(typeof document !== 'undefined' && document.fullscreenElement)) ? 'in-fullscreen' : ''}`} 
          onClick={(e) => {
            e.stopPropagation();
            handleCloseAiTutorModal();
          }}
        >
          <div className="ai-tutor-modal-container" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="ai-modal-header">
              <div className="ai-modal-header-left">
                <div className="ai-modal-robot-badge">
                  <span>🤖</span>
                  <span className="online-indicator-dot" title="Onlayn"></span>
                </div>
                <div className="ai-modal-title-group">
                  <h3 className="ai-modal-title">AI Ustoz Bilan Tahlil</h3>
                  <span className="ai-modal-timing">
                    {currentSub ? `Vaqt: ${formatSecondsToMMSS(currentSub.startTimeSeconds)} - ${formatSecondsToMMSS(currentSub.endTimeSeconds)}` : 'Grammatik tahlil va jonli muloqot'}
                  </span>
                </div>
              </div>

              <div className="ai-modal-header-actions">
                <button
                  className="ai-modal-close-btn"
                  onClick={handleCloseAiTutorModal}
                  aria-label="Yopish"
                  title="Yopish (Esc)"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Target Subtitle Context Banner */}
            {currentSub && (
              <div className="ai-modal-sub-banner">
                <div className="ai-banner-en-line">
                  <span className="quote-mark">“</span>
                  <span className="quote-text">{currentSub.text}</span>
                  <span className="quote-mark">”</span>
                </div>
                {summaryData.translation && (
                  <div className="ai-banner-uz-line">
                    <span className="flag-icon">🇺🇿</span>
                    <span className="uz-text">{summaryData.translation}</span>
                  </div>
                )}
              </div>
            )}

            {/* Mobile Tab Switcher */}
            <div className="ai-modal-tabs-mobile">
              <button
                className={`ai-tab-mobile-btn ${aiModalActiveTab === 'analysis' ? 'active' : ''}`}
                onClick={() => setAiModalActiveTab('analysis')}
              >
                📖 Avvaldan qilingan tahlil
              </button>
              <button
                className={`ai-tab-mobile-btn ${aiModalActiveTab === 'chat' ? 'active' : ''}`}
                onClick={() => setAiModalActiveTab('chat')}
              >
                💬 AI Ustoz Chat
              </button>
            </div>

            {/* Two-Column Body Grid */}
            <div className="ai-modal-grid-body">
              {/* Left Column: Avvaldan qilingan tahlil */}
              <div className={`ai-modal-col-analysis ${aiModalActiveTab === 'analysis' ? 'is-active-tab' : ''}`}>
                <div className="ai-panel-header">
                  <div className="ai-panel-title-wrap">
                    <span className="ai-panel-icon">📖</span>
                    <h4>Avvaldan qilingan tahlil</h4>
                  </div>
                  <span className="ai-panel-badge">To'liq tahlil</span>
                </div>

                <div className="ai-analysis-content-scroll">
                  {currentSub?.gaps && currentSub.gaps.length > 0 ? (
                    currentSub.gaps.map((gap, gIdx) => (
                      <div key={gap.id || gIdx} className="ai-gap-card-dark">
                        {gap.text && gap.text !== currentSub.text && (
                          <div className="ai-gap-target-badge">🎯 {gap.text}</div>
                        )}
                        <div className="ai-dark-markdown">
                          <ReactMarkdown>{gap.aiAnalysis || "Ushbu ibora grammatikasi tahlil qilinmoqda..."}</ReactMarkdown>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="ai-modal-no-analysis">
                      <div className="empty-analysis-icon">📝</div>
                      <h5>Chuqur tahlil hali saqlanmagan</h5>
                      <p>Ushbu gapning grammatik qoidalari, iboralari va talaffuz xususiyatlarini avtomatik tahlil qiling.</p>
                      <button
                        className="btn-create-analysis-dark"
                        onClick={handleAnalyzeCurrentSub}
                        disabled={isAnalyzingSub}
                      >
                        {isAnalyzingSub ? "⏳ Tahlil qilinmoqda..." : "⚡ AI tahlilini yaratish"}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Center / Right Column: Interactive AI Tutor Chat */}
              <div className={`ai-modal-col-chat ${aiModalActiveTab === 'chat' ? 'is-active-tab' : ''}`}>
                <div className="ai-panel-header">
                  <div className="ai-panel-title-wrap">
                    <span className="ai-panel-icon">💬</span>
                    <h4>AI Ustoz Chat</h4>
                  </div>
                  <span className="ai-panel-status-pill">
                    <span className="pulse-indicator"></span> Jonli muloqot
                  </span>
                </div>

                {/* Quick Prompts Chips */}
                <div className="ai-modal-chips-row">
                  <button
                    className="ai-modal-chip"
                    onClick={() => handleSendChatMessage("Nega aynan ushbu zamon ishlatildi?")}
                    disabled={isChatSending || isStreaming}
                  >
                    💡 Nega bu zamon?
                  </button>
                  <button
                    className="ai-modal-chip"
                    onClick={() => handleSendChatMessage("Shunga o'xshash 2 ta kundalik misol keltir.")}
                    disabled={isChatSending || isStreaming}
                  >
                    💡 O'xshash 2 ta misol
                  </button>
                  <button
                    className="ai-modal-chip"
                    onClick={() => handleSendChatMessage("Bu yerdagi iboralar va o'zak so'zlarni tushuntir.")}
                    disabled={isChatSending || isStreaming}
                  >
                    💡 Iboralarni tushuntir
                  </button>
                  <button
                    className="ai-modal-chip"
                    onClick={() => handleSendChatMessage("Gapning ma'nosini o'zbek tilida batafsil tushuntir.")}
                    disabled={isChatSending || isStreaming}
                  >
                    💡 O'zbekcha batafsil
                  </button>
                </div>

                {/* Chat Feed */}
                <div className="ai-modal-chat-feed" ref={modalChatFeedRef}>
                  {chatMessages.length === 0 && !isChatSending && !isStreaming ? (
                    <div className="ai-chat-feed-empty">
                      <div className="empty-chat-stars">✨</div>
                      <h5>Savolingizni bering!</h5>
                      <p>Ushbu gap bo'yicha tushunarsiz so'z, zamon yoki talaffuz bo'yicha AI Ustoz bilan suhbatlashing.</p>
                    </div>
                  ) : (
                    chatMessages.map((msg, mIdx) => {
                      const isLatestUser = mIdx === lastUserMsgIndex;
                      return (
                        <div
                          key={mIdx}
                          ref={isLatestUser ? latestUserMsgRef : null}
                          className={`ai-chat-bubble-row ${msg.role === 'User' ? 'is-user-msg' : 'is-ai-msg'}`}
                        >
                          <div className="ai-chat-bubble-box">
                            <span className="ai-bubble-author">{msg.role === 'User' ? 'Siz' : 'AI Ustoz'}</span>
                            <div className="ai-bubble-text">
                              <ReactMarkdown>{msg.content}</ReactMarkdown>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}

                  {/* Typewriter Streaming AI Message */}
                  {isStreaming && streamingAiText !== null && (
                    <div
                      ref={latestAiMsgRef}
                      className="ai-chat-bubble-row is-ai-msg is-streaming"
                    >
                      <div className="ai-chat-bubble-box">
                        <span className="ai-bubble-author">AI Ustoz</span>
                        <div className="ai-bubble-text">
                          <ReactMarkdown>{streamingAiText}</ReactMarkdown>
                          <span className="streaming-cursor-pulse">▋</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Animated Thinking State */}
                  {isChatSending && (
                    <div
                      ref={latestAiMsgRef}
                      className="ai-chat-bubble-row is-ai-msg is-thinking-state"
                    >
                      <div className="ai-chat-bubble-box thinking-box">
                        <div className="thinking-dots-anim">
                          <span></span>
                          <span></span>
                          <span></span>
                        </div>
                        <span className="thinking-text-label">AI Ustoz javob yozmoqda...</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Chat Input Row */}
                <div className="ai-modal-input-container">
                  <input
                    type="text"
                    placeholder={
                      isChatSending || isStreaming 
                        ? "AI javob yozmoqda (savolingizni yozib turavering)..." 
                        : "Ushbu gap yuzasidan savol bering..."
                    }
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        if (!isChatSending && !isStreaming && chatInput.trim()) {
                          handleSendChatMessage();
                        }
                      }
                    }}
                    className="ai-modal-input-field"
                  />
                  <button
                    className="ai-modal-send-button"
                    onClick={() => handleSendChatMessage()}
                    disabled={isChatSending || isStreaming || !chatInput.trim()}
                    title={
                      isChatSending || isStreaming 
                        ? "AI javob berishini kuting..." 
                        : !chatInput.trim() 
                          ? "Savol matnini kiriting" 
                          : "Yuborish"
                    }
                  >
                    <span>Jo'natish</span>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="send-arrow-svg">
                      <line x1="22" y1="2" x2="11" y2="13"></line>
                      <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>,
        modalMountNode || document.body
      )}

      {/* Subscription Plans Modal */}
      <SubscriptionPlansModal 
        isOpen={isSubscriptionModalOpen} 
        onClose={() => setIsSubscriptionModalOpen(false)}
        onSubscriptionUpdated={() => {
          checkSubscription();
        }}
      />
    </div>
  );
};

export default PlayerPage;
