import sys
import os
import re
import json
import urllib.request
import traceback
from PyQt5.QtWidgets import QApplication, QMainWindow, QFileDialog, QMessageBox, QPushButton, QProgressDialog, QHBoxLayout, QVBoxLayout, QGridLayout, QSlider, QLabel, QStyle, QSpacerItem, QSizePolicy, QWidget, QInputDialog, QDialog
from PyQt5 import uic
from PyQt5.QtCore import Qt, QUrl, QThread, pyqtSignal, QTimer, QEvent
from PyQt5.QtMultimedia import QMediaPlayer, QMediaContent
from PyQt5.QtMultimediaWidgets import QVideoWidget
from ai_tutor import get_api_key, set_api_key, VocabularyThread, QuizDialog, GeminiSrtThread

class ClickableSlider(QSlider):
    def mousePressEvent(self, event):
        if event.button() == Qt.LeftButton:
            val = self.pixelPosToRangeValue(event.pos())
            self.setValue(val)
            self.sliderMoved.emit(val)
        super().mousePressEvent(event)

    def pixelPosToRangeValue(self, pos):
        opt = QStyleOptionSlider()
        self.initStyleOption(opt)
        gr = self.style().subControlRect(QStyle.CC_Slider, opt, QStyle.SC_SliderGroove, self)
        sr = self.style().subControlRect(QStyle.CC_Slider, opt, QStyle.SC_SliderHandle, self)

        if self.orientation() == Qt.Horizontal:
            sliderLength = sr.width()
            sliderMin = gr.x()
            sliderMax = gr.right() - sliderLength + 1
            pos = pos.x() - sliderLength / 2
        else:
            sliderLength = sr.height()
            sliderMin = gr.y()
            sliderMax = gr.bottom() - sliderLength + 1
            pos = pos.y() - sliderLength / 2

        return QStyle.sliderValueFromPosition(self.minimum(), self.maximum(), int(pos), sliderMax - sliderMin, opt.upsideDown)

from PyQt5.QtWidgets import QStyleOptionSlider

WHISPER_LANGUAGES = {
    "Auto-Detect (Avtomatik)": "auto",
    "English (Ingliz)": "en",
    "Uzbek (O'zbek)": "uz",
    "Russian (Rus)": "ru",
    "Spanish (Ispan)": "es",
    "French (Fransuz)": "fr",
    "German (Nemis)": "de",
    "Japanese (Yapon)": "ja",
    "Korean (Koreys)": "ko",
    "Chinese (Xitoy)": "zh",
    "Arabic (Arab)": "ar",
    "Turkish (Turk)": "tr",
    "Italian (Italyan)": "it",
    "Portuguese (Portugal)": "pt",
    "Hindi": "hi"
}

