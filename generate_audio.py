import os
import asyncio
import edge_tts
import chompjs  # ✅ pip install chompjs (ช่วยอ่าน JS Object ได้แม่นยำ ไม่พังเมื่อเจอคำแปลกๆ)

VOICE_EN = "en-US-JennyNeural"
VOICE_TH = "th-TH-NiwatNeural"

LESSONS_DIR = "js/lessons"
AUDIO_DIR = "audio"

os.makedirs(AUDIO_DIR, exist_ok=True)

def parse_js_lesson(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    try:
        # ใช้ chompjs แปลง JS Object เป็น Python Dict โดยตรง
        data = chompjs.parse_js_object(content)
        lesson_id = data.get("id", os.path.basename(filepath).replace('.js', ''))
        cards = data.get("data", [])
        return lesson_id, cards
    except Exception as e:
        print(f"❌ อ่านไฟล์ {filepath} ไม่สำเร็จ: {e}")
        return None, []

async def generate_speech(text, voice, output_path):
    if not text or os.path.exists(output_path):
        return
    communicate = edge_tts.Communicate(text, voice)
    await communicate.save(output_path)
    print(f"  ✓ สร้างไฟล์: {output_path}")

async def main():
    print("🎧 กำลังเริ่มแปลงบทเรียนเป็นไฟล์ MP3...")
    
    # ใส่ sorted เพื่อเรียงลำดับไฟล์ 01, 02 ให้ถูกต้อง
    files = sorted([f for f in os.listdir(LESSONS_DIR) if f.endswith('.js')])
    
    for filename in files:
        filepath = os.path.join(LESSONS_DIR, filename)
        lesson_id, cards = parse_js_lesson(filepath)
        
        if not lesson_id:
            continue
            
        print(f"\n📌 กำลังประมวลผลบทเรียน: {lesson_id}")
        
        for idx, card in enumerate(cards, start=1):
            # ดึง id ของข้อมาใช้ (ถ้าไม่มีให้สร้างเป็น 001, 002 อัตโนมัติ)
            item_id = card.get('id', str(idx).zfill(3))
            prefix = f"{AUDIO_DIR}/{lesson_id}_{item_id}"
            
            # ดึงคำตอบ รองรับทั้ง aTh และ aTH
            a_th_text = card.get('aTh') or card.get('aTH')
            
            tasks = [
                generate_speech(card.get('qTh'), VOICE_TH, f"{prefix}_qTh.mp3"),
                generate_speech(card.get('qEn'), VOICE_EN, f"{prefix}_qEn.mp3"),
                generate_speech(a_th_text, VOICE_TH, f"{prefix}_aTh.mp3"),
                generate_speech(card.get('aEn'), VOICE_EN, f"{prefix}_aEn.mp3"),
            ]
            await asyncio.gather(*tasks)

    print("\n🎉 สร้างไฟล์ MP3 เสร็จสมบูรณ์ทุกบทเรียนแล้ว!")

if __name__ == "__main__":
    asyncio.run(main())