import { useEffect } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { useTreeStore } from '../store/useTreeStore';

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable;
}

/**
 * 全域快速鍵：
 * - Enter：選取節點時進入標題編輯；編輯標題中按 Enter 完成編輯（保持選取）
 * - Shift+Enter：新增同層節點
 * - Tab：新增子節點（下一級）
 * - Shift+Tab：選取父節點
 * - Esc：編輯中完成並取消聚焦（保持選取）；否則取消選取
 * - X / V / C：已推翻 / 已證實 / 實驗中
 */
export function useGlobalHotkeys() {
  const opts = { preventDefault: true, enableOnFormTags: false } as const;

  useHotkeys(
    'tab',
    () => {
      const { selectedId, addChild } = useTreeStore.getState();
      if (selectedId) addChild(selectedId);
    },
    opts
  );

  useHotkeys(
    'shift+tab',
    () => {
      useTreeStore.getState().selectParent();
    },
    opts
  );

  useHotkeys(
    'enter',
    () => {
      const { selectedId, editingId, setEditing } = useTreeStore.getState();
      if (!selectedId || editingId === selectedId) return;
      setEditing(selectedId);
    },
    opts
  );

  useHotkeys(
    'escape',
    (event) => {
      const { selectedIds, editingId, commitTitleEdit, select } = useTreeStore.getState();
      if (!selectedIds.length) return;
      const typing = isTypingTarget(event.target);

      if (typing || editingId) {
        if (editingId) commitTitleEdit();
        if (event.target instanceof HTMLElement) event.target.blur();
        return;
      }
      select(null);
    },
    { preventDefault: true, enableOnFormTags: true }
  );

  useHotkeys(
    'shift+enter',
    () => {
      const { selectedId, addSibling } = useTreeStore.getState();
      if (selectedId) addSibling(selectedId);
    },
    opts
  );

  useHotkeys('mod+z', () => useTreeStore.getState().undo(), opts);
  useHotkeys('mod+shift+z', () => useTreeStore.getState().redo(), opts);

  useHotkeys(
    'space',
    () => {
      const { selectedId, editingId, toggleCollapse } = useTreeStore.getState();
      if (selectedId && !editingId) toggleCollapse(selectedId);
    },
    opts
  );

  useHotkeys(
    'x',
    () => {
      const { selectedIds, editingId, setStatusForSelected } = useTreeStore.getState();
      if (!selectedIds.length || editingId) return;
      setStatusForSelected('falsified');
    },
    opts
  );

  useHotkeys(
    'v',
    () => {
      const { selectedIds, editingId, setStatusForSelected } = useTreeStore.getState();
      if (!selectedIds.length || editingId) return;
      setStatusForSelected('validated');
    },
    opts
  );

  useHotkeys(
    'c',
    () => {
      const { selectedIds, editingId, setStatusForSelected } = useTreeStore.getState();
      if (!selectedIds.length || editingId) return;
      setStatusForSelected('experimenting');
    },
    opts
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Backspace' && e.key !== 'Delete') return;
      if (isTypingTarget(e.target)) return;

      const { selectedIds, editingId, removeSelected } = useTreeStore.getState();
      if (!selectedIds.length || editingId) return;

      e.preventDefault();
      e.stopPropagation();
      removeSelected();
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, []);
}
