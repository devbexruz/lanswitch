import os
import json
import google.generativeai as genai
from PyQt5.QtCore import QThread, pyqtSignal, Qt
from PyQt5.QtWidgets import (QDialog, QVBoxLayout, QHBoxLayout, QLabel, 
                             QPushButton, QRadioButton, QButtonGroup, QMessageBox, QScrollArea, QWidget)

def get_api_key():
    key_path = os.path.join(os.path.dirname(__file__), 'gemini_key.txt')
    if os.path.exists(key_path):
        with open(key_path, 'r') as f:
            return f.read().strip()
    return None

def set_api_key(key):
    key_path = os.path.join(os.path.dirname(__file__), 'gemini_key.txt')
    with open(key_path, 'w') as f:
        f.write(key.strip())
    genai.configure(api_key=key.strip())

class GeminiSrtThread(QThread):
    finished = pyqtSignal(str)
    error = pyqtSignal(str)

    def __init__(self, video_path):
        super().__init__()
        self.video_path = video_path

    def run(self):
        api_key = get_api_key()
        if not api_key:
            self.error.emit("Gemini API kaliti topilmadi!")
            return
        
        try:
            genai.configure(api_key=api_key)
            # 1. Videoni yuklash
            video_file = genai.upload_file(path=self.video_path)
            
            # 2. Gemini ni kutish (processing state)
            import time
            while video_file.state.name == 'PROCESSING':
                time.sleep(2)
                video_file = genai.get_file(video_file.name)
            if video_file.state.name == 'FAILED':
                raise ValueError("Video yuklash muvaffaqiyatsiz bo'ldi.")

            # 3. Model orqali subtitr generatsiya qilish
            model = genai.GenerativeModel('gemini-2.5-flash')
            prompt = "Listen to this video/audio carefully and generate a perfectly synced and complete SRT subtitle file for it in its original language. Reply ONLY with the raw SRT format text. Do not use markdown blocks like ```srt or ```. Output must start directly with '1'."
            
            response = model.generate_content([prompt, video_file])
            srt_text = response.text.strip()
            
            if srt_text.startswith('```srt'):
                srt_text = srt_text[6:]
            if srt_text.startswith('```'):
                srt_text = srt_text[3:]
            if srt_text.endswith('```'):
                srt_text = srt_text[:-3]
                
            srt_text = srt_text.strip()
            self.finished.emit(srt_text)
            
            # Yuklangan faylni o'chirib tashlash (joy tejash)
            genai.delete_file(video_file.name)
            
        except Exception as e:
            self.error.emit(str(e))

