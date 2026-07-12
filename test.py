import json
import requests

# 1. Bu yerga o'zingizning haqiqiy Gemini API kalitingizni qo'ying
API_KEY = "AIzaSyAmCo4CHNbIrodHg1X_gb2izHCuwKpoCPs"

# 2. Modellarni ro'yxatga oluvchi endpoint URL
url = f"https://generativelanguage.googleapis.com/v1/models?key={API_KEY}"

try:
    # GET so'rov yuborish
    response = requests.get(url)

    # Agar so'rov muvaffaqiyatli bo'lsa (Status Code: 200)
    if response.status_code == 200:
        data = response.json()

        print("--- Mavjud Modellar Ro'yxati ---\n")
        # Modellarni chiroyli formatda konsolga chiqarish
        for model in data.get("models", []):
            print(f"Model Nomi: {model.get('name')}")
            print(f"Sarlavha: {model.get('title')}")
            print(f"Imkoniyatlari (Methods): {model.get('supportedGenerationMethods')}")
            print("-" * 40)

    else:
        # Xatolik yuz bergandagi javob
        print(f"Xatolik yuz berdi! Status kod: {response.status_code}")
        print(json.dumps(response.json(), indent=4))

except Exception as e:
    print(f"Ulanishda xatolik: {e}")