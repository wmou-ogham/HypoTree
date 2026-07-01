import { useCallback, useRef } from 'react';

/**
 * 避免注音/拼音 IME 選字確認的 Enter 觸發提交。
 * 部分瀏覽器會在 compositionend 之後才送達確認用的 Enter keydown。
 */
export function useImeEnterGuard() {
  const composingRef = useRef(false);
  const ignoreEnterRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const onCompositionStart = useCallback(() => {
    composingRef.current = true;
  }, []);

  const onCompositionEnd = useCallback(() => {
    composingRef.current = false;
    ignoreEnterRef.current = true;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      ignoreEnterRef.current = false;
      timerRef.current = undefined;
    }, 30);
  }, []);

  const isImeEnter = useCallback((e: React.KeyboardEvent) => {
    const native = e.nativeEvent;
    if (
      composingRef.current ||
      native.isComposing ||
      native.keyCode === 229 ||
      e.key === 'Process'
    ) {
      return true;
    }
    if (ignoreEnterRef.current) {
      ignoreEnterRef.current = false;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = undefined;
      }
      return true;
    }
    return false;
  }, []);

  return { onCompositionStart, onCompositionEnd, isImeEnter };
}
