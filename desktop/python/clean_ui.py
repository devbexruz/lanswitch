import re

ui_path = "s:/MyProjects/lanswitch/desktop/lanswitch.ui"

with open(ui_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Clean up videoCentering block
start_str = '<layout class="QVBoxLayout" name="videoCentering">'
if start_str not in content:
    start_str = '<layout class="QGridLayout" name="videoCentering">'

idx_start = content.find(start_str)

# Find the end of the videoContainer widget. The structure is:
#           <widget class="QFrame" name="videoContainer">
#             ... layout ...
#            </widget>
#           </item>
#           <item>
#            <widget class="QFrame" name="subtitleFrame">
idx_end = content.find('<widget class="QFrame" name="subtitleFrame">')
if idx_end != -1:
    # Go backwards to find the </layout> before subtitleFrame
    idx_end_layout = content.rfind('</layout>', idx_start, idx_end)
    
    if idx_start != -1 and idx_end_layout != -1:
        # Reconstruct exactly the original videoCentering layout
        clean_video_centering = """<layout class="QVBoxLayout" name="videoCentering">
              <item>
               <widget class="QLabel" name="vLabel">
                <property name="styleSheet">
                 <string>font-size: 24px; color: #333; font-weight: bold;</string>
                </property>
                <property name="text">
                 <string>PLAYER</string>
                </property>
                <property name="alignment">
                 <set>Qt::AlignCenter</set>
                </property>
               </widget>
              </item>
             </layout>"""
        
        # Replace the entire broken block with the clean one
        content = content[:idx_start] + clean_video_centering + content[idx_end_layout + len('</layout>'):]

# 2. Let's make sure there is no trailing corrupted item before subtitleFrame
# The structure should be:
#             </layout>
#            </widget>
#           </item>
#           <item>
#            <widget class="QFrame" name="subtitleFrame">

content = re.sub(r'</layout>\s*</widget>\s*</item>\s*<item>\s*<widget class="QFrame" name="subtitleFrame">', 
                 '</layout>\n           </widget>\n          </item>\n          <item>\n           <widget class="QFrame" name="subtitleFrame">', 
                 content)

with open(ui_path, 'w', encoding='utf-8') as f:
    f.write(content)
print("UI Cleaned!")
