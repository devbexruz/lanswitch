import sys
from PyQt6.QtWidgets import (QApplication, QMainWindow, QWidget, QVBoxLayout, 
                             QHBoxLayout, QPushButton, QLabel, QLineEdit, 
                             QScrollArea, QGridLayout, QFrame, QListWidget, 
                             QStackedWidget, QTextBrowser, QSlider, QSizePolicy)
from PyQt6.QtCore import Qt, QSize
from PyQt6.QtGui import QFont, QColor, QIcon

class AnimeCard(QFrame):
    """Bosh sahifadagi har bir anime uchun kichik karta (Thumbnail)"""
    def __init__(self, title, episodes):
        super().__init__()
        self.setFixedSize(200, 280)
        self.setFrameShape(QFrame.Shape.StyledPanel)
        self.setStyleSheet("""
            QFrame {
                background-color: #1e1e1e;
                border-radius: 10px;
                border: 1px solid #333;
            }
            QFrame:hover {
                border: 1px solid #ff0000;
            }
        """)
        
        layout = QVBoxLayout(self)
        
        # Poster o'rniga vaqtinchalik rangli blok
        self.poster = QFrame()
        self.poster.setStyleSheet("background-color: #333; border-radius: 5px;")
        self.poster.setFixedHeight(180)
        
        self.title_label = QLabel(title)
        self.title_label.setStyleSheet("color: white; font-weight: bold; border: none;")
        self.title_label.setWordWrap(True)
        
        self.info_label = QLabel(f"{episodes} qismlar")
        self.info_label.setStyleSheet("color: #888; font-size: 11px; border: none;")
        
        layout.addWidget(self.poster)
        layout.addWidget(self.title_label)
        layout.addWidget(self.info_label)

