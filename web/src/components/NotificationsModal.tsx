import React from 'react';
import './NotificationsModal.css';

interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: any[];
  onMarkAsRead: (id: number) => void;
  onMarkAllAsRead: () => void;
}

const formatTimeAgo = (dateStr: string) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Hozirgina';
  if (minutes < 60) return `${minutes} daqiqa oldin`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} soat oldin`;
  const days = Math.floor(hours / 24);
  return `${days} kun oldin`;
};

const NotificationsModal: React.FC<NotificationsModalProps> = ({ isOpen, onClose, notifications, onMarkAsRead, onMarkAllAsRead }) => {
  if (!isOpen) return null;

  return (
    <>
      <div className="dropdown-overlay" onClick={onClose}></div>
      
      <div className="notifications-dropdown animate-slide-down">
        <div className="notifications-header">
          <h3>Bildirishnomalar</h3>
          <button className="mark-read-btn" onClick={onMarkAllAsRead}>Barchasini o'qildi qilish</button>
        </div>
        
        <div className="notifications-list">
          {notifications.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)' }}>Bildirishnomalar yo'q</div>
          ) : (
            notifications.map(notification => (
              <div 
                key={notification.id} 
                className={`notification-item ${!notification.isRead ? 'unread' : ''}`}
                onClick={() => !notification.isRead && onMarkAsRead(notification.id)}
                style={{ cursor: !notification.isRead ? 'pointer' : 'default' }}
              >
                <div className={`notification-icon bg-${notification.type || 'info'}`}>
                  {notification.type === 'success' && '✨'}
                  {notification.type === 'warning' && '⚠️'}
                  {(notification.type === 'info' || !notification.type) && '🔔'}
                </div>
                <div className="notification-content">
                  <h4>{notification.title}</h4>
                  <p>{notification.message}</p>
                  <span className="notification-time">{formatTimeAgo(notification.createdAt)}</span>
                </div>
                {!notification.isRead && <div className="unread-dot"></div>}
              </div>
            ))
          )}
        </div>
        
        <div className="notifications-footer">
          <button className="btn btn-outline-light" style={{ width: '100%', border: 'none' }}>Barchasini ko'rish</button>
        </div>
      </div>
    </>
  );
};

export default NotificationsModal;
