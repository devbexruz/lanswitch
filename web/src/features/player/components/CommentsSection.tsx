import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import './CommentsSection.css';

interface User {
  id: number;
  fullName: string;
  profileImage: string;
}

interface Reply {
  id: number;
  text: string;
  createdAt: string;
  user: User;
}

interface Comment {
  id: number;
  text: string;
  createdAt: string;
  likesCount: number;
  user: User;
  replies: Reply[];
}

interface CommentsSectionProps {
  mediaId: number;
}

const CommentsSection: React.FC<CommentsSectionProps> = ({ mediaId }) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newCommentText, setNewCommentText] = useState('');
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [replyText, setReplyText] = useState('');
  
  const { user, requireAuth } = useAuth();

  useEffect(() => {
    fetchComments();
  }, [mediaId]);

  const fetchComments = async () => {
    try {
      const res = await fetch(`/api/comment/media/${mediaId}`);
      if (res.ok) {
        const data = await res.json();
        setComments(data);
      }
    } catch (error) {
      console.error("Error fetching comments", error);
    }
  };

  const handlePostComment = async () => {
    if (!newCommentText.trim()) return;
    
    requireAuth(async () => {
      try {
        const res = await fetch('/api/comment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user?.id || 1, // fallback to 1 for demo
            mediaId,
            text: newCommentText,
            parentCommentId: null
          })
        });
        
        if (res.ok) {
          setNewCommentText('');
          fetchComments();
        }
      } catch (e) {
        console.error("Failed to post comment", e);
      }
    });
  };

  const handlePostReply = async (parentId: number) => {
    if (!replyText.trim()) return;

    requireAuth(async () => {
      try {
        const res = await fetch('/api/comment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user?.id || 1,
            mediaId,
            text: replyText,
            parentCommentId: parentId
          })
        });
        
        if (res.ok) {
          setReplyText('');
          setReplyingTo(null);
          fetchComments();
        }
      } catch (e) {
        console.error("Failed to post reply", e);
      }
    });
  };

  const handleToggleLike = async (commentId: number) => {
    requireAuth(async () => {
      try {
        const res = await fetch(`/api/comment/${commentId}/like`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user?.id || 1 })
        });
        if (res.ok) {
          fetchComments();
        }
      } catch (e) {
        console.error("Failed to like", e);
      }
    });
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
  };

  return (
    <div className="comments-section">
      <h3 className="comments-title">Fikrlar ({comments.length})</h3>
      
      <div className="add-comment-box glass-panel">
        <textarea 
          placeholder="Fikringizni yozing..."
          value={newCommentText}
          onChange={(e) => setNewCommentText(e.target.value)}
        ></textarea>
        <div className="comment-actions">
          <button className="btn btn-primary" onClick={handlePostComment}>Qoldirish</button>
        </div>
      </div>

      <div className="comments-list">
        {comments.map(c => (
          <div key={c.id} className="comment-thread glass-panel">
            <div className="comment-main">
              <img src={c.user?.profileImage || `https://ui-avatars.com/api/?name=${c.user?.fullName || 'User'}&background=random`} alt="user" className="comment-avatar" />
              <div className="comment-content">
                <div className="comment-header">
                  <span className="comment-author">{c.user?.fullName || "Noma'lum"}</span>
                  <span className="comment-date">{formatDate(c.createdAt)}</span>
                </div>
                <p className="comment-text">{c.text}</p>
                <div className="comment-footer">
                  <button className="comment-action-btn" onClick={() => handleToggleLike(c.id)}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path></svg>
                    {c.likesCount > 0 ? c.likesCount : 'Like'}
                  </button>
                  <button className="comment-action-btn" onClick={() => setReplyingTo(replyingTo === c.id ? null : c.id)}>Javob yozish</button>
                </div>
              </div>
            </div>

            {replyingTo === c.id && (
              <div className="reply-box">
                <textarea 
                  placeholder="Javobingizni yozing..."
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  autoFocus
                ></textarea>
                <div className="comment-actions">
                  <button className="btn btn-glass" onClick={() => setReplyingTo(null)}>Bekor qilish</button>
                  <button className="btn btn-primary" onClick={() => handlePostReply(c.id)}>Javob yozish</button>
                </div>
              </div>
            )}

            {c.replies && c.replies.length > 0 && (
              <div className="replies-list">
                {c.replies.map(r => (
                  <div key={r.id} className="comment-reply">
                    <img src={r.user?.profileImage || `https://ui-avatars.com/api/?name=${r.user?.fullName || 'User'}&background=random`} alt="user" className="comment-avatar-small" />
                    <div className="comment-content">
                      <div className="comment-header">
                        <span className="comment-author">{r.user?.fullName || "Noma'lum"}</span>
                        <span className="comment-date">{formatDate(r.createdAt)}</span>
                      </div>
                      <p className="comment-text">{r.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default CommentsSection;
