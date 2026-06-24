import sys
import os
import json
import uuid
import subprocess
import traceback
from PyQt5.QtWidgets import QApplication, QMainWindow, QFrame, QVBoxLayout, QLabel, QFileDialog, QPushButton, QInputDialog, QMessageBox, QMenu, QAction
from PyQt5 import uic
from PyQt5.QtCore import Qt, QUrl
from PyQt5.QtMultimedia import QMediaPlayer, QMediaContent
from PyQt5.QtMultimediaWidgets import QVideoWidget
from PyQt5.QtGui import QPixmap, QIcon
from PyQt5.QtCore import QSize

class AnimeCard(QFrame):
    """Katalog uchun interaktiv Anime kartasi"""
    def __init__(self, anime_id, title, image_path, click_callback, delete_callback=None):
        super().__init__()
        self.setContextMenuPolicy(Qt.CustomContextMenu)
        self.customContextMenuRequested.connect(self.show_context_menu)
        self.delete_callback = delete_callback

        self.setFixedSize(200, 280)
        self.setStyleSheet("""
            QFrame {
                background-color: #1A1A1A;
                border-radius: 15px;
            }
            QFrame:hover {
                border: 2px solid #FF0000;
                background-color: #222222;
            }
        """)
        
        layout = QVBoxLayout(self)

        # Poster (image if provided)
        poster_label = QLabel()
        poster_label.setFixedHeight(180)
        poster_label.setStyleSheet("border-radius: 10px; background-color: #333;")
        if image_path and os.path.exists(image_path):
            try:
                pix = QPixmap(image_path).scaled(poster_label.width() or 180, 180, Qt.KeepAspectRatio, Qt.SmoothTransformation)
                poster_label.setPixmap(pix)
                poster_label.setScaledContents(True)
            except Exception:
                pass

        # Sarlavha
        title_label = QLabel(title)
        title_label.setStyleSheet("color: white; font-weight: bold; font-size: 16px; border: none;")
        title_label.setWordWrap(True)
        title_label.setAlignment(Qt.AlignCenter)
        
        layout.addWidget(poster_label)
        layout.addWidget(title_label)
        # Kartaga bosilganda ishlaydigan funksiya
        self.click_callback = click_callback
        self.anime_id = anime_id

    def show_context_menu(self, pos):
        menu = QMenu(self)
        delete_action = menu.addAction("O'chirish")
        action = menu.exec_(self.mapToGlobal(pos))
        if action == delete_action:
            if hasattr(self, 'delete_callback') and self.delete_callback:
                self.delete_callback(self.anime_id)

    def mousePressEvent(self, event):
        """Sichqoncha bilan bosilganda chaqiriladi"""
        if event.button() == Qt.LeftButton:
            try:
                self.click_callback(self.anime_id)
            except TypeError:
                # backward compatibility
                self.click_callback()


