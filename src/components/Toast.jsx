import { createContext, useCallback, useContext, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';

const ToastContext = createContext(() => {});
let counter = 0;

const ICONS = {
  success: CheckCircle2,
  error: AlertTriangle,
  info: Info,
};

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);

  const push = useCallback((message, tone = 'info') => {
    const id = ++counter;
    setItems((previous) => [...previous, { id, message, tone }]);
    setTimeout(() => {
      setItems((previous) => previous.filter((item) => item.id !== id));
    }, 4200);
  }, []);

  const remove = useCallback((id) => {
    setItems((previous) => previous.filter((item) => item.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="toast-stack" role="status" aria-live="polite">
        {items.map((item) => {
          const Icon = ICONS[item.tone] || Info;
          return (
            <div key={item.id} className={`toast toast-${item.tone}`}>
              <Icon size={15} className="toast-icon" />
              <span className="toast-text">{item.message}</span>
              <button
                type="button"
                className="toast-close"
                onClick={() => remove(item.id)}
                aria-label="关闭提示"
              >
                <X size={13} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
