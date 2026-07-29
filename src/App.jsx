import { useState } from "react";
import { AuthProvider, useAuth } from "./contexts/AuthContext.jsx";
import { DataProvider } from "./contexts/DataContext.jsx";
import HomePage from "./pages/HomePage.jsx";
import EmployeeDetailPage from "./pages/EmployeeDetailPage.jsx";
import AppHeader from "./components/vacation/AppHeader.jsx";

function StorageWarning() {
  return (
    <div className="max-w-2xl mx-auto mt-10 card p-6 text-sm">
      <div className="font-semibold text-red-sick mb-2">
        Speicher nicht verfügbar
      </div>
      <p className="text-black/70">
        Dein Browser erlaubt dieser Seite keinen dauerhaften Speicher
        (localStorage). Bitte öffne die App in einem normalen Browser-Fenster
        (nicht privat/inkognito) und stelle sicher, dass Cookies bzw. Speicher
        für diese Seite erlaubt sind.
      </p>
    </div>
  );
}

function Shell() {
  const { storageOk, company } = useAuth();
  const [route, setRoute] = useState({ name: "home" });

  if (!storageOk) {
    return (
      <div className="min-h-full bg-app">
        <StorageWarning />
      </div>
    );
  }
  if (!company) return null;

  const go = (r) => setRoute(r);

  return (
    <div className="min-h-full bg-app">
      <AppHeader />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        {route.name === "home" && (
          <HomePage
            onOpenEmployee={(id) => go({ name: "detail", employeeId: id })}
          />
        )}
        {route.name === "detail" && (
          <EmployeeDetailPage
            employeeId={route.employeeId}
            onBack={() => go({ name: "home" })}
          />
        )}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <DataProvider>
        <Shell />
      </DataProvider>
    </AuthProvider>
  );
}