class LanswitchApp(QMainWindow):
    def __init__(self):
        super().__init__()
        
        # .ui faylni yuklash (lanswitch.ui fayli main.py bilan bir papkada bo'lishi kerak)
        try:
            ui_path = os.path.join(os.path.dirname(__file__), 'lanswitch.ui')
            uic.loadUi(ui_path, self)
        except Exception as e:
            print(f"UI faylini yuklashda xatolik yuz berdi: {e}")
            sys.exit()

        # Dastur ishga tushganda Login sahifasini (Index 0) ko'rsatish
        self.stackedWidget.setCurrentIndex(0)

        # --- TUGMALARNI FUNKSIYALARGA ULASH ---
        
        # Login sahifasidagi "KIRISH" tugmasi
        self.btn_login_submit.clicked.connect(self.handle_login)
        
        # Pleyer sahifasidagi "ORQAGA" tugmasi
        if hasattr(self, 'btn_back'):
            self.btn_back.clicked.connect(self.go_to_home)

        # Add 'Add Anime' button to sidebar
        try:
            add_btn = QPushButton('+ Anime qo\'shish')
            add_btn.setMinimumHeight(40)
            add_btn.clicked.connect(self.add_anime_dialog)
            # Insert near top of sideMenu layout
            try:
                self.sideMenu.insertWidget(2, add_btn)
            except Exception:
                # fallback: add to layout
                self.sideMenu.addWidget(add_btn)
        except Exception:
            pass

        # Bosh sahifa katalogini to'ldirish
        self.populate_home_grid()

    def handle_login(self):
        """KIRISH tugmasi bosilganda ishlaydi"""
        username = self.input_user.text()
        password = self.input_pass.text()
        # Require non-empty username and password (local only)
        if not username or not password:
            QMessageBox.warning(self, 'Xato', 'Iltimos, foydalanuvchi nomi va parolni kiriting.')
            return

        # For now accept any non-empty credentials
        self.input_user.clear()
        self.input_pass.clear()
        self.stackedWidget.setCurrentIndex(1)

    def go_to_home(self):
        """Bosh sahifaga qaytish"""
        self.stackedWidget.setCurrentIndex(1)
        # Refresh grid from local store
        self.populate_home_grid()

    def delete_anime(self, anime_id):
        reply = QMessageBox.question(self, 'Tasdiqlash', "Haqiqatan ham bu animeni o'chirmoqchimisiz?",
                                     QMessageBox.Yes | QMessageBox.No, QMessageBox.No)
        if reply == QMessageBox.Yes:
            if not hasattr(self, 'store'):
                self.load_store()
            self.store['animes'] = [a for a in self.store.get('animes', []) if a.get('id') != anime_id]
            self.save_store()
            self.populate_home_grid()

    # --- Local storage for animes and episodes ---
    def data_file_path(self):
        return os.path.join(os.path.dirname(__file__), 'lanswitch_data.json')

    def load_store(self):
        path = self.data_file_path()
        if os.path.exists(path):
            try:
                with open(path, 'r', encoding='utf-8') as f:
                    self.store = json.load(f)
            except Exception:
                self.store = {'animes': []}
        else:
            self.store = {'animes': []}

    def save_store(self):
        path = self.data_file_path()
        try:
            with open(path, 'w', encoding='utf-8') as f:
                json.dump(self.store, f, indent=2, ensure_ascii=False)
        except Exception:
            pass

    def go_to_player(self):
        """Pleyer va O'rganish sahifasiga o'tish (Index 2)"""
        # Kelajakda bu yerga qaysi anime tanlanganini parametr qilib uzatib, 
        # subtitrlar va videoni shunga moslab yuklaysiz
        self.stackedWidget.setCurrentIndex(2)

    def populate_home_grid(self):
        """Bosh sahifadagi grid layoutga animelarni qo'shish"""
        # UI fayldagi 'animeGrid' nomli layoutga ulanamiz
        grid_layout = self.animeGrid

        # Ensure store loaded
        if not hasattr(self, 'store'):
            self.load_store()

        # Clear existing items in layout
        try:
            while grid_layout.count():
                item = grid_layout.takeAt(0)
                w = item.widget()
                if w is not None:
                    w.setParent(None)
        except Exception:
            pass

        # Add anime cards from local store
        animes = self.store.get('animes', [])
        for idx, anime in enumerate(animes):
            aid = anime.get('id')
            title = anime.get('title', 'No title')
            img = anime.get('image', '')
            card = AnimeCard(aid, title, img, self.go_to_player, self.delete_anime)
            row = idx // 4
            col = idx % 4
            grid_layout.addWidget(card, row, col)

        # If no anime yet, show placeholders
        if not animes:
            for i in range(4):
                card = AnimeCard(str(i), f"Naruto {i+1}-qism", None, self.go_to_player, getattr(self, 'delete_anime', None))
                row = i // 4
                col = i % 4
                grid_layout.addWidget(card, row, col)

    def go_to_player(self, anime_id=None):
        """Pleyer va O'rganish sahifasiga o'tish (Index 2). If anime_id given, populate episodes."""
        self.stackedWidget.setCurrentIndex(2)
        # ensure player initialized
        self.setup_player()

        # Load store if needed
        if not hasattr(self, 'store'):
            self.load_store()

        self.current_anime_id = anime_id
        # populate episode list
        try:
            self.epList.clear()
            anime = None
            for a in self.store.get('animes', []):
                if a.get('id') == anime_id:
                    anime = a
                    break

            if anime:
                self.epTitle.setText(anime.get('title', 'EPIZODLAR'))
                for ep in anime.get('episodes', []):
                    from PyQt5.QtWidgets import QListWidgetItem
                    if isinstance(ep, dict):
                        label = ep.get('title') or os.path.basename(ep.get('path', ''))
                        item = QListWidgetItem(label)
                        # set thumbnail icon if exists
                        thumb = ep.get('thumb') or ''
                        if thumb and os.path.exists(thumb):
                            try:
                                icon = QIcon(thumb)
                                item.setIcon(icon)
                            except Exception:
                                pass
                        item.setData(Qt.UserRole, ep)
                    else:
                        item = QListWidgetItem(os.path.basename(ep))
                        item.setData(Qt.UserRole, ep)
                    # make item taller to show thumbnail
                    try:
                        item.setSizeHint(QSize(280, 64))
                    except Exception:
                        pass
                    self.epList.addItem(item)
            else:
                self.epTitle.setText('EPIZODLAR')
        except Exception:
            pass

    def setup_player(self):
        """Create QMediaPlayer and QVideoWidget and place them into the UI."""
        if hasattr(self, 'player'):
            return

        self.video_widget = QVideoWidget()
        self.player = QMediaPlayer(None, QMediaPlayer.VideoSurface)
        self.player.setVideoOutput(self.video_widget)

        try:
            layout = self.videoCentering
        except Exception:
            layout = None

        if layout is not None:
            for i in reversed(range(layout.count())):
                item = layout.itemAt(i)
                w = item.widget()
                if w is not None:
                    layout.removeWidget(w)
                    w.deleteLater()
            # Only show the video widget here; episode add button is on the side
            layout.addWidget(self.video_widget)

        # Subtitle storage: list of (start_ms, end_ms, text)
        self.subtitles = []
        self._current_sub_index = -1

        # Connect position changed to subtitle updater
        try:
            self.player.positionChanged.connect(self.on_position_changed)
        except Exception:
            pass

        try:
            self.epList.itemDoubleClicked.connect(self.on_episode_double_clicked)
        except Exception:
            pass
        try:
            self.epList.setContextMenuPolicy(Qt.CustomContextMenu)
            self.epList.customContextMenuRequested.connect(self.show_epList_context_menu)
        except Exception:
            pass

        # Add 'Add Episode' button to player side if present
        try:
            add_ep_btn = QPushButton("Epizod qo'shish")
            add_ep_btn.clicked.connect(self.add_episode_dialog)
            # insert above epList (pSideLayout exists in UI)
            try:
                self.pSideLayout.insertWidget(1, add_ep_btn)
            except Exception:
                self.pSideLayout.addWidget(add_ep_btn)
        except Exception:
            pass

    def on_episode_double_clicked(self, item):
        """If the clicked episode has a path, play it; otherwise ask user to open a file."""
        try:
            data = item.data(Qt.UserRole)
        except Exception:
            data = None

        if isinstance(data, dict):
            path = data.get('path')
            srt = data.get('srt')
            if srt and os.path.exists(srt):
                self.load_subtitles_from_file(srt)
            else:
                # clear subtitles
                self.subtitles = []
                self._current_sub_index = -1
            if path:
                self.play_file(path)
                return

        if isinstance(data, str):
            # backward compatibility
            self.play_file(data)
            return

        # fallback: open file
        self.open_and_play_file()

    def open_and_play_file(self):
        """Prompt user to select a local video file and play it."""
        fname, _ = QFileDialog.getOpenFileName(self, "Open video", os.path.expanduser("~"), "Video Files (*.mp4 *.mkv *.avi *.mov);;All Files (*)")
        if fname:
            from PyQt5.QtWidgets import QListWidgetItem
            new_item = QListWidgetItem(os.path.basename(fname))
            new_item.setData(Qt.UserRole, fname)
            try:
                self.epList.addItem(new_item)
            except Exception:
                pass
            # Try to auto-load subtitle with same basename (.srt)
            srt_path = os.path.splitext(fname)[0] + '.srt'
            if os.path.exists(srt_path):
                self.load_subtitles_from_file(srt_path)
            else:
                # Clear any previous subtitles
                self.subtitles = []
                self._current_sub_index = -1
                try:
                    self.eng_sub_view.setHtml('')
                    self.uzb_sub_view.setText('')
                except Exception:
                    pass

            self.play_file(fname)

    def open_subtitle_file(self):
        """Prompt user to select an SRT subtitle file and load it."""
        fname, _ = QFileDialog.getOpenFileName(self, "Open subtitle", os.path.expanduser("~"), "Subtitle Files (*.srt);;All Files (*)")
        if fname:
            self.load_subtitles_from_file(fname)

    def play_file(self, path):
        """Load a local file into the media player and play it."""
        if not hasattr(self, 'player'):
            self.setup_player()

        url = QUrl.fromLocalFile(path)
        media = QMediaContent(url)
        self.player.setMedia(media)
        self.player.play()

    def load_subtitles_from_file(self, path):
        """Load subtitles from an SRT file and parse into memory."""
        try:
            with open(path, 'r', encoding='utf-8-sig') as f:
                text = f.read()
        except Exception:
            try:
                with open(path, 'r', encoding='utf-8') as f:
                    text = f.read()
            except Exception:
                self.subtitles = []
                return

        self.subtitles = self.parse_srt(text)
        self._current_sub_index = -1

    def parse_srt(self, srt_text):
        """Parse SRT text and return list of (start_ms, end_ms, html_text)."""
        import re

        def time_to_ms(t):
            # t format: HH:MM:SS,mmm or H:MM:SS.mmm
            t = t.replace('.', ',')
            parts = t.split(':')
            if len(parts) != 3:
                return 0
            hours = int(parts[0])
            minutes = int(parts[1])
            sec_ms = parts[2].split(',')
            seconds = int(sec_ms[0])
            ms = int(sec_ms[1].ljust(3, '0'))
            return ((hours * 60 + minutes) * 60 + seconds) * 1000 + ms

        entries = re.split(r"\n\s*\n", srt_text.strip())
        parsed = []
        for entry in entries:
            lines = entry.strip().splitlines()
            if len(lines) >= 2:
                # second line should be time
                time_line = lines[1]
                m = re.match(r"(.*)\s-->\s(.*)", time_line)
                if not m:
                    # maybe first line is time (index missing)
                    time_line = lines[0]
                    m = re.match(r"(.*)\s-->\s(.*)", time_line)
                    text_lines = lines[1:]
                else:
                    text_lines = lines[2:]

                if m:
                    start = time_to_ms(m.group(1).strip())
                    end = time_to_ms(m.group(2).strip())
                    text_html = '<br/>'.join([line.strip() for line in text_lines])
                    # wrap in paragraph for QTextBrowser
                    text_html = f"<p style='font-size:22px;color:white;margin:0'>{text_html}</p>"
                    parsed.append((start, end, text_html))

        return parsed

    def on_position_changed(self, position_ms):
        """Update subtitle display based on current playback position (ms)."""
        if not getattr(self, 'subtitles', None):
            return

        # Fast path: check current index first
        idx = self._current_sub_index
        if 0 <= idx < len(self.subtitles):
            s, e, txt = self.subtitles[idx]
            if s <= position_ms <= e:
                return
            # if still before next, try to advance or reset
            if position_ms > e:
                # advance linear
                idx += 1
                while idx < len(self.subtitles) and position_ms > self.subtitles[idx][1]:
                    idx += 1
                if idx < len(self.subtitles) and self.subtitles[idx][0] <= position_ms <= self.subtitles[idx][1]:
                    self._current_sub_index = idx
                    self._show_subtitle(self.subtitles[idx][2])
                    return

        # fallback: binary search / linear search
        lo = 0
        hi = len(self.subtitles) - 1
        found = -1
        while lo <= hi:
            mid = (lo + hi) // 2
            s, e, txt = self.subtitles[mid]
            if s <= position_ms <= e:
                found = mid
                break
            if position_ms < s:
                hi = mid - 1
            else:
                lo = mid + 1

        if found != -1:
            self._current_sub_index = found
            self._show_subtitle(self.subtitles[found][2])
        else:
            self._current_sub_index = -1
            self._show_subtitle('')

    def _show_subtitle(self, html_text):
        try:
            # Primary subtitle area
            self.eng_sub_view.setHtml(html_text)
        except Exception:
            pass
        try:
            # Clear translation for now (could load separate translation file)
            self.uzb_sub_view.setText('')
        except Exception:
            pass

    def show_epList_context_menu(self, pos):
        item = self.epList.itemAt(pos)
        if item:
            menu = QMenu(self)
            delete_action = menu.addAction("O'chirish")
            action = menu.exec_(self.epList.mapToGlobal(pos))
            if action == delete_action:
                self.delete_episode(item)

    def delete_episode(self, item):
        reply = QMessageBox.question(self, 'Tasdiqlash', "Haqiqatan ham bu epizodni o'chirmoqchimisiz?",
                                     QMessageBox.Yes | QMessageBox.No, QMessageBox.No)
        if reply == QMessageBox.Yes:
            data = item.data(Qt.UserRole)
            if not hasattr(self, 'store'):
                self.load_store()
            
            for a in self.store.get('animes', []):
                if a.get('id') == self.current_anime_id:
                    new_eps = []
                    for ep in a.get('episodes', []):
                        if isinstance(ep, dict) and isinstance(data, dict):
                            if ep.get('path') != data.get('path') or ep.get('title') != data.get('title'):
                                new_eps.append(ep)
                        elif ep != data:
                            new_eps.append(ep)
                    a['episodes'] = new_eps
                    break
                    
            self.save_store()
            self.go_to_player(self.current_anime_id)

    def add_anime_dialog(self):
        """Ask user for anime title and optional image, then save locally."""
        title, ok = QInputDialog.getText(self, 'Yangi Anime', 'Anime nomi:')
        if not ok or not title.strip():
            return

        img_path, _ = QFileDialog.getOpenFileName(self, 'Poster tanlash (ixtiyoriy)', os.path.expanduser('~'), 'Images (*.png *.jpg *.jpeg);;All Files (*)')

        anime = {
            'id': str(uuid.uuid4()),
            'title': title.strip(),
            'image': img_path or '',
            'episodes': []
        }
        if not hasattr(self, 'store'):
            self.load_store()
        self.store.setdefault('animes', []).append(anime)
        self.save_store()
        self.populate_home_grid()

    def add_episode_dialog(self):
        """Add an episode file to the currently opened anime."""
        if not getattr(self, 'current_anime_id', None):
            QMessageBox.warning(self, 'Xato', 'Iltimos, avvalo anime tanlang.')
            return
        # Ask for episode title
        ep_title, ok = QInputDialog.getText(self, "Yangi epizod", "Epizod nomi:")
        if not ok or not ep_title.strip():
            return

        fname, _ = QFileDialog.getOpenFileName(self, 'Epizodni tanlang', os.path.expanduser('~'), 'Video Files (*.mp4 *.mkv *.avi *.mov);;All Files (*)')
        if not fname:
            return

        # generate thumbnail and subtitle automatically (English)
        srt_path = None
        thumb_path = None
        try:
            thumb_path = self.extract_thumbnail(fname)
        except Exception:
            thumb_path = None

        try:
            srt_path = self.generate_srt_from_video(fname)
        except Exception:
            srt_path = None

        # find anime in store and append episode as dict
        if not hasattr(self, 'store'):
            self.load_store()
        for a in self.store.get('animes', []):
            if a.get('id') == self.current_anime_id:
                a.setdefault('episodes', []).append({
                    'title': ep_title.strip(),
                    'path': fname,
                    'srt': srt_path or '',
                    'thumb': thumb_path or ''
                })
                break
        self.save_store()
        # refresh episode list
        self.go_to_player(self.current_anime_id)

    def generate_srt_from_video(self, video_path):
        """Generate SRT file. Whisper is removed per user request.
        Returns path to generated .srt on success, or None.
        """
        base = os.path.splitext(video_path)[0]
        srt_out = base + '.srt'
        if os.path.exists(srt_out):
            return srt_out
            
        # Dastur endi video qo'shish jarayonida srt yaratmaydi.
        # Buning o'rniga videoni pleyerda ochganda GeminiSrtThread orqali avtomatik yaratiladi.
        return None

    def extract_thumbnail(self, video_path):
        """Extract a thumbnail image using ffmpeg and return its path, or None."""
        base = os.path.splitext(video_path)[0]
        thumb_out = base + '.jpg'
        # ffmpeg -y -ss 00:00:01 -i video -frames:v 1 -q:v 2 thumb.jpg
        cmd = ['ffmpeg', '-y', '-ss', '00:00:01', '-i', video_path, '-frames:v', '1', '-q:v', '2', thumb_out]
        try:
            res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False)
            if res.returncode == 0 and os.path.exists(thumb_out):
                return thumb_out
            else:
                # try without -ss (some containers)
                cmd2 = ['ffmpeg', '-y', '-i', video_path, '-frames:v', '1', '-q:v', '2', thumb_out]
                res2 = subprocess.run(cmd2, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False)
                if res2.returncode == 0 and os.path.exists(thumb_out):
                    return thumb_out
                # on failure print stderr for debugging
                print(res.stderr.decode('utf-8', errors='ignore'))
                print(res2.stderr.decode('utf-8', errors='ignore'))
                return None
        except FileNotFoundError:
            # ffmpeg not installed
            QMessageBox.information(self, "ffmpeg yo'q", "ffmpeg topilmadi. Thumbnail yaratish uchun ffmpeg o'rnating.")
            return None
        except Exception:
            print(traceback.format_exc())
            return None


if __name__ == '__main__':
    app = QApplication(sys.argv)
    window = LanswitchApp()
    window.show()
    sys.exit(app.exec_())