class LanswitchUI(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("Lanswitch - Learn Language through Anime")
        self.setMinimumSize(1200, 800)
        self.setStyleSheet("background-color: #0f0f0f; color: white;")

        # Asosiy Stacked Widget (Sahifalar almashinuvi uchun)
        self.pages = QStackedWidget()
        self.setCentralWidget(self.pages)

        self.init_home_page()
        self.init_player_page()

    def init_home_page(self):
        """1-SAHIFA: Katalog va Bosh menyu"""
        home_widget = QWidget()
        home_layout = QHBoxLayout(home_widget)
        home_layout.setContentsMargins(0, 0, 0, 0)

        # --- LEFT SIDEBAR (Menyu) ---
        sidebar = QFrame()
        sidebar.setFixedWidth(200)
        sidebar.setStyleSheet("background-color: #0f0f0f; border-right: 1px solid #222;")
        side_layout = QVBoxLayout(sidebar)
        
        menu_items = ["Bosh sahifa", "Mening lug'atim", "Kategoriyalar", "Sozlamalar"]
        for item in menu_items:
            btn = QPushButton(item)
            btn.setStyleSheet("QPushButton { text-align: left; padding: 10px; border: none; font-size: 14px; } "
                            "QPushButton:hover { background-color: #222; border-radius: 5px; }")
            side_layout.addWidget(btn)
        side_layout.addStretch()
        home_layout.addWidget(sidebar)

        # --- CENTRAL CONTENT (Katalog) ---
        central_container = QVBoxLayout()
        
        # Qidiruv paneli
        search_bar = QLineEdit()
        search_bar.setPlaceholderText("Anime qidirish...")
        search_bar.setStyleSheet("padding: 10px; background-color: #121212; border: 1px solid #333; border-radius: 20px; color: white;")
        central_container.addWidget(search_bar)

        # Scroll bo'limi (Anime Grid)
        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll.setStyleSheet("border: none;")
        
        grid_widget = QWidget()
        self.grid_layout = QGridLayout(grid_widget)
        
        # Test uchun animelar qo'shish
        for i in range(12):
            card = AnimeCard(f"Anime Nomi {i+1}", f"24")
            # Kartaga bosilganda pleyerga o'tish
            card.mousePressEvent = lambda e: self.pages.setCurrentIndex(1)
            self.grid_layout.addWidget(card, i // 4, i % 4)
        
        scroll.setWidget(grid_widget)
        central_container.addWidget(scroll)
        home_layout.addLayout(central_container, 4)

        # --- RIGHT SIDEBAR (Oxirgi ko'rilganlar) ---
        right_sidebar = QFrame()
        right_sidebar.setFixedWidth(250)
        right_sidebar.setStyleSheet("background-color: #0f0f0f; border-left: 1px solid #222;")
        right_layout = QVBoxLayout(right_sidebar)
        
        label = QLabel("Yaqinda ko'rilganlar")
        label.setStyleSheet("font-weight: bold; font-size: 16px; margin-bottom: 10px;")
        right_layout.addWidget(label)
        
        recent_list = QListWidget()
        recent_list.setStyleSheet("border: none; color: #aaa;")
        recent_list.addItems(["Naruto ep 12", "One Piece ep 100", "Jujutsu Kaisen ep 5"])
        right_layout.addWidget(recent_list)
        
        home_layout.addWidget(right_sidebar)
        self.pages.addWidget(home_widget)

    def init_player_page(self):
        """2-SAHIFA: Video Pleyer va Tahlil (YouTube uslubida)"""
        player_widget = QWidget()
        player_main_layout = QHBoxLayout(player_widget)

        # --- LEFT: Video va Subtitr bo'limi ---
        left_side = QVBoxLayout()
        
        # Back Button
        back_btn = QPushButton("<- Orqaga katalogga")
        back_btn.clicked.connect(lambda: self.pages.setCurrentIndex(0))
        back_btn.setStyleSheet("background-color: #222; border: none; padding: 5px;")
        left_side.addWidget(back_btn)

        # Video Player (Placeholder)
        self.video_frame = QFrame()
        self.video_frame.setMinimumHeight(450)
        self.video_frame.setStyleSheet("background-color: black; border: 1px solid #333;")
        video_label = QLabel("VIDEO PLAYER", self.video_frame)
        video_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        left_side.addWidget(self.video_frame)

        # Controls (Oldinga-orqaga)
        control_bar = QHBoxLayout()
        for txt in ["-10s", "Play", "+10s"]:
            btn = QPushButton(txt)
            btn.setFixedWidth(60)
            btn.setStyleSheet("background: #1e1e1e; border-radius: 5px;")
            control_bar.addWidget(btn)
        control_bar.addStretch()
        left_side.addLayout(control_bar)

        # SUBTITRE BLOCK (Siz so'ragan alohida bo'lim)
        sub_block = QVBoxLayout()
        
        self.eng_sub_browser = QTextBrowser()
        # HTML orqali grammatikani qizartirish misoli
        eng_text = """
        <p style='font-size: 20px; color: white;'>
        The man <span style='color: #ff4444; text-decoration: underline;'>who was running</span> 
        towards the house is my <b style='color: #00ff00;'>notorious</b> brother.
        </p>
        """
        self.eng_sub_browser.setHtml(eng_text)
        self.eng_sub_browser.setFixedHeight(80)
        self.eng_sub_browser.setStyleSheet("background: transparent; border: 1px solid #222;")
        
        self.uzb_sub_label = QLabel("Uyga qarab yugurayotgan odam mening mashhur (yomon ma'noda) akamdir.")
        self.uzb_sub_label.setStyleSheet("color: #888; font-size: 16px; padding: 5px;")
        
        sub_block.addWidget(self.eng_sub_browser)
        sub_block.addWidget(self.uzb_sub_label)
        left_side.addLayout(sub_block)
        
        player_main_layout.addLayout(left_side, 7)

        # --- RIGHT: Epizodlar va Lug'at tahlili ---
        right_side = QVBoxLayout()
        
        # Epizodlar pleylisti
        ep_label = QLabel("Epizodlar")
        ep_label.setStyleSheet("font-weight: bold;")
        right_side.addWidget(ep_label)
        
        ep_list = QListWidget()
        ep_list.setStyleSheet("background: #121212; border: 1px solid #222;")
        ep_list.addItems([f"{i}-Epizod" for i in range(1, 13)])
        right_side.addWidget(ep_list)

        # AI Tahlil bo'limi (So'zlar)
        words_label = QLabel("Ushbu epizodagi maxsus so'zlar")
        words_label.setStyleSheet("font-weight: bold; color: #00ff00; margin-top: 10px;")
        right_side.addWidget(words_label)
        
        self.notorious_words = QListWidget()
        self.notorious_words.setStyleSheet("background: #121212; color: #ffaa00;")
        self.notorious_words.addItems(["Notorious - Mashhur (salbiy)", "Towards - Tomon", "Struggle - Kurash"])
        right_side.addWidget(self.notorious_words)

        player_main_layout.addLayout(right_side, 3)
        self.pages.addWidget(player_widget)

if __name__ == "__main__":
    app = QApplication(sys.argv)
    window = LanswitchUI()
    window.show()
    sys.exit(app.exec())