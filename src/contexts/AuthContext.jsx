import { createContext, useContext, useEffect, useState, useCallback } from "react";
import {
  createCompany,
  createUser,
  findUserByEmail,
  getCompany,
  getSession,
  getUsers,
  setSession as persistSession,
} from "../lib/storage.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSessionState] = useState(() => getSession());
  const [company, setCompany] = useState(() => {
    const s = getSession();
    return s ? getCompany(s.companyId) : null;
  });

  const refreshCompany = useCallback(() => {
    if (session) {
      setCompany(getCompany(session.companyId));
    } else {
      setCompany(null);
    }
  }, [session]);

  useEffect(() => {
    refreshCompany();
  }, [session, refreshCompany]);

  const login = useCallback((email, password) => {
    const user = findUserByEmail(email);
    if (!user) throw new Error("Kein Konto mit dieser E-Mail gefunden.");
    if (user.password !== password) throw new Error("Passwort ist falsch.");
    const s = {
      userId: user.id,
      email: user.email,
      fullName: user.fullName,
      companyId: user.companyId,
      role: user.role,
    };
    persistSession(s);
    setSessionState(s);
  }, []);

  const registerCompany = useCallback(
    ({ companyName, fullName, email, password }) => {
      if (getUsers().some((u) => u.email.toLowerCase() === email.toLowerCase())) {
        throw new Error("Ein Konto mit dieser E-Mail existiert bereits.");
      }
      const c = createCompany({ name: companyName });
      const user = createUser({
        email,
        password,
        fullName,
        companyId: c.id,
        role: "admin",
      });
      const s = {
        userId: user.id,
        email: user.email,
        fullName: user.fullName,
        companyId: c.id,
        role: "admin",
      };
      persistSession(s);
      setSessionState(s);
    },
    [],
  );

  const logout = useCallback(() => {
    persistSession(null);
    setSessionState(null);
    setCompany(null);
  }, []);

  const value = {
    session,
    company,
    isAuthed: Boolean(session),
    isAdmin: session?.role === "admin",
    canManage: session?.role === "admin",
    login,
    registerCompany,
    logout,
    refreshCompany,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
