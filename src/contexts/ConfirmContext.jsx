import { createContext, useCallback, useContext, useState } from "react";
import { AlertTriangle, X } from "lucide-react";

const ConfirmContext = createContext(null);

export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null);

  const confirm = useCallback((opts = {}) => {
    return new Promise((resolve) => {
      setState({
        title: opts.title || "Bestätigen",
        message: opts.message || "Bist du sicher?",
        confirmLabel: opts.confirmLabel || "Löschen",
        cancelLabel: opts.cancelLabel || "Abbrechen",
        danger: opts.danger !== false,
        resolve,
      });
    });
  }, []);

  const done = (result) => {
    const s = state;
    setState(null);
    if (s && s.resolve) s.resolve(result);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && (
        <div className="dialog-backdrop" onMouseDown={() => done(false)}>
          <div
            className="dialog-panel p-5 sm:p-6 max-w-sm"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 mb-3">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                  state.danger ? "bg-red-50 text-red-sick" : "bg-gold-softer text-gold-dark"
                }`}
              >
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-lg">{state.title}</div>
                <div className="text-sm text-black/70 mt-1">{state.message}</div>
              </div>
              <button
                className="btn-ghost !p-2"
                onClick={() => done(false)}
                title="Schließen"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button className="btn-ghost" onClick={() => done(false)}>
                {state.cancelLabel}
              </button>
              <button
                className={state.danger ? "btn-danger" : "btn-primary"}
                onClick={() => done(true)}
                autoFocus
              >
                {state.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used inside ConfirmProvider");
  return ctx;
}
