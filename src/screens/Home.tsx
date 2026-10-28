import { useEffect, useRef, useState } from 'react';
import { STANDARD_COUNT } from '../domain/standards';
import { RULE_PACKS } from '../domain/rulepacks';
import { Icon } from '../ui/primitives';

export type SampleEntry = { file: string; title: string; desc: string };

type Props = {
  busy: string | null;
  error?: string;
  onFiles: (files: File[]) => void;
  onSample: (s: SampleEntry) => void;
  recent: { name: string; at: Date; red: number; orange: number; sections: number }[];
  /** 전체 현황에 더해 올리는 중 */
  appending?: boolean;
};

export default function Home({ busy, error, onFiles, onSample, recent, appending }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [samples, setSamples] = useState<SampleEntry[]>([]);
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}samples/v2/index.json`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setSamples)
      .catch(() => setSamples([]));
  }, []);

  return (
    <div className="mx-auto flex w-[calc(100%-48px)] max-w-page flex-1 flex-col gap-6 py-8">
      <div>
        <h1 className="text-title font-extrabold tracking-[-0.03em] text-ink">교수·학습 및 평가 운영 계획서를 올려 주세요</h1>
        <p className="mt-1 text-body text-ink-3">
          {appending ? '새로 올린 파일은 지금 전체 현황에 더해져요.' : '성취기준 코드, 문서 안의 숫자, 학업성적관리 지침을 한 번에 맞춰 봅니다.'}
        </p>
      </div>

      <div
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && input.current?.click()}
        onClick={() => input.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          const fs = Array.from(e.dataTransfer.files);
          if (fs.length) onFiles(fs);
        }}
        className={`flex h-[230px] cursor-pointer flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed bg-paper transition-colors ${
          over ? 'border-brand-blue bg-brand-blue-50' : 'border-[#c5ced8] hover:border-brand-blue'
        }`}
      >
        <input
          ref={input}
          type="file"
          multiple
          accept=".hwpx,.hwp,.pdf,.docx,.xlsx,.odt"
          className="hidden"
          onChange={(e) => {
            const fs = Array.from(e.target.files ?? []);
            if (fs.length) onFiles(fs);
            e.target.value = '';
          }}
        />
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-blue-50 text-brand-blue">{Icon.upload('h-8 w-8')}</span>
        {busy ? (
          <span className="text-key font-bold text-brand-navy">{busy} 읽는 중…</span>
        ) : (
          <>
            <span className="text-key font-extrabold text-ink">파일을 끌어 놓거나 눌러서 고르세요</span>
            <span className="flex items-center gap-2 text-help text-ink-3">
              {['HWP', 'HWPX', 'PDF', 'Word', 'Excel', 'ODT'].map((f) => (
                <span key={f} className="rounded-md bg-canvas px-2 py-0.5 font-bold text-ink-2">
                  {f}
                </span>
              ))}
              <span>여러 파일 · 전 교과 합본도 한 번에</span>
            </span>
          </>
        )}
      </div>
      {error && <div className="whitespace-pre-line rounded-xl bg-[#fdecef] px-5 py-3 text-body font-bold text-sev-red">{error}</div>}

      <div className="grid grid-cols-[minmax(0,1fr)_360px] gap-6">
        <section className="rounded-xl bg-paper shadow-card">
          <div className="flex items-center justify-between border-b border-line px-5 py-3">
            <h2 className="text-body font-bold text-ink">예시 문서</h2>
            <span className="text-help text-ink-3">실제 공시 문서에서 찾은 오류 유형을 재현한 ○○중학교 문서</span>
          </div>
          <ul>
            {samples.map((s) => (
              <li key={s.file} className="flex items-center gap-4 border-b border-line px-5 py-3 last:border-0">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-blue-50 text-brand-blue">{Icon.file()}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-body font-bold text-ink">{s.title}</div>
                  <div className="truncate text-help text-ink-3">{s.desc}</div>
                </div>
                <button
                  type="button"
                  onClick={() => onSample(s)}
                  className="shrink-0 rounded-lg px-4 py-2 text-help font-bold text-ink shadow-[inset_0_0_0_1px_#e3e7ed] hover:bg-canvas"
                >
                  점검해 보기
                </button>
              </li>
            ))}
            {!samples.length && <li className="px-5 py-4 text-help text-ink-3">예시 문서를 불러오는 중…</li>}
          </ul>
        </section>

        <div className="flex flex-col gap-6">
          <section className="rounded-xl bg-paper p-5 shadow-card">
            <h2 className="mb-3 text-body font-bold text-ink">점검 기준</h2>
            <ul className="space-y-2.5 text-help text-ink-2">
              <li className="flex justify-between gap-3">
                <span>성취기준 DB</span>
                <b className="text-ink">2015·2022 개정 {STANDARD_COUNT['2015'] + STANDARD_COUNT['2022']}개</b>
              </li>
              <li className="flex justify-between gap-3">
                <span>교과</span>
                <b className="text-ink">중학교 24개 교과</b>
              </li>
              <li className="flex justify-between gap-3">
                <span>규칙팩</span>
                <b className="text-ink">{RULE_PACKS.map((p) => p.name).join(', ')}</b>
              </li>
              <li className="border-t border-line pt-2.5">
                <span>검증</span>
                <b className="mt-0.5 block text-ink">공개 계획서 911개 · 처음 보는 문서 오류 주입 99.7% 탐지</b>
              </li>
            </ul>
          </section>
          {recent.length > 0 && (
            <section className="rounded-xl bg-paper p-5 shadow-card">
              <h2 className="mb-3 text-body font-bold text-ink">최근 점검</h2>
              <ul className="space-y-2">
                {recent.slice(0, 4).map((r, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 text-help">
                    <span className="truncate text-ink-2">{r.name}</span>
                    <span className="shrink-0 font-bold text-ink-3">
                      {r.red ? <span className="text-sev-red">오류 {r.red}</span> : <span className="text-brand-green">오류 없음</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
