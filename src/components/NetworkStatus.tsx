import React from 'react';
import { useSyncStore } from '../store/syncStore';

export default function NetworkStatus() {
  const { online, syncing, pendingCount, flush } = useSyncStore();

  return (
    <button
      type="button"
      onClick={() => void flush()}
      className="flex items-center gap-1.5 mt-1 text-xs"
      title={pendingCount > 0 ? 'Нажмите, чтобы повторить синхронизацию' : 'Статус подключения'}
      aria-live="polite"
    >
      <span className={`w-2 h-2 rounded-full ${online ? 'bg-green-500' : 'bg-red-500'}`} />
      <span className={online ? 'text-green-700' : 'text-red-600'}>
        {online ? 'Онлайн' : 'Офлайн'}
      </span>
      {syncing && <span className="text-slate-500">· Синхронизация...</span>}
      {!syncing && pendingCount > 0 && (
        <span className="text-amber-600">· Ожидают отправки: {pendingCount}</span>
      )}
    </button>
  );
}
