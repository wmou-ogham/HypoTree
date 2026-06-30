import { useEffect, useRef } from 'react';

/** 追蹤 Shift 是否按住（補強 React Flow 點擊事件偶爾遺失 shiftKey 的問題） */
export function useShiftHeld() {
  const shiftHeldRef = useRef(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') shiftHeldRef.current = true;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') shiftHeldRef.current = false;
    };
    const onBlur = () => {
      shiftHeldRef.current = false;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  return shiftHeldRef;
}

export function isShiftClick(
  event: React.MouseEvent | MouseEvent,
  shiftHeldRef: React.RefObject<boolean>
): boolean {
  return event.shiftKey || Boolean(shiftHeldRef.current);
}
