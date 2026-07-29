import { useState } from "react";
import { AuthProvider, useAuth } from "./contexts/AuthContext.jsx";
import { DataProvider } from "./contexts/DataContext.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import HomePage from "./pages/HomePage.jsx";
import EmployeeDetailPage from "./pages/EmployeeDetailPage.jsx";
import AppHeader from "./components/vacation/AppHeader.jsx";

function Shell() {
  const { isAuthed } = useAuth();
  const [route, setRoute] = useState({ name: "home" });

  if (!isAuthed) return <LoginPage />;

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
