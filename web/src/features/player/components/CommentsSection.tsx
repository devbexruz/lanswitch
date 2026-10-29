import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../../context/AuthContext';
import './CommentsSection.css';

interface User {
  id: number;
  fullName: string;
  profileImage?: string;
  avatarUrl?: string;
  role?: string;
  isAdmin?: boolean;
}

interface Reply {
  id: number;
  text: string;
  createdAt: string;
  parentCommentId?: number;
  likesCount: number;
  dislikesCount: number;
  userReaction?: 'like' | 'dislike' | null;
  user: User;
}

interface Comment {
  id: number;
  text: string;
  createdAt: string;
  likesCount: number;
  dislikesCount: number;
  userReaction?: 'like' | 'dislike' | null;
  user: User;
  replies: Reply[];
}

interface CommentsSectionProps {
  mediaId: number;
}

function formatRelativeTime(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (isNaN(diffSec) || diffSec < 0) return 'Hozirgina';
    if (diffSec < 60) return 'Hozirgina';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin} daqiqa oldin`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour} soat oldin`;
    const diffDays = Math.floor(diffHour / 24);
    if (diffDays === 1) return 'Kecha';
    if (diffDays < 7) return `${diffDays} kun oldin`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} hafta oldin`;
    return date.toLocaleDateString('uz-UZ', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  } catch {
    return dateStr;
  }
}

function getInitials(name?: string): string {
  if (!name) return 'U';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return parts[0].slice(0, 2).toUpperCase();
}

const CommentsSection: React.FC<CommentsSectionProps> = ({ mediaId }) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [newCommentText, setNewCommentText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [replyingToId, setReplyingToId] = useState<number | null>(null);
  const [replyText, setReplyText] = useState('');
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);
  const [expandedReplies, setExpandedReplies] = useState<Record<number, boolean>>({});
  const [sortBy, setSortBy] = useState<'newest' | 'top'>('newest');

  const { user, requireAuth } = useAuth();

  useEffect(() => {
    fetchComments();
  }, [mediaId, user?.id]);

  const fetchComments = async () => {
    setIsLoading(true);
    try {
      const url = user?.id 
        ? `/api/comment/media/${mediaId}?userId=${user.id}`
        : `/api/comment/media/${mediaId}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setComments(data);
      }
    } catch (error) {
      console.error("Error fetching comments", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePostComment = async () => {
    if (!newCommentText.trim() || isSubmitting) return;

    requireAuth(async () => {
      setIsSubmitting(true);
      try {
        const res = await fetch('/api/comment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user?.id || 1,
            mediaId,
            text: newCommentText.trim(),
            parentCommentId: null
          })
        });

        if (res.ok) {
          const newComment = await res.json();
          setNewCommentText('');
          setComments(prev => [newComment, ...prev]);
        }
      } catch (e) {
        console.error("Failed to post comment", e);
      } finally {
        setIsSubmitting(false);
      }
    });
  };

  const handlePostReply = async (parentCommentId: number) => {
    if (!replyText.trim() || isSubmittingReply) return;

    requireAuth(async () => {
      setIsSubmittingReply(true);
      try {
        const res = await fetch('/api/comment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user?.id || 1,
            mediaId,
            text: replyText.trim(),
            parentCommentId
          })
        });

        if (res.ok) {
          const newReply = await res.json();
          setReplyText('');
          setReplyingToId(null);
          // Auto-expand replies for this comment
          setExpandedReplies(prev => ({ ...prev, [parentCommentId]: true }));
          setComments(prev =>
            prev.map(c => {
              if (c.id === parentCommentId) {
                return {
                  ...c,
                  replies: [...(c.replies || []), newReply]
                };
              }
              return c;
            })
          );
        }
      } catch (e) {
        console.error("Failed to post reply", e);
      } finally {
        setIsSubmittingReply(false);
      }
    });
  };

  const handleToggleReaction = async (commentId: number, reactionType: 'like' | 'dislike', isReply = false, parentId?: number) => {
    requireAuth(async () => {
      // 1. Optimistic UI update
      const updateReactionState = (item: { likesCount: number; dislikesCount: number; userReaction?: 'like' | 'dislike' | null }) => {
        let { likesCount, dislikesCount, userReaction } = item;

        if (reactionType === 'like') {
          if (userReaction === 'like') {
            likesCount = Math.max(0, likesCount - 1);
            userReaction = null;
          } else {
            if (userReaction === 'dislike') {
              dislikesCount = Math.max(0, dislikesCount - 1);
            }
            likesCount += 1;
            userReaction = 'like';
          }
        } else {
          if (userReaction === 'dislike') {
            dislikesCount = Math.max(0, dislikesCount - 1);
            userReaction = null;
          } else {
            if (userReaction === 'like') {
              likesCount = Math.max(0, likesCount - 1);
            }
            dislikesCount += 1;
            userReaction = 'dislike';
          }
        }

        return { ...item, likesCount, dislikesCount, userReaction };
      };

      setComments(prev =>
        prev.map(c => {
          if (!isReply && c.id === commentId) {
            return updateReactionState(c) as Comment;
          }
          if (isReply && parentId && c.id === parentId) {
            return {
              ...c,
              replies: c.replies.map(r => r.id === commentId ? (updateReactionState(r) as Reply) : r)
            };
          }
          return c;
        })
      );

      // 2. Server API call
      try {
        const endpoint = reactionType === 'like' ? `/api/comment/${commentId}/like` : `/api/comment/${commentId}/dislike`;
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user?.id || 1 })
        });

        if (res.ok) {
          const data = await res.json();
          // Sync server counts
          setComments(prev =>
            prev.map(c => {
              if (!isReply && c.id === commentId) {
                return {
                  ...c,
                  likesCount: data.likesCount,
                  dislikesCount: data.dislikesCount,
                  userReaction: data.userReaction
                };
              }
              if (isReply && parentId && c.id === parentId) {
                return {
                  ...c,
                  replies: c.replies.map(r =>
                    r.id === commentId
                      ? {
                          ...r,
                          likesCount: data.likesCount,
                          dislikesCount: data.dislikesCount,
                          userReaction: data.userReaction
                        }
                      : r
                  )
                };
              }
              return c;
            })
          );
        }
      } catch (e) {
        console.error("Failed to react to comment", e);
      }
    });
  };

  const toggleRepliesVisibility = (commentId: number) => {
    setExpandedReplies(prev => ({
      ...prev,
      [commentId]: !prev[commentId]
    }));
  };

  // Sort comments
  const sortedComments = useMemo(() => {
    const list = [...comments];
    if (sortBy === 'top') {
      return list.sort((a, b) => (b.likesCount - b.dislikesCount) - (a.likesCount - a.dislikesCount));
    }
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [comments, sortBy]);

  const totalCommentsCount = useMemo(() => {
    return comments.reduce((acc, c) => acc + 1 + (c.replies?.length || 0), 0);
  }, [comments]);

  const renderAvatar = (u?: User, size: 'normal' | 'small' = 'normal') => {
    const avatarImg = u?.avatarUrl || u?.profileImage;
    const sizeClass = size === 'small' ? 'avatar-small' : 'avatar-normal';

    if (avatarImg) {
      return (
        <img
          src={avatarImg}
          alt={u?.fullName || "Foydalanuvchi"}
          className={`comment-avatar-img ${sizeClass}`}
          onError={(e) => {
            // fallback to initials on broken image
            e.currentTarget.style.display = 'none';
          }}
        />
      );
    }

    return (
      <div className={`comment-avatar-fallback ${sizeClass}`}>
        {getInitials(u?.fullName)}
      </div>
    );
  };

  return (
    <div className="comments-section-container">
      {/* Top Header */}
      <div className="comments-header">
        <div className="comments-count-title">
          <svg className="comments-title-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
          <span className="comments-title-text">Fikrlar</span>
          <span className="comments-count-badge">{totalCommentsCount}</span>
        </div>

        {comments.length > 1 && (
          <div className="comments-sort-group">
            <button
              className={`sort-pill-btn ${sortBy === 'newest' ? 'is-active' : ''}`}
              onClick={() => setSortBy('newest')}
            >
              Eng yangi
            </button>
            <button
              className={`sort-pill-btn ${sortBy === 'top' ? 'is-active' : ''}`}
              onClick={() => setSortBy('top')}
            >
              Eng ommabop
            </button>
          </div>
        )}
      </div>

      {/* Input Box for New Comment */}
      <div className="comment-composer-card">
        <div className="composer-avatar-col">
          {renderAvatar(user as any || { fullName: 'Foydalanuvchi' }, 'normal')}
        </div>
        <div className="composer-input-col">
          <textarea
            className="composer-textarea"
            placeholder={user ? "Fikringiz yoki savolingizni qoldiring..." : "Fikr bildirish uchun bosing..."}
            value={newCommentText}
            onChange={(e) => setNewCommentText(e.target.value)}
            rows={newCommentText ? 3 : 2}
            onFocus={() => {
              if (!user) requireAuth(() => {});
            }}
          />
          <div className="composer-actions-bar">
            {newCommentText.trim() && (
              <button
                type="button"
                className="btn-composer-cancel"
                onClick={() => setNewCommentText('')}
                disabled={isSubmitting}
              >
                Bekor qilish
              </button>
            )}
            <button
              type="button"
              className="btn-composer-submit"
              disabled={!newCommentText.trim() || isSubmitting}
              onClick={handlePostComment}
            >
              {isSubmitting ? (
                <span className="composer-spinner"></span>
              ) : (
                <>
                  <span>Fikr bildirish</span>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="send-svg-icon">
                    <line x1="22" y1="2" x2="11" y2="13"></line>
                    <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                  </svg>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Comments List */}
      <div className="comments-stream-list">
        {isLoading && comments.length === 0 ? (
          <div className="comments-loading-state">
            <div className="comments-loader-dots">
              <span></span>
              <span></span>
              <span></span>
            </div>
            <p>Fikrlar yuklanmoqda...</p>
          </div>
        ) : sortedComments.length === 0 ? (
          <div className="comments-empty-state">
            <div className="empty-bubble-icon">💬</div>
            <h4>Hali fikrlar yo'q</h4>
            <p>Birinchi bo'lib o'z fikringiz yoki taassurotlaringizni qoldiring!</p>
          </div>
        ) : (
          sortedComments.map(c => {
            const hasReplies = c.replies && c.replies.length > 0;
            const isRepliesOpen = expandedReplies[c.id] ?? true; // expanded by default or toggled

            return (
              <div key={c.id} className="comment-card-item">
                <div className="comment-primary-row">
                  <div className="comment-avatar-wrapper">
                    {renderAvatar(c.user, 'normal')}
                  </div>

                  <div className="comment-body-wrapper">
                    {/* Header info */}
                    <div className="comment-user-row">
                      <div className="user-name-badges">
                        <span className="user-fullname">{c.user?.fullName || "Noma'lum foydalanuvchi"}</span>
                        {c.user?.isAdmin && <span className="user-badge badge-admin">Admin</span>}
                        {!c.user?.isAdmin && c.user?.role === 'Teacher' && (
                          <span className="user-badge badge-teacher">Ustoz</span>
                        )}
                      </div>
                      <span className="comment-timestamp" title={new Date(c.createdAt).toLocaleString()}>
                        {formatRelativeTime(c.createdAt)}
                      </span>
                    </div>

                    {/* Text content */}
                    <div className="comment-text-content">
                      {c.text}
                    </div>

                    {/* Reaction & Action Buttons */}
                    <div className="comment-interactive-bar">
                      {/* Like button */}
                      <button
                        type="button"
                        className={`reaction-btn reaction-like ${c.userReaction === 'like' ? 'is-active-like' : ''}`}
                        onClick={() => handleToggleReaction(c.id, 'like')}
                        title="Yoqdi"
                      >
                        <svg viewBox="0 0 24 24" fill={c.userReaction === 'like' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                          <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path>
                        </svg>
                        <span className="reaction-count">{c.likesCount > 0 ? c.likesCount : ''}</span>
                      </button>

                      {/* Dislike button */}
                      <button
                        type="button"
                        className={`reaction-btn reaction-dislike ${c.userReaction === 'dislike' ? 'is-active-dislike' : ''}`}
                        onClick={() => handleToggleReaction(c.id, 'dislike')}
                        title="Yoqmadi"
                      >
                        <svg viewBox="0 0 24 24" fill={c.userReaction === 'dislike' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                          <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3"></path>
                        </svg>
                        <span className="reaction-count">{c.dislikesCount > 0 ? c.dislikesCount : ''}</span>
                      </button>

                      {/* Reply button */}
                      <button
                        type="button"
                        className="comment-action-btn reply-btn"
                        onClick={() => {
                          requireAuth(() => {
                            setReplyingToId(replyingToId === c.id ? null : c.id);
                          });
                        }}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="reply-svg-icon">
                          <polyline points="9 17 4 12 9 7"></polyline>
                          <path d="M20 18v-2a4 4 0 0 0-4-4H4"></path>
                        </svg>
                        <span>Javob berish</span>
                      </button>
                    </div>

                    {/* Inline Reply Input */}
                    {replyingToId === c.id && (
                      <div className="reply-composer-box animate-fade-in">
                        <div className="reply-composer-inner">
                          {renderAvatar(user as any || { fullName: 'Foydalanuvchi' }, 'small')}
                          <div className="reply-input-wrapper">
                            <textarea
                              className="reply-textarea"
                              placeholder={`@${c.user?.fullName || "foydalanuvchi"}ga javob yozing...`}
                              value={replyText}
                              onChange={(e) => setReplyText(e.target.value)}
                              autoFocus
                              rows={2}
                            />
                            <div className="reply-actions-row">
                              <button
                                type="button"
                                className="btn-reply-cancel"
                                onClick={() => {
                                  setReplyingToId(null);
                                  setReplyText('');
                                }}
                                disabled={isSubmittingReply}
                              >
                                Bekor qilish
                              </button>
                              <button
                                type="button"
                                className="btn-reply-submit"
                                disabled={!replyText.trim() || isSubmittingReply}
                                onClick={() => handlePostReply(c.id)}
                              >
                                {isSubmittingReply ? "Yuborilmoqda..." : "Javob yozish"}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Replies Collapsible Toggle & Thread */}
                    {hasReplies && (
                      <div className="comment-replies-thread">
                        <button
                          type="button"
                          className="replies-collapse-toggle"
                          onClick={() => toggleRepliesVisibility(c.id)}
                        >
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            className={`chevron-icon ${isRepliesOpen ? 'is-open' : ''}`}
                          >
                            <polyline points="6 9 12 15 18 9"></polyline>
                          </svg>
                          <span>{c.replies.length} ta javob</span>
                        </button>

                        {isRepliesOpen && (
                          <div className="replies-stream">
                            {c.replies.map(r => (
                              <div key={r.id} className="reply-card-item">
                                <div className="reply-avatar-col">
                                  {renderAvatar(r.user, 'small')}
                                </div>
                                <div className="reply-body-col">
                                  <div className="comment-user-row">
                                    <div className="user-name-badges">
                                      <span className="user-fullname">{r.user?.fullName || "Noma'lum"}</span>
                                      {r.user?.isAdmin && <span className="user-badge badge-admin">Admin</span>}
                                      {!r.user?.isAdmin && r.user?.role === 'Teacher' && (
                                        <span className="user-badge badge-teacher">Ustoz</span>
                                      )}
                                    </div>
                                    <span className="comment-timestamp" title={new Date(r.createdAt).toLocaleString()}>
                                      {formatRelativeTime(r.createdAt)}
                                    </span>
                                  </div>

                                  <div className="comment-text-content reply-text">
                                    {r.text}
                                  </div>

                                  <div className="comment-interactive-bar reply-bar">
                                    <button
                                      type="button"
                                      className={`reaction-btn reaction-like ${r.userReaction === 'like' ? 'is-active-like' : ''}`}
                                      onClick={() => handleToggleReaction(r.id, 'like', true, c.id)}
                                      title="Yoqdi"
                                    >
                                      <svg viewBox="0 0 24 24" fill={r.userReaction === 'like' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                                        <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path>
                                      </svg>
                                      <span className="reaction-count">{r.likesCount > 0 ? r.likesCount : ''}</span>
                                    </button>

                                    <button
                                      type="button"
                                      className={`reaction-btn reaction-dislike ${r.userReaction === 'dislike' ? 'is-active-dislike' : ''}`}
                                      onClick={() => handleToggleReaction(r.id, 'dislike', true, c.id)}
                                      title="Yoqmadi"
                                    >
                                      <svg viewBox="0 0 24 24" fill={r.userReaction === 'dislike' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                                        <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3"></path>
                                      </svg>
                                      <span className="reaction-count">{r.dislikesCount > 0 ? r.dislikesCount : ''}</span>
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default CommentsSection;
