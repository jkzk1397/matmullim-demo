# 배경 음악(video/music.wav) + ElevenLabs 효과음(video/sfx/*.wav)을 영상 시간표에 맞춰 섞고
# 무음 영상에 입혀 video/matmullim-intro.mp4를 만든다.
import subprocess

# 음악(video/music.wav)은 앞 3초를 잘라 쓴다(장면 시각표가 3초부터 시작).
# (파일, 시각(초), 음량): 클릭과 해결 순간, 엔딩만 조용히
CUES = [
    ('click', 3.9, 0.35),    # 샘플 열기
    ('click', 11.1, 0.35),   # 점검하기
    ('click', 20.4, 0.35),   # 평가 연결
    ('chime1', 24.9, 0.25),  # 4건 해결
    ('chime1', 29.3, 0.3),   # 엔딩 로고
]

inputs = ['-i', 'video/matmullim-intro-silent.mp4', '-i', 'video/music.wav']
filters, labels = ['[1:a]atrim=start=3,asetpts=PTS-STARTPTS,afade=t=in:d=0.6,volume=0.6[m]'], ['[m]']
for i, (name, at, vol) in enumerate(CUES):
    inputs += ['-i', f'video/sfx/{name}.wav']
    ms = int(at * 1000)
    filters.append(f'[{i + 2}:a]aformat=sample_rates=44100:channel_layouts=stereo,volume={vol},adelay={ms}|{ms}[s{i}]')
    labels.append(f'[s{i}]')
filters.append(f"{''.join(labels)}amix=inputs={len(labels)}:normalize=0:duration=first,atrim=0:33,alimiter=limit=0.95,afade=t=out:st=32.0:d=1.0[a]")
cmd = ['ffmpeg', '-v', 'error', '-y', *inputs, '-filter_complex', ';'.join(filters), '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', 'video/matmullim-intro.mp4']
subprocess.run(cmd, check=True)
print('video/matmullim-intro.mp4')