class VocabularyThread(QThread):
    finished = pyqtSignal(dict)
    error = pyqtSignal(str)

    def __init__(self, srt_text, target_language):
        super().__init__()
        self.srt_text = srt_text
        self.target_language = target_language

    def run(self):
        api_key = get_api_key()
        if not api_key:
            self.error.emit("Gemini API kaliti topilmadi!")
            return
        
        try:
            genai.configure(api_key=api_key)
            model = genai.GenerativeModel('gemini-2.5-flash')
            
            prompt = f"""Role: Sen "Lanswitch Anime AI Tutor"san. Sening maqsading foydalanuvchiga anime subtitrlari orqali xorijiy tilni mukammal o'rganishga yordam berish.

Task: Senga berilgan subtitr segmentlarini tahlil qil va quyidagi tuzilmada QAT'IY JSON formatida javob ber. Hech qanday markdown (```json) ishlatma, faqat sof JSON obyekt qaytar.

Target Language for translations and explanations: {self.target_language}

Expected JSON Schema:
{{
  "KeyVocabulary": [
    {{
      "word": "murakkab yoki muhim so'z",
      "translation": "tarjimasi ({self.target_language} tilida)",
      "context": "kontekstdagi ma'nosi va izohi",
      "wrong_options": ["xato tarjima 1", "xato tarjima 2", "xato tarjima 3"]
    }}
  ],
  "GrammarInsights": [
    "Matndagi murakkab grammatik qoida tushuntirishi 1",
    "Matndagi murakkab grammatik qoida tushuntirishi 2"
  ],
  "CulturalNuance": "Agar anime kontekstida madaniy yoki emotsional jihatlar bo'lsa qisqacha izoh",
  "PracticeSentences": [
    "Namunaviy gap 1",
    "Namunaviy gap 2"
  ]
}}

Rules:
- Har doim faqat JSON formatida javob ber! Hech qanday izoh qo'shma.
- Eng muhim va murakkab 5-10 ta so'zni ajratib ol. Juda oddiy so'zlarni tahlilga qo'shma.
- Har bir so'z uchun test o'tkazish maqsadida 3 ta xato tarjima variantini ("wrong_options" massivida) o'ylab top. Bu xato variantlar mantiqan yaqin bo'lishi kerak.
- Til o'rgatishda aniq va tushunarli uslubni qo'lla.

Subtitle Content:
{self.srt_text}
"""
            response = model.generate_content(prompt)
            
            # Matndan faqat JSON qismini ajratib olish (xavfsizlik uchun)
            response_text = response.text.strip()
            if response_text.startswith('```json'):
                response_text = response_text[7:]
            if response_text.startswith('```'):
                response_text = response_text[3:]
            if response_text.endswith('```'):
                response_text = response_text[:-3]
                
            data = json.loads(response_text.strip())
            self.finished.emit(data)
            
        except Exception as e:
            self.error.emit(str(e))

