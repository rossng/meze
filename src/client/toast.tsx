import { createContext } from 'preact';
import { useCallback, useContext, useState } from 'preact/hooks';

interface Toast {
  id: number;
  text: string;
  kind: 'cheers' | 'info' | 'error';
}

const Ctx = createContext<(text: string, kind?: Toast['kind']) => void>(() => {});

export function useToast() {
  return useContext(Ctx);
}

let seq = 0;

export function ToastProvider({ children }: { children: preact.ComponentChildren }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((text: string, kind: Toast['kind'] = 'info') => {
    const id = ++seq;
    setToasts((t) => [...t.slice(-4), { id, text, kind }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'cheers' ? 3500 : 2500);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div class="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} class={`toast toast-${t.kind}`}>
            {t.kind === 'cheers' ? <span class="toast-glass">🥃</span> : null}
            {t.text}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
