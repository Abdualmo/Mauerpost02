import { createContext, useCallback, useContext, useEffect, useState } from "react";
import {
  ensureActiveCompany,
  getActiveCompanyId,
  getCompany,
  resetAll,
  storageAvailable,
  updateCompany as sUpdateCompany,
} from "../lib/storage.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [storageOk] = useState(() => storageAvailable());
  const [company, setCompany] = useState(() =>
    storageOk ? ensureActiveCompany() : null,
  );

  const refreshCompany = useCallback(() => {
    const id = getActiveCompanyId();
    if (id) setCompany(getCompany(id));
  }, []);

  // If the page comes back into focus, re-read the active company (in case
  // it was renamed elsewhere or storage changed).
  useEffect(() => {
    if (!storageOk) return;
    const onFocus = () => refreshCompany();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refreshCompany, storageOk]);

  const value = {
    company,
    storageOk,
    // Every user of this local app is effectively the owner/admin of their
    // own browser-scoped company.
    isAdmin: true,
    canManage: true,
    refreshCompany,
    updateCompany(patch) {
      if (!company) return null;
      const c = sUpdateCompany(company.id, patch);
      setCompany(c);
      return c;
    },
    resetAll() {
      resetAll();
      setCompany(ensureActiveCompany());
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
