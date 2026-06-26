import React from 'react';
import './NotificationsModal.css';

interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const mockNotifications = [
  { id: 1, type: 'success', title: "Yangi So'zlar Yodlandi", text: "Siz bugun 5 ta yangi so'z o'rgandingiz. Ajoyib!", time: "10 daqiqa oldin", unread: true },
  { id: 2, type: 'warning', title: "Takrorlash Vaqti", text: "2 ta grammatika qoidasi esdan chiqishni boshladi. Takrorlashni unutmang.", time: "1 soat oldin", unread: true },
  { id: 3, type: 'info', title: "Yangi Kino", text: "Rus tilida 'Брат' kinosi qo'shildi. Hoziroq ko'ring!", time: "Kechasi", unread: false }
];

const NotificationsModal: React.FC<NotificationsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <>
      {/* Invisible overlay to close dropdown when clicked outside */}
      <div className="dropdown-overlay" onClick={onClose}></div>
      
      <div className="notifications-dropdown animate-slide-down">
        <div className="notifications-header">
          <h3>Bildirishnomalar</h3>
          <button className="mark-read-btn">Barchasini o'qildi qilish</button>
        </div>
        
        <div className="notifications-list">
          {mockNotifications.map(notification => (
            <div key={notification.id} className={`notification-item ${notification.unread ? 'unread' : ''}`}>
              <div className={`notification-icon bg-${notification.type}`}>
                {notification.type === 'success' && '✨'}
                {notification.type === 'warning' && '⚠️'}
                {notification.type === 'info' && '🎬'}
              </div>
              <div className="notification-content">
                <h4>{notification.title}</h4>
                <p>{notification.text}</p>
                <span className="notification-time">{notification.time}</span>
              </div>
              {notification.unread && <div className="unread-dot"></div>}
            </div>
          ))}
        </div>
        
        <div className="notifications-footer">
          <button className="btn btn-outline-light" style={{ width: '100%', border: 'none' }}>Barchasini ko'rish</button>
        </div>
      </div>
    </>
  );
};

export default NotificationsModal;
