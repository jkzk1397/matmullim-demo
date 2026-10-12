# 배경 음악(video/music.wav) + ElevenLabs 효과음(video/sfx/*.wav)을 영상 시간표에 맞춰 섞고
# 무음 영상에 입혀 video/matmullim-intro.mp4를 만든다.
import subprocess

# (파일, 시각(초), 음량)
CUES = [
    ('whoosh2', 0.22, 0.35), ('whoosh2', 0.92, 0.35), ('whoosh2', 1.62, 0.35), ('whoosh1', 2.42, 0.45),
    ('whoosh1', 4.2, 0.6),                                   # 앱 창이 올라옴
    ('click', 7.45, 0.9), ('whoosh2', 7.6, 0.4),             # 샘플 열기 → 확인 화면
    ('click', 8.6, 0.45), ('click', 8.85, 0.45),             # 원문 칸·추출값 표시
    ('click', 11.45, 0.9),                                   # 점검하기
    ('whoosh1', 13.0, 0.6), ('whoosh2', 15.3, 0.4),          # 결과, 두 문서 확대
    ('whoosh2', 17.0, 0.5), ('click', 18.5, 0.9),            # 정렬 맵, 평가 연결
    ('whoosh1', 19.5, 0.5), ('chime1', 20.7, 0.8),           # 재점검, 해결
    ('whoosh2', 22.0, 0.55), ('whoosh2', 23.0, 0.6), ('whoosh2', 23.9, 0.65), ('whoosh2', 24.8, 0.7),
    ('chime1', 26.3, 0.7),                                   # 엔딩 로고
]

inputs = ['-i', 'video/matmullim-intro-silent.mp4', '-i', 'video/music.wav']
filters, labels = ['[1:a]volume=0.85[m]'], ['[m]']
for i, (name, at, vol) in enumerate(CUES):
    inputs += ['-i', f'video/sfx/{name}.wav']
    ms = int(at * 1000)
    filters.append(f'[{i + 2}:a]aformat=sample_rates=44100:channel_layouts=stereo,volume={vol},adelay={ms}|{ms}[s{i}]')
    labels.append(f'[s{i}]')
filters.append(f"{''.join(labels)}amix=inputs={len(labels)}:normalize=0:duration=first,atrim=0:30,alimiter=limit=0.95,afade=t=out:st=29.2:d=0.8[a]")
cmd = ['ffmpeg', '-v', 'error', '-y', *inputs, '-filter_complex', ';'.join(filters), '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', 'video/matmullim-intro.mp4']
subprocess.run(cmd, check=True)
print('video/matmullim-intro.mp4')
