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
 * - Enter：標題編輯 → 完成標題 → 聚焦備註
 * - Shift+Enter：新增同層節點
 * - Tab：新增子節點（下一級）
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
    'enter',
    () => {
      const { selectedId, editingId, titleCommitted, setEditing, commitTitleEdit, requestNoteFocus } =
        useTreeStore.getState();
      if (!selectedId) return;

      if (editingId === selectedId) {
        commitTitleEdit();
        return;
      }
      if (titleCommitted) {
        requestNoteFocus();
        return;
      }
      setEditing(selectedId);
    },
    opts
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
