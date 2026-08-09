import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useAuth } from "./AuthContext.jsx";
import {
  createEmployee as sCreateEmployee,
  createVacation as sCreateVacation,
  deleteEmployee as sDeleteEmployee,
  deleteVacation as sDeleteVacation,
  getArchivedEmployees,
  getEmployees,
  getTrashedEmployees,
  getVacations,
  moveEmployeeToTrash as sMoveEmployeeToTrash,
  onDataChange,
  purgeExpiredTrash,
  restoreEmployeeFromTrash as sRestoreEmployeeFromTrash,
  updateEmployee as sUpdateEmployee,
  updateVacation as sUpdateVacation,
} from "../lib/storage.js";

const DataContext = createContext(null);

export function DataProvider({ children }) {
  const { company, updateCompany } = useAuth();
  const [tick, setTick] = useState(0);
  const bump = useCallback(() => setTick((n) => n + 1), []);

  useEffect(() => onDataChange(bump), [bump]);

  // Auto-purge trashed employees older than 90 days whenever the company
  // or storage changes. Runs cheap; noop if nothing to purge.
  useEffect(() => {
    purgeExpiredTrash();
  }, [tick]);

  const companyId = company?.id;

  const employees = useMemo(() => {
    if (!companyId) return [];
    return getEmployees(companyId).sort((a, b) =>
      a.fullName.localeCompare(b.fullName, "de"),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, tick]);

  const archivedEmployees = useMemo(() => {
    if (!companyId) return [];
    return getArchivedEmployees(companyId).sort((a, b) =>
      a.fullName.localeCompare(b.fullName, "de"),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, tick]);

  const trashedEmployees = useMemo(() => {
    if (!companyId) return [];
    return getTrashedEmployees(companyId).sort((a, b) =>
      (b.deletedAt || "").localeCompare(a.deletedAt || ""),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, tick]);

  const vacations = useMemo(() => {
    if (!companyId) return [];
    return getVacations(companyId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, tick]);

  const api = {
    employees,
    archivedEmployees,
    trashedEmployees,
    vacations,
    company,
    archiveEmployee(id) {
      if (!companyId) return;
      sUpdateEmployee(id, companyId, {
        archived: true,
        archivedAt: new Date().toISOString(),
      });
      bump();
    },
    unarchiveEmployee(id) {
      if (!companyId) return;
      sUpdateEmployee(id, companyId, { archived: false, archivedAt: null });
      bump();
    },
    moveToTrash(id) {
      if (!companyId) return;
      sMoveEmployeeToTrash(id, companyId);
      bump();
    },
    restoreFromTrash(id) {
      if (!companyId) return;
      sRestoreEmployeeFromTrash(id, companyId);
      bump();
    },
    purgeNow(id) {
      if (!companyId) return;
      sDeleteEmployee(id, companyId);
      bump();
    },
    createEmployee(data) {
      if (!companyId) return null;
      const e = sCreateEmployee(companyId, data);
      bump();
      return e;
    },
    updateEmployee(id, patch) {
      if (!companyId) return null;
      const e = sUpdateEmployee(id, companyId, patch);
      bump();
      return e;
    },
    deleteEmployee(id) {
      if (!companyId) return;
      sDeleteEmployee(id, companyId);
      bump();
    },
    createVacation(data) {
      if (!companyId) return null;
      const v = sCreateVacation(companyId, data);
      bump();
      return v;
    },
    updateVacation(id, patch) {
      if (!companyId) return null;
      const v = sUpdateVacation(id, companyId, patch);
      bump();
      return v;
    },
    deleteVacation(id) {
      if (!companyId) return;
      sDeleteVacation(id, companyId);
      bump();
    },
    updateCompany(patch) {
      const c = updateCompany(patch);
      bump();
      return c;
    },
    reload: bump,
  };

  return <DataContext.Provider value={api}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used inside DataProvider");
  return ctx;
}
