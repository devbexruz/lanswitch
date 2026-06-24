import re

ui_path = "s:/MyProjects/lanswitch/desktop/lanswitch.ui"

with open(ui_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Remove overlay_widget completely
overlay_pattern = r'<item row="0" column="0">\s*<widget class="QWidget" name="overlay_widget">.*?</widget>\s*</item>'
content = re.sub(overlay_pattern, '', content, flags=re.DOTALL)

# 2. Change videoCentering back to QVBoxLayout
content = content.replace('<layout class="QGridLayout" name="videoCentering">', '<layout class="QVBoxLayout" name="videoCentering">')

# 3. Restore vLabel
content = re.sub(r'<item row="0" column="0">\s*(<widget class="QLabel" name="vLabel">)', r'<item>\n              \1', content)

# 4. We don't necessarily need to restore btn_back if we are putting a btnUploadFile in the python overlay! 
# But just to be safe, let's restore btn_back where it was, or we can just leave it removed and create the upload button in python.
# Leaving btn_back removed is fine since we hid the left panel anyway in single_player.py!

with open(ui_path, 'w', encoding='utf-8') as f:
    f.write(content)
print("UI Restored!")
