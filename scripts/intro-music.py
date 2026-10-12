# 소개 영상 배경 음악 합성 (30초, 120 BPM, A단조 → C장조).
# 잔잔한 패드로 시작해 아르페지오·베이스·킥이 차례로 쌓이고, 22초부터 빨라지는 원칙 컷에 맞춰 고조된 뒤
# 25.7초 엔딩에서 한 번 터지고 가라앉는다. 사용: python3 scripts/intro-music.py video/music.wav
import sys, wave
import numpy as np

SR = 44100
DUR = 30.5
N = int(SR * DUR)
t = np.arange(N) / SR
out = np.zeros((N, 2))
rng = np.random.default_rng(7)

def env(n, a, d, s, r, sus):
    e = np.ones(n) * s
    A, D, R = int(a * SR), int(d * SR), int(r * SR)
    A = min(A, n); e[:A] = np.linspace(0, 1, A)
    D = min(D, n - A); e[A:A + D] = np.linspace(1, s, D)
    ss = int(sus * SR)
    if ss < n:
        e[ss:] = e[ss] * np.exp(-np.arange(n - ss) / (r * SR / 4 + 1))
    return e

def add(start, sig, pan=0.0, gain=1.0):
    i = int(start * SR)
    j = min(N, i + len(sig))
    if j <= i: return
    l = np.cos((pan + 1) * np.pi / 4); r = np.sin((pan + 1) * np.pi / 4)
    out[i:j, 0] += sig[: j - i] * gain * l
    out[i:j, 1] += sig[: j - i] * gain * r

def hz(m): return 440 * 2 ** ((m - 69) / 12)

def pad_note(m, dur):
    n = int(dur * SR); tt = np.arange(n) / SR
    sig = sum(np.sin(2 * np.pi * hz(m) * (1 + d) * tt) for d in (-0.004, 0, 0.0035)) / 3
    sig += 0.25 * np.sin(2 * np.pi * hz(m + 12) * tt)
    return sig * env(n, 0.6, 0.4, 0.8, 1.2, dur - 0.3)

def pluck(m, dur=0.45):
    n = int(dur * SR); tt = np.arange(n) / SR
    sig = np.sin(2 * np.pi * hz(m) * tt) + 0.35 * np.sin(2 * np.pi * hz(m) * 2 * tt) + 0.12 * np.sin(2 * np.pi * hz(m) * 3 * tt)
    return sig * np.exp(-tt * 9)

def bass(m, dur):
    n = int(dur * SR); tt = np.arange(n) / SR
    sig = np.tanh(1.6 * np.sin(2 * np.pi * hz(m) * tt))
    return sig * env(n, 0.01, 0.15, 0.7, 0.1, dur - 0.05)

def kick():
    n = int(0.35 * SR); tt = np.arange(n) / SR
    f = 50 + 110 * np.exp(-tt * 28)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 9)

def hat(dur=0.06):
    n = int(dur * SR); tt = np.arange(n) / SR
    x = rng.standard_normal(n); x = np.diff(np.concatenate([[0], x]))
    return x * np.exp(-tt * 70)

# 코드 진행: 2초(1마디)마다 Am F C G
CH = [[57, 60, 64], [53, 57, 60], [48, 52, 55, 60], [55, 59, 62]]
ROOT = [45, 41, 36, 43]
ARP = [[69, 72, 76, 72], [69, 72, 77, 72], [67, 72, 76, 72], [67, 71, 74, 71]]
BEAT = 0.5

for bar in range(13):
    t0 = bar * 2.0
    if t0 >= 25.6: break
    k = bar % 4
    # 패드: 처음부터, 점점 커짐
    g = 0.10 + 0.10 * min(1, t0 / 20)
    for m in CH[k]: add(t0, pad_note(m, 2.3), pan=(m % 5 - 2) * 0.15, gain=g)
    # 아르페지오: 7초부터 8분음표, 20초부터 16분음표
    if t0 >= 6.0:
        step = BEAT / 2 if t0 < 20 else BEAT / 4
        for i in range(int(2.0 / step)):
            st = t0 + i * step
            if st < 7.0: continue
            add(st, pluck(ARP[k][i % 4] + (12 if t0 >= 20 and i % 2 else 0)), pan=0.35 if i % 2 else -0.35, gain=0.13)
    # 베이스: 13초부터
    if t0 >= 12.0:
        for i in range(4):
            st = t0 + i * BEAT
            if st >= 13.0: add(st, bass(ROOT[k], BEAT * 0.9), gain=0.16)
    # 킥: 13초부터 4박, 18.5초부터 하이햇
    for i in range(4):
        st = t0 + i * BEAT
        if 13.0 <= st < 25.6: add(st, kick(), gain=0.55)
        if 18.5 <= st < 25.6: add(st + BEAT / 2, hat(), pan=0.2, gain=0.10)

# 22~25.6초: 원칙 컷마다 빨라지는 스네어 롤 + 노이즈 라이저
roll_t = 22.0
while roll_t < 25.6:
    p = (roll_t - 22.0) / 3.6
    add(roll_t, hat(0.09), gain=0.12 + 0.25 * p)
    roll_t += 0.25 * (1 - p) + 0.05
n = int(3.6 * SR); tt = np.arange(n) / SR
noise = rng.standard_normal(n)
riser = np.convolve(noise, np.ones(8) / 8, mode='same') * (tt / 3.6) ** 2
add(22.0, riser, gain=0.22)

# 25.7초 엔딩: 임팩트 + C장조 큰 화음, 길게 울림
add(25.7, kick(), gain=0.9)
n = int(4.8 * SR); tt = np.arange(n) / SR
boom = rng.standard_normal(n) * np.exp(-tt * 6)
add(25.7, np.convolve(boom, np.ones(40) / 40, mode='same'), gain=0.35)
for m in [48, 55, 60, 64, 67, 72]:
    add(25.7, pad_note(m, 4.6), pan=(m % 5 - 2) * 0.2, gain=0.13)
for i, m in enumerate([72, 76, 79, 84]):
    add(25.7 + i * 0.12, pluck(m, 1.5), pan=-0.3 + i * 0.2, gain=0.14)

# 전체: 시작 0.4초 페이드 인, 끝 1.5초 페이드 아웃, 리미터
fade = np.ones(N)
fi = int(0.4 * SR); fade[:fi] = np.linspace(0, 1, fi)
fo0 = int(28.8 * SR); fade[fo0:] = np.linspace(1, 0, N - fo0)
out *= fade[:, None]
out = np.tanh(out * 1.4) / np.tanh(1.4)
out /= max(1e-9, np.abs(out).max()) / 0.9
pcm = (out * 32767).astype(np.int16)
with wave.open(sys.argv[1], 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print(sys.argv[1])
