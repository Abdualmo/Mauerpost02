import { useState } from "react";
import { CalendarDays } from "lucide-react";
import { useAuth } from "../contexts/AuthContext.jsx";

export default function LoginPage() {
  const { login, registerCompany } = useAuth();
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "login") {
        login(email, password);
      } else {
        if (!companyName.trim()) throw new Error("Firmenname ist erforderlich.");
        if (!fullName.trim()) throw new Error("Name ist erforderlich.");
        if (!email.trim()) throw new Error("E-Mail ist erforderlich.");
        if (password.length < 4)
          throw new Error("Passwort muss mindestens 4 Zeichen haben.");
        registerCompany({ companyName, fullName, email, password });
      }
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-full bg-app flex items-center justify-center px-4 py-10">
      <div className="card w-full max-w-md p-6 sm:p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full bg-black flex items-center justify-center">
            <CalendarDays className="w-5 h-5 text-gold" />
          </div>
          <div>
            <div className="font-semibold">VacationPlanner Gold</div>
            <div className="text-xs text-black/50">
              Elegante Urlaubsverwaltung
            </div>
          </div>
        </div>

        <div className="flex gap-2 mb-6">
          <button
            className={`flex-1 rounded-xl py-2 text-sm font-medium transition-colors ${
              mode === "login"
                ? "bg-gold text-white"
                : "bg-black/5 text-black/70 hover:bg-black/10"
            }`}
            onClick={() => setMode("login")}
            type="button"
          >
            Anmelden
          </button>
          <button
            className={`flex-1 rounded-xl py-2 text-sm font-medium transition-colors ${
              mode === "register"
                ? "bg-gold text-white"
                : "bg-black/5 text-black/70 hover:bg-black/10"
            }`}
            onClick={() => setMode("register")}
            type="button"
          >
            Firma anlegen
          </button>
        </div>

        <form onSubmit={submit} className="space-y-3">
          {mode === "register" && (
            <>
              <div>
                <label className="label">Firmenname</label>
                <input
                  className="input"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Muster GmbH"
                  autoFocus
                />
              </div>
              <div>
                <label className="label">Vor- und Nachname</label>
                <input
                  className="input"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Anna Beispiel"
                />
              </div>
            </>
          )}
          <div>
            <label className="label">E-Mail</label>
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@firma.de"
              autoFocus={mode === "login"}
            />
          </div>
          <div>
            <label className="label">Passwort</label>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="text-sm text-red-700 bg-red-50 rounded-xl px-3 py-2">
              {error}
            </div>
          )}

          <button type="submit" className="btn-primary w-full justify-center" disabled={busy}>
            {mode === "login" ? "Anmelden" : "Firma anlegen"}
          </button>
        </form>

        <p className="text-xs text-black/50 mt-4 leading-relaxed">
          Deine Firma wird beim Anlegen automatisch erstellt und du wirst der
          Admin. Alle Daten deiner Firma sind vollständig von anderen Firmen
          getrennt.
        </p>
      </div>
    </div>
  );
}