class QuizDialog(QDialog):
    def __init__(self, vocab_data, parent=None):
        super().__init__(parent)
        self.vocab_data = vocab_data
        self.setWindowTitle("🎬 Anime AI Tutor - Test (Videoni ochish uchun testdan o'ting!)")
        self.setMinimumSize(600, 500)
        self.setWindowFlags(self.windowFlags() & ~Qt.WindowCloseButtonHint) # Yopish tugmasini o'chirish
        
        self.score = 0
        self.total_questions = len(self.vocab_data.get("KeyVocabulary", []))
        self.current_q_idx = 0
        self.passed = False
        
        self.init_ui()
        
    def init_ui(self):
        self.layout = QVBoxLayout(self)
        
        self.lbl_title = QLabel("Videoni tomosha qilish uchun quyidagi so'zlar testidan o'tishingiz kerak!")
        self.lbl_title.setStyleSheet("font-size: 16px; font-weight: bold; color: #ff5555;")
        self.lbl_title.setAlignment(Qt.AlignCenter)
        self.layout.addWidget(self.lbl_title)
        
        # Insights & Nuance (Faqat 1-savoldan oldin ko'rsatish)
        self.insights_lbl = QLabel()
        self.insights_lbl.setWordWrap(True)
        self.insights_lbl.setStyleSheet("font-size: 14px; background-color: #333; color: white; padding: 10px; border-radius: 5px;")
        
        insights_text = "<b>Grammatika va Madaniy Izohlar:</b><br/>"
        for g in self.vocab_data.get("GrammarInsights", []):
            insights_text += f"• {g}<br/>"
        if self.vocab_data.get("CulturalNuance"):
            insights_text += f"<br/><b>Madaniy Izoh:</b> {self.vocab_data.get('CulturalNuance')}"
            
        self.insights_lbl.setText(insights_text)
        self.layout.addWidget(self.insights_lbl)
        
        # Question Area
        self.q_lbl = QLabel("")
        self.q_lbl.setWordWrap(True)
        self.q_lbl.setStyleSheet("font-size: 18px; font-weight: bold; margin-top: 20px;")
        self.layout.addWidget(self.q_lbl)
        
        self.radio_group = QButtonGroup(self)
        self.radio_layout = QVBoxLayout()
        self.radios = []
        for i in range(4):
            r = QRadioButton("")
            r.setStyleSheet("font-size: 16px; padding: 5px;")
            self.radio_layout.addWidget(r)
            self.radio_group.addButton(r, i)
            self.radios.append(r)
            
        self.layout.addLayout(self.radio_layout)
        
        self.btn_next = QPushButton("Keyingisi")
        self.btn_next.setStyleSheet("background-color: #0078D7; color: white; font-weight: bold; padding: 10px; font-size: 16px;")
        self.btn_next.clicked.connect(self.check_answer)
        self.layout.addWidget(self.btn_next)
        
        if self.total_questions > 0:
            self.load_question()
        else:
            self.q_lbl.setText("Test savollari topilmadi. Videoni ko'rishingiz mumkin.")
            self.btn_next.setText("Videoni Boshlash")
            self.passed = True
            
    def load_question(self):
        import random
        q_data = self.vocab_data["KeyVocabulary"][self.current_q_idx]
        self.q_lbl.setText(f"Savol {self.current_q_idx + 1}/{self.total_questions}:\n\"{q_data['word']}\" so'zining ma'nosi nima?")
        self.insights_lbl.setVisible(self.current_q_idx == 0) # Faqat 1-savolda izohlar chiqadi
        
        correct = q_data['translation']
        wrongs = q_data.get('wrong_options', [])
        
        # Xato variantlar yetarli bo'lmasa to'ldirish
        while len(wrongs) < 3:
            wrongs.append(f"Notog'ri variant {len(wrongs)+1}")
            
        options = [correct] + wrongs[:3]
        random.shuffle(options)
        
        self.correct_ans = correct
        
        self.radio_group.setExclusive(False)
        for i, r in enumerate(self.radios):
            r.setText(options[i])
            r.setChecked(False)
        self.radio_group.setExclusive(True)
        
        if self.current_q_idx == self.total_questions - 1:
            self.btn_next.setText("Natijani Ko'rish")
            
    def check_answer(self):
        if self.passed:
            self.accept()
            return
            
        checked_id = self.radio_group.checkedId()
        if checked_id == -1:
            QMessageBox.warning(self, "Ogohlantirish", "Iltimos bitta variantni tanlang!")
            return
            
        selected_text = self.radios[checked_id].text()
        if selected_text == self.correct_ans:
            self.score += 1
            
        self.current_q_idx += 1
        
        if self.current_q_idx < self.total_questions:
            self.load_question()
        else:
            self.finish_quiz()
            
    def finish_quiz(self):
        percentage = (self.score / self.total_questions) * 100
        
        self.q_lbl.setText(f"Sizning natijangiz: {self.score} / {self.total_questions} ({percentage:.0f}%)")
        self.insights_lbl.setVisible(False)
        for r in self.radios:
            r.setVisible(False)
            
        if percentage >= 80:
            self.passed = True
            self.q_lbl.setText(self.q_lbl.text() + "\n\n🎉 Tabriklaymiz! Siz testdan muvaffaqiyatli o'tdingiz.")
            self.btn_next.setText("Videoni Boshlash ▶️")
            self.btn_next.setStyleSheet("background-color: #28a745; color: white; font-weight: bold; padding: 10px; font-size: 16px;")
        else:
            self.passed = False
            self.q_lbl.setText(self.q_lbl.text() + "\n\n❌ Afsuski, yetarli ball to'play olmadingiz (80% kerak). Qaytadan urinib ko'ring!")
            self.btn_next.setText("Qaytadan Topshirish ↻")
            self.btn_next.setStyleSheet("background-color: #dc3545; color: white; font-weight: bold; padding: 10px; font-size: 16px;")
            self.btn_next.clicked.disconnect()
            self.btn_next.clicked.connect(self.restart_quiz)
            
    def restart_quiz(self):
        self.score = 0
        self.current_q_idx = 0
        for r in self.radios:
            r.setVisible(True)
            
        self.btn_next.clicked.disconnect()
        self.btn_next.clicked.connect(self.check_answer)
        self.btn_next.setStyleSheet("background-color: #0078D7; color: white; font-weight: bold; padding: 10px; font-size: 16px;")
        self.btn_next.setText("Keyingisi")
        self.load_question()
