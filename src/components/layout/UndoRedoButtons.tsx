import { Undo2, Redo2 } from 'lucide-react';
import { useFinanceStore } from '@/store/useFinanceStore';
import { toast } from 'sonner';
import { useState } from 'react';

export default function UndoRedoButtons() {
  const undoStack = useFinanceStore(s => s._undoStack);
  const redoStack = useFinanceStore(s => s._redoStack);
  const undo = useFinanceStore(s => s.undo);
  const redo = useFinanceStore(s => s.redo);
  const [busy, setBusy] = useState(false);

  const canUndo = undoStack.length > 0 && !busy;
  const canRedo = redoStack.length > 0 && !busy;

  async function handleUndo() {
    setBusy(true);
    try {
      await undo();
      toast.success('Undone');
    } catch {
      toast.error('Undo failed');
    }
    setBusy(false);
  }

  async function handleRedo() {
    setBusy(true);
    try {
      await redo();
      toast.success('Redone');
    } catch {
      toast.error('Redo failed');
    }
    setBusy(false);
  }

  if (!canUndo && !canRedo) return null;

  return (
    <div className="fixed top-3 right-3 z-50 flex gap-1 bg-card/90 backdrop-blur border border-border rounded-lg p-1 shadow-lg">
      <button
        onClick={handleUndo}
        disabled={!canUndo}
        className="p-1.5 rounded-md transition-colors hover:bg-secondary disabled:opacity-30 disabled:cursor-not-allowed"
        title={`Undo (${undoStack.length})`}
      >
        <Undo2 className="w-4 h-4" />
      </button>
      <button
        onClick={handleRedo}
        disabled={!canRedo}
        className="p-1.5 rounded-md transition-colors hover:bg-secondary disabled:opacity-30 disabled:cursor-not-allowed"
        title={`Redo (${redoStack.length})`}
      >
        <Redo2 className="w-4 h-4" />
      </button>
    </div>
  );
}