class SinglePlayerApp(QMainWindow):
    def __init__(self):
        super().__init__()
        
        # UI faylni yuklash
        ui_path = os.path.join(os.path.dirname(__file__), 'lanswitch.ui')
        uic.loadUi(ui_path, self)
        
        # Dastur ishga tushishi bilan faqat pleyer qismini (Index 2) ochamiz
        self.stackedWidget.setCurrentIndex(2)
        
        # Pleyerni sozlash
        self.setup_player()
        
        # Keraksiz yon panel elementlarini (epizodlar ro'yxati va hokazo) yashirish
        self.epTitle.hide()
        self.epList.hide()
        self.aiTitle.hide()
        self.wordList.hide()
        
        # O'ng panel kengligini kamaytirish yoki qisqartirish uchun
        self.playerSide.setMinimumWidth(10)
        self.playerSide.setMaximumWidth(10)

        # Signal ulanishlari
        if hasattr(self, 'btn_back'):
            self.btn_back.clicked.connect(self.select_video_and_sub)
        
        # Start without asking
        QTimer.singleShot(500, self.select_video_and_sub)

    def setup_player(self):
        # 1. Pleyer uchun asosiy konteyner
        self.player_container = QWidget()
        self.player_container.setStyleSheet("border: none; outline: none; background: black;")
        self.player_container_layout = QGridLayout(self.player_container)
        self.player_container_layout.setContentsMargins(0, 0, 0, 0)

        self.video_widget = QVideoWidget()
        self.player = QMediaPlayer(None, QMediaPlayer.VideoSurface)
        self.player.setVideoOutput(self.video_widget)
        
        self.player_container_layout.addWidget(self.video_widget, 0, 0)

        # 2. Overlay (Ustki shaffof qavat)
        self.overlay_widget = QWidget()
        self.overlay_widget.setStyleSheet("background: rgba(0,0,0,0); border: none; outline: none;")

        btn_style = """
            QPushButton {
                background-color: rgba(44, 44, 44, 0.7);
                color: white;
                border: none;
                outline: none;
                border-radius: 30px;
                font-weight: bold;
                font-size: 16px;
                min-width: 60px;
                min-height: 60px;
            }
            QPushButton:hover {
                background-color: rgba(255, 255, 255, 0.3);
            }
            QPushButton:focus {
                outline: none;
                border: none;
            }
        """

        self.play_button = QPushButton("⏸")
        self.play_button.setStyleSheet(btn_style + "font-size: 32px;")
        self.play_button.clicked.connect(self.toggle_play)

        self.backward_button = QPushButton("↺ 10")
        self.backward_button.setStyleSheet(btn_style)
        self.backward_button.clicked.connect(self.seek_backward)

        self.forward_button = QPushButton("10 ↻")
        self.forward_button.setStyleSheet(btn_style)
        self.forward_button.clicked.connect(self.seek_forward)

        self.position_slider = ClickableSlider(Qt.Horizontal)
        self.position_slider.setRange(0, 0)
        self.position_slider.setStyleSheet("""
            QSlider {
                height: 20px;
                background: rgba(0,0,0,0);
                border: none;
            }
            QSlider::groove:horizontal {
                height: 6px;
                background: rgba(255, 255, 255, 0.3);
                border: none;
                border-radius: 3px;
            }
            QSlider::handle:horizontal {
                background: #ff0000;
                width: 16px;
                height: 16px;
                margin: -5px 0;
                border: none;
                border-radius: 8px;
            }
            QSlider::sub-page:horizontal {
                background: #ff0000;
                border: none;
                border-radius: 3px;
            }
        """)
        self.position_slider.sliderMoved.connect(self.set_position)

        self.time_label = QLabel("00:00 / 00:00")
        self.time_label.setStyleSheet("color: white; font-weight: bold; font-family: 'Segoe UI', sans-serif; font-size: 14px; background: transparent; border: none;")

        self.btnUploadFile = QPushButton("+ Video Tanlash")
        self.btnUploadFile.setStyleSheet("""
            QPushButton {
                background-color: rgba(255, 0, 0, 0.7);
                color: white;
                border-radius: 5px;
                font-weight: bold;
                padding: 5px 15px;
                font-size: 13px;
                border: none;
                outline: none;
            }
            QPushButton:hover {
                background-color: rgba(255, 0, 0, 0.9);
            }
        """)
        self.btnUploadFile.setCursor(Qt.PointingHandCursor)
        self.btnUploadFile.clicked.connect(self.select_video_and_sub)

        # Overlay Layouti (Tugmalar o'rtada, Slayder pastda)
        overlay_layout = QVBoxLayout(self.overlay_widget)
        overlay_layout.setContentsMargins(0, 0, 0, 0)
        
        overlay_layout.addStretch(1) # Tepadagi bo'shliq
        
        # O'rtadagi tugmalar markazi
        center_buttons = QHBoxLayout()
        center_buttons.addStretch()
        center_buttons.addWidget(self.backward_button)
        center_buttons.addSpacing(30)
        center_buttons.addWidget(self.play_button)
        center_buttons.addSpacing(30)
        center_buttons.addWidget(self.forward_button)
        center_buttons.addStretch()
        
        overlay_layout.addLayout(center_buttons)
        
        overlay_layout.addStretch(1) # O'rtadagi bo'shliq
        
        # Pastki qism (Vaqt va Slayder)
        bottom_controls = QVBoxLayout()
        bottom_controls.setContentsMargins(20, 0, 20, 20)
        
        time_layout = QHBoxLayout()
        time_layout.addWidget(self.time_label)
        time_layout.addWidget(self.btnUploadFile)
        time_layout.addStretch()
        
        bottom_controls.addLayout(time_layout)
        bottom_controls.addWidget(self.position_slider)
        
        overlay_layout.addLayout(bottom_controls)

        self.player_container_layout.addWidget(self.overlay_widget, 0, 0)

        layout = self.videoCentering
        # vLabel yoki eski elementlarni tozalash
        for i in reversed(range(layout.count())):
            item = layout.itemAt(i)
            if item.widget() is not None:
                item.widget().deleteLater()
            elif item.layout() is not None:
                pass
                
        layout.addWidget(self.player_container)

        self.subtitles = []
        self._current_sub_index = -1

        self.player.positionChanged.connect(self.on_position_changed)
        self.player.durationChanged.connect(self.on_duration_changed)
        self.player.stateChanged.connect(self.on_state_changed)
        
        # Auto-hide mantiqi (Sichqoncha yo'qolsa UI yashirinadi)
        self.hide_timer = QTimer(self)
        self.hide_timer.setInterval(2500)
        self.hide_timer.setSingleShot(True)
        self.hide_timer.timeout.connect(self.hide_overlay)

        self.video_widget.setMouseTracking(True)
        self.overlay_widget.setMouseTracking(True)
        self.player_container.setMouseTracking(True)
        self.setMouseTracking(True)

        self.position_slider.installEventFilter(self)

        self.video_widget.installEventFilter(self)
        self.overlay_widget.installEventFilter(self)

    def eventFilter(self, source, event):
        if event.type() == QEvent.MouseMove:
            self.show_overlay()
        elif event.type() == QEvent.MouseButtonPress:
            if source == self.video_widget or source == self.overlay_widget:
                if isinstance(source, QSlider) or source == getattr(self, 'position_slider', None):
                    pass
                else:
                    self.toggle_play()
                    return True
        return super().eventFilter(source, event)

    def show_overlay(self):
        if hasattr(self, 'overlay_widget'):
            self.overlay_widget.show()
            if self.player.state() == QMediaPlayer.PlayingState:
                self.hide_timer.start()

    def hide_overlay(self):
        if self.player.state() == QMediaPlayer.PlayingState:
            self.overlay_widget.hide()

    def seek_backward(self):
        new_pos = max(0, self.player.position() - 10000)
        self.player.setPosition(new_pos)

    def seek_forward(self):
        new_pos = min(self.player.duration(), self.player.position() + 10000)
        self.player.setPosition(new_pos)

    def toggle_play(self):
        if self.player.state() == QMediaPlayer.PlayingState:
            self.player.pause()
            self.show_overlay()
            self.hide_timer.stop()
        else:
            self.player.play()
            self.hide_timer.start()

    def on_state_changed(self, state):
        if state == QMediaPlayer.PlayingState:
            self.play_button.setText("⏸")
        else:
            self.play_button.setText("▶")
            self.show_overlay()

    def on_duration_changed(self, duration):
        self.position_slider.setRange(0, duration)
        self.update_time_label(self.player.position(), duration)

    def set_position(self, position):
        self.player.setPosition(position)

    def update_time_label(self, position, duration):
        def format_time(ms):
            s = (ms // 1000) % 60
            m = (ms // 60000) % 60
            h = (ms // 3600000)
            if h > 0:
                return f"{h:02d}:{m:02d}:{s:02d}"
            return f"{m:02d}:{s:02d}"
            
        self.time_label.setText(f"{format_time(position)} / {format_time(duration)}")
        
    def prompt_for_subtitle(self):
        sub_msg = QMessageBox(self)
        sub_msg.setWindowTitle("Subtitr Manbasi")
        sub_msg.setText("Subtitrni qayerdan yuklaysiz?")
        sbtn_file = sub_msg.addButton("Lokal Fayldan", QMessageBox.ActionRole)
        sbtn_url = sub_msg.addButton("URL orqali", QMessageBox.ActionRole)
        sub_msg.exec_()
        
        if sub_msg.clickedButton() == sbtn_url:
            srt_path, ok_srt = QInputDialog.getText(self, "Subtitr URL", "Subtitr (.srt) URL manzilini kiriting:")
            if ok_srt and srt_path.strip():
                return srt_path.strip()
        else:
            srt_path, _ = QFileDialog.getOpenFileName(self, "Subtitrni tanlang", os.path.expanduser("~"), "Subtitle Files (*.srt);;All Files (*)")
            if srt_path:
                return srt_path
        return None

    def select_video_and_sub(self):
        self.player.stop()
        
        msg_box = QMessageBox(self)
        msg_box.setWindowTitle("Video Manbasi")
        msg_box.setText("Videoni qayerdan ochishni xohlaysiz?")
        btn_file = msg_box.addButton("Lokal Fayldan", QMessageBox.ActionRole)
        btn_url = msg_box.addButton("URL (Internet) orqali", QMessageBox.ActionRole)
        msg_box.exec_()
        
        if msg_box.clickedButton() == btn_url:
            url, ok = QInputDialog.getText(self, "URL orqali ochish", "Video URL manzilini kiriting:\n(Masalan: http://example.com/video.mp4)")
            if ok and url.strip():
                # Subtitr so'rash
                reply_sub = QMessageBox.question(self, "Subtitr", "Subtitr fayli (.srt) qo'shishni xohlaysizmi?", QMessageBox.Yes | QMessageBox.No)
                srt_path = None
                if reply_sub == QMessageBox.Yes:
                    srt_path = self.prompt_for_subtitle()
                
                self.play_video_with_sub(url.strip(), srt_path)
            return

        # 1. Videoni tanlash
        video_path, _ = QFileDialog.getOpenFileName(
            self, "Videoni tanlang", os.path.expanduser("~"), 
            "Video Files (*.mp4 *.mkv *.avi *.mov);;All Files (*)"
        )
        if not video_path:
            return
            
        # 2. Subtitrni avtomatik qidirish yoki foydalanuvchidan so'rash
        srt_path = os.path.splitext(video_path)[0] + '.srt'
        if not os.path.exists(srt_path):
            reply = QMessageBox.question(
                self, "Subtitr topilmadi", 
                "Video bilan bir xil nomdagi .srt fayli topilmadi. Avtomatik ravishda Gemini AI orqali yarataylikmi? (Bu videoni bulutga yuklab SRT qaytaradi)", 
                QMessageBox.Yes | QMessageBox.No
            )
            if reply == QMessageBox.Yes:
                self.generate_subtitles(video_path)
                return  # Generatsiya tugagach o'zi videoni boshlaydi
            else:
                reply2 = QMessageBox.question(
                    self, "Subtitrni tanlash", 
                    "O'zingiz qo'lda subtitr qo'shasizmi?", 
                    QMessageBox.Yes | QMessageBox.No
                )
                if reply2 == QMessageBox.Yes:
                    srt_path = self.prompt_for_subtitle()
                else:
                    srt_path = None
                    
        self.play_video_with_sub(video_path, srt_path)

    def generate_subtitles(self, video_path):
        api_key = get_api_key()
        if not api_key:
            key, ok = QInputDialog.getText(self, "Gemini API Kaliti", "Iltimos, Gemini API kalitingizni kiriting (subtitr yaratish uchun):")
            if ok and key.strip():
                set_api_key(key.strip())
            else:
                QMessageBox.warning(self, "Xatolik", "API kalit kiritilmadi. Gemini AI ishlamaydi.")
                self.play_video_with_sub(video_path, None)
                return

        self.progress_dialog = QProgressDialog("Subtitr yaratilmoqda (Gemini orqali videongiz tahlil qilinmoqda)... Iltimos kuting, bu bir necha daqiqa olishi mumkin.", None, 0, 0, self)
        self.progress_dialog.setWindowTitle("Gemini AI SRT")
        self.progress_dialog.setWindowModality(Qt.WindowModal)
        self.progress_dialog.setCancelButton(None)
        self.progress_dialog.show()

        self.srt_thread = GeminiSrtThread(video_path)
        self.srt_thread.finished.connect(lambda srt_text: self.on_subtitles_generated(srt_text, video_path))
        self.srt_thread.error.connect(lambda err: self.on_subtitles_error(err, video_path))
        self.srt_thread.start()

    def on_subtitles_generated(self, srt_text, video_path):
        if hasattr(self, 'progress_dialog'):
            self.progress_dialog.close()
        
        srt_path = os.path.splitext(video_path)[0] + '.srt'
        try:
            with open(srt_path, 'w', encoding='utf-8') as f:
                f.write(srt_text)
            QMessageBox.information(self, "Tayyor", "Subtitr Gemini orqali muvaffaqiyatli yaratildi!")
        except Exception as e:
            QMessageBox.warning(self, "Saqlash Xatosi", f"Subtitrni saqlashda xatolik:\n{e}")
            srt_path = None
            
        self.play_video_with_sub(video_path, srt_path)

    def on_subtitles_error(self, err_msg, video_path):
        if hasattr(self, 'progress_dialog'):
            self.progress_dialog.close()
        QMessageBox.warning(self, "Xatolik", err_msg)
        self.play_video_with_sub(video_path, None)

    def play_video_with_sub(self, video_path, srt_path):
        self.start_vocabulary_extraction(video_path, srt_path)

    def start_vocabulary_extraction(self, video_path, srt_path):
        if not srt_path:
            # Agar umuman subtitr bo'lmasa to'g'ridan to'g'ri o'ynatish
            self._do_play(video_path, srt_path)
            return

        api_key = get_api_key()
        if not api_key:
            key, ok = QInputDialog.getText(self, "Gemini API Kaliti", "Iltimos, Gemini API kalitingizni kiriting (bir marta so'raladi):")
            if ok and key.strip():
                set_api_key(key.strip())
            else:
                QMessageBox.warning(self, "Xatolik", "API kalit kiritilmadi. AI Tutor ishlamaydi.")
                self._do_play(video_path, srt_path)
                return

        json_path = ""
        if isinstance(video_path, str) and not video_path.startswith("http"):
            json_path = os.path.splitext(video_path)[0] + '_vocabulary.json'
            if os.path.exists(json_path):
                with open(json_path, 'r', encoding='utf-8') as f:
                    vocab_data = json.load(f)
                self.show_quiz(vocab_data, video_path, srt_path)
                return
        
        # Srt matnini o'qish
        try:
            if srt_path.startswith("http"):
                req = urllib.request.Request(srt_path, headers={'User-Agent': 'Mozilla/5.0'})
                resp = urllib.request.urlopen(req)
                srt_text = resp.read().decode('utf-8')
            else:
                with open(srt_path, 'r', encoding='utf-8') as f:
                    srt_text = f.read()
        except Exception as e:
            print("Srt o'qishda xato:", e)
            self._do_play(video_path, srt_path)
            return

        langs = ["O'zbek", "Rus", "Ingliz"]
        target_lang, ok = QInputDialog.getItem(self, "Tarjima Tili", "So'zlar qaysi tilga tarjima qilinsin?", langs, 0, False)
        if not ok:
            return

        self.progress_dialog = QProgressDialog("Subtitr tahlil qilinmoqda (Gemini AI)... Iltimos kuting.", None, 0, 0, self)
        self.progress_dialog.setWindowTitle("Anime AI Tutor")
        self.progress_dialog.setWindowModality(Qt.WindowModal)
        self.progress_dialog.setCancelButton(None)
        self.progress_dialog.show()

        self.vocab_thread = VocabularyThread(srt_text, target_lang)
        self.vocab_thread.finished.connect(lambda data: self.on_vocabulary_generated(data, json_path, video_path, srt_path))
        self.vocab_thread.error.connect(lambda err: self.on_vocabulary_error(err, video_path, srt_path))
        self.vocab_thread.start()

    def on_vocabulary_generated(self, vocab_data, json_path, video_path, srt_path):
        if hasattr(self, 'progress_dialog'):
            self.progress_dialog.close()
            
        if json_path:
            with open(json_path, 'w', encoding='utf-8') as f:
                json.dump(vocab_data, f, ensure_ascii=False, indent=4)
                
        self.show_quiz(vocab_data, video_path, srt_path)

    def on_vocabulary_error(self, err_msg, video_path, srt_path):
        if hasattr(self, 'progress_dialog'):
            self.progress_dialog.close()
        QMessageBox.warning(self, "Gemini Xatoligi", f"So'zlarni tahlil qilishda xatolik:\n{err_msg}")
        self._do_play(video_path, srt_path)

    def show_quiz(self, vocab_data, video_path, srt_path):
        dialog = QuizDialog(vocab_data, self)
        if dialog.exec_() == QDialog.Accepted:
            self._do_play(video_path, srt_path)

    def _do_play(self, video_path, srt_path):
        if srt_path:
            self.load_subtitles_from_path(srt_path)
        else:
            self.subtitles = []
            self._current_sub_index = -1
            self.eng_sub_view.setHtml('')
            self.uzb_sub_view.setText('')
            
        # 3. Videoni pleyerga yuklash va o'qitish
        if video_path.startswith("http://") or video_path.startswith("https://"):
            url = QUrl(video_path)
        else:
            url = QUrl.fromLocalFile(video_path)
            
        media = QMediaContent(url)
        self.player.setMedia(media)
        self.player.play()

    def load_subtitles_from_path(self, path):
        try:
            if path.startswith("http://") or path.startswith("https://"):
                req = urllib.request.Request(path, headers={'User-Agent': 'Mozilla/5.0'})
                response = urllib.request.urlopen(req)
                text = response.read().decode('utf-8')
            else:
                try:
                    with open(path, 'r', encoding='utf-8-sig') as f:
                        text = f.read()
                except Exception:
                    with open(path, 'r', encoding='utf-8') as f:
                        text = f.read()
                        
            self.subtitles = self.parse_srt(text)
            self._current_sub_index = -1
        except Exception as e:
            print(f"Subtitr yuklashda xato: {e}")
            self.subtitles = []
            self._current_sub_index = -1

    def parse_srt(self, srt_text):
        def time_to_ms(t):
            t = t.replace('.', ',')
            parts = t.split(':')
            if len(parts) != 3: return 0
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
                time_line = lines[1]
                m = re.match(r"(.*)\s-->\s(.*)", time_line)
                if not m:
                    time_line = lines[0]
                    m = re.match(r"(.*)\s-->\s(.*)", time_line)
                    text_lines = lines[1:]
                else:
                    text_lines = lines[2:]

                if m:
                    start = time_to_ms(m.group(1).strip())
                    end = time_to_ms(m.group(2).strip())
                    text_html = '<br/>'.join([line.strip() for line in text_lines])
                    text_html = f"<p style='font-size:22px;color:white;margin:0'>{text_html}</p>"
                    parsed.append((start, end, text_html))
        return parsed

    def on_position_changed(self, position_ms):
        # Slider va vaqtni yangilash
        if not self.position_slider.isSliderDown():
            self.position_slider.setValue(position_ms)
        self.update_time_label(position_ms, self.player.duration())

        if not self.subtitles:
            return
            
        idx = self._current_sub_index
        if 0 <= idx < len(self.subtitles):
            s, e, txt = self.subtitles[idx]
            if s <= position_ms <= e:
                return
            if position_ms > e:
                idx += 1
                while idx < len(self.subtitles) and position_ms > self.subtitles[idx][1]:
                    idx += 1
                if idx < len(self.subtitles) and self.subtitles[idx][0] <= position_ms <= self.subtitles[idx][1]:
                    self._current_sub_index = idx
                    self._show_subtitle(self.subtitles[idx][2])
                    return

        # Binary search
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
            self.eng_sub_view.setHtml(html_text)
        except Exception:
            pass

if __name__ == '__main__':
    app = QApplication(sys.argv)
    window = SinglePlayerApp()
    window.show()
    sys.exit(app.exec_())
