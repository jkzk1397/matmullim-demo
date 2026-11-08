// 휴대폰·좁은 창. tailwind.config.js의 `narrow:` 화면과 같은 조건이어야 한다.
export const NARROW_QUERY = 'screen and (max-width: 1023.98px)';

export const isNarrow = () => typeof window !== 'undefined' && !!window.matchMedia?.(NARROW_QUERY).matches;
