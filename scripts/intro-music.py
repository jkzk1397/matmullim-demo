# 소개 영상 배경 음악 합성 (36초, 느린 템포, A단조 → C장조).
# 잔잔한 패드로 시작해 장면이 넘어갈 때마다 아르페지오·베이스·부드러운 박자가 하나씩 더해지고,
# 31초 엔딩에서 C장조로 조용히 풀린다. 효과음과 겹쳐도 시끄럽지 않게 전체를 낮게 둔다. 사용: python3 scripts/intro-music.py video/music.wav
import sys, wave
import numpy as np

SR = 44100
DUR = 36.5
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
    return sig * np.exp(-tt * 6)

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

# 코드 진행: 2.4초(1마디, 100 BPM)마다 Am F C G
CH = [[57, 60, 64], [53, 57, 60], [48, 52, 55, 60], [55, 59, 62]]
ROOT = [45, 41, 36, 43]
ARP = [[69, 72, 76, 72], [69, 72, 77, 72], [67, 72, 76, 72], [67, 71, 74, 71]]
BAR = 2.4
BEAT = BAR / 4
END = 31.0

for bar in range(14):
    t0 = bar * BAR
    if t0 >= END - 0.1: break
    k = bar % 4
    # 패드: 처음부터, 아주 조금씩 커짐
    g = 0.10 + 0.05 * min(1, t0 / 25)
    for m in CH[k]: add(t0, pad_note(m, BAR + 0.4), pan=(m % 5 - 2) * 0.15, gain=g)
    # 아르페지오: 7.5초부터 8분음표
    for i in range(8):
        st = t0 + i * BEAT / 2
        if 7.5 <= st < END: add(st, pluck(ARP[k][i % 4]), pan=0.3 if i % 2 else -0.3, gain=0.08 + 0.03 * min(1, (st - 7.5) / 15))
    # 베이스: 14.3초부터 한 박에 하나
    for i in range(4):
        st = t0 + i * BEAT
        if 14.3 <= st < END: add(st, bass(ROOT[k], BEAT * 0.9), gain=0.10)
    # 부드러운 박자: 20.7초부터 1·3박 킥, 25.9초부터 엇박 하이햇
    for i in range(4):
        st = t0 + i * BEAT
        if 20.7 <= st < END and i % 2 == 0: add(st, kick(), gain=0.22)
        if 25.9 <= st < END: add(st + BEAT / 2, hat(), pan=0.2, gain=0.04)

# 31초 엔딩: C장조 화음이 조용히 퍼지고 길게 울림
for m in [48, 55, 60, 64, 67]:
    add(END, pad_note(m, 5.0), pan=(m % 5 - 2) * 0.2, gain=0.12)
for i, m in enumerate([72, 76, 79, 84]):
    add(END + 0.6 + i * 0.25, pluck(m, 1.8), pan=-0.3 + i * 0.2, gain=0.08)

# 전체: 시작 0.8초 페이드 인, 끝 1.5초 페이드 아웃
fade = np.ones(N)
fi = int(0.8 * SR); fade[:fi] = np.linspace(0, 1, fi)
fo0 = int(34.8 * SR); fade[fo0:] = np.linspace(1, 0, N - fo0)
out *= fade[:, None]
out = np.tanh(out * 1.2) / np.tanh(1.2)
out /= max(1e-9, np.abs(out).max()) / 0.8
pcm = (out * 32767).astype(np.int16)
with wave.open(sys.argv[1], 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print(sys.argv[1])
