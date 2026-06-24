import re

ui_path = "s:/MyProjects/lanswitch/desktop/lanswitch.ui"

with open(ui_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace QVBoxLayout to QGridLayout for videoCentering
content = content.replace('<layout class="QVBoxLayout" name="videoCentering">', '<layout class="QGridLayout" name="videoCentering">')

# Modify vLabel item to be row=0, column=0
content = re.sub(r'<item>\s*<widget class="QLabel" name="vLabel">', r'<item row="0" column="0">\n              <widget class="QLabel" name="vLabel">', content)

# Remove btn_back
content = re.sub(r'<item>\s*<widget class="QPushButton" name="btn_back">.*?</widget>\s*</item>', '', content, flags=re.DOTALL)

# Remove old btnUploadFile if exists
content = re.sub(r'<item>\s*<widget class="QPushButton" name="btnUploadFile">.*?</widget>\s*</item>', '', content, flags=re.DOTALL)

# Find where videoCentering ends
# It's right before <widget class="QFrame" name="subtitleFrame">
# The structure is:
#             </layout>
#            </widget>
#           </item>
#           <item>
#            <widget class="QFrame" name="subtitleFrame">

overlay_xml = """
             <item row="0" column="0">
              <widget class="QWidget" name="overlay_widget">
               <property name="styleSheet">
                <string>background: transparent; border: none; outline: none;</string>
               </property>
               <layout class="QVBoxLayout" name="overlay_layout">
                <property name="leftMargin"><number>0</number></property>
                <property name="topMargin"><number>0</number></property>
                <property name="rightMargin"><number>0</number></property>
                <property name="bottomMargin"><number>0</number></property>
                <item>
                 <spacer name="verticalSpacer_top">
                  <property name="orientation"><enum>Qt::Vertical</enum></property>
                 </spacer>
                </item>
                <item>
                 <layout class="QHBoxLayout" name="center_buttons">
                  <item><spacer name="horizontalSpacer_left"><property name="orientation"><enum>Qt::Horizontal</enum></property></spacer></item>
                  <item>
                   <widget class="QPushButton" name="backward_button">
                    <property name="minimumSize"><size><width>60</width><height>60</height></size></property>
                    <property name="text"><string>↺ 10</string></property>
                    <property name="styleSheet"><string>QPushButton { background-color: rgba(44, 44, 44, 0.7); color: white; border-radius: 30px; font-weight: bold; font-size: 16px; outline: none; border: none; } QPushButton:hover { background-color: rgba(255, 255, 255, 0.3); } QPushButton:focus { outline: none; border: none; }</string></property>
                    <property name="cursor"><cursorShape>PointingHandCursor</cursorShape></property>
                   </widget>
                  </item>
                  <item>
                   <widget class="QPushButton" name="play_button">
                    <property name="minimumSize"><size><width>60</width><height>60</height></size></property>
                    <property name="text"><string>⏸</string></property>
                    <property name="styleSheet"><string>QPushButton { background-color: rgba(44, 44, 44, 0.7); color: white; border-radius: 30px; font-weight: bold; font-size: 32px; outline: none; border: none; } QPushButton:hover { background-color: rgba(255, 255, 255, 0.3); } QPushButton:focus { outline: none; border: none; }</string></property>
                    <property name="cursor"><cursorShape>PointingHandCursor</cursorShape></property>
                   </widget>
                  </item>
                  <item>
                   <widget class="QPushButton" name="forward_button">
                    <property name="minimumSize"><size><width>60</width><height>60</height></size></property>
                    <property name="text"><string>10 ↻</string></property>
                    <property name="styleSheet"><string>QPushButton { background-color: rgba(44, 44, 44, 0.7); color: white; border-radius: 30px; font-weight: bold; font-size: 16px; outline: none; border: none; } QPushButton:hover { background-color: rgba(255, 255, 255, 0.3); } QPushButton:focus { outline: none; border: none; }</string></property>
                    <property name="cursor"><cursorShape>PointingHandCursor</cursorShape></property>
                   </widget>
                  </item>
                  <item><spacer name="horizontalSpacer_right"><property name="orientation"><enum>Qt::Horizontal</enum></property></spacer></item>
                 </layout>
                </item>
                <item>
                 <spacer name="verticalSpacer_bottom">
                  <property name="orientation"><enum>Qt::Vertical</enum></property>
                 </spacer>
                </item>
                <item>
                 <layout class="QVBoxLayout" name="bottom_controls">
                  <property name="leftMargin"><number>20</number></property>
                  <property name="rightMargin"><number>20</number></property>
                  <property name="bottomMargin"><number>20</number></property>
                  <item>
                   <layout class="QHBoxLayout" name="time_layout">
                    <item>
                     <widget class="QLabel" name="time_label">
                      <property name="text"><string>00:00 / 00:00</string></property>
                      <property name="styleSheet"><string>color: white; font-weight: bold; font-family: 'Segoe UI', sans-serif; font-size: 14px; background: transparent; border: none;</string></property>
                     </widget>
                    </item>
                    <item>
                     <widget class="QPushButton" name="btnUploadFile">
                      <property name="text"><string>+ Video Tanlash</string></property>
                      <property name="styleSheet"><string>QPushButton { background-color: rgba(255,0,0,0.7); color: white; border-radius: 5px; font-weight: bold; padding: 5px 10px; } QPushButton:hover { background-color: rgba(255,0,0,0.9); }</string></property>
                      <property name="cursor"><cursorShape>PointingHandCursor</cursorShape></property>
                     </widget>
                    </item>
                    <item><spacer name="horizontalSpacer_time"><property name="orientation"><enum>Qt::Horizontal</enum></property></spacer></item>
                   </layout>
                  </item>
                  <item>
                   <widget class="QSlider" name="position_slider">
                    <property name="orientation"><enum>Qt::Horizontal</enum></property>
                    <property name="styleSheet"><string>QSlider { height: 20px; background: transparent; border: none; } QSlider::groove:horizontal { height: 6px; background: rgba(255, 255, 255, 0.3); border: none; border-radius: 3px; } QSlider::handle:horizontal { background: #ff0000; width: 16px; height: 16px; margin: -5px 0; border: none; border-radius: 8px; } QSlider::sub-page:horizontal { background: #ff0000; border: none; border-radius: 3px; }</string></property>
                    <property name="cursor"><cursorShape>PointingHandCursor</cursorShape></property>
                   </widget>
                  </item>
                 </layout>
                </item>
               </layout>
              </widget>
             </item>
"""

# Find the end of videoCentering layout. 
# We can find `<widget class="QLabel" name="vLabel">`, then the first `</item>` after that.
idx_vlabel = content.find('"vLabel"')
idx_item_end = content.find('</item>', idx_vlabel) + len('</item>')

# Insert overlay_xml right after vlabel's item
content = content[:idx_item_end] + "\n" + overlay_xml + content[idx_item_end:]

with open(ui_path, 'w', encoding='utf-8') as f:
    f.write(content)
print("UI Modified Properly!")
