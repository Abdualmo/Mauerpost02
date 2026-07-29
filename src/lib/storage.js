const K_USERS = "vpg.users";
const K_COMPANIES = "vpg.companies";
const K_EMPLOYEES = "vpg.employees";
const K_VACATIONS = "vpg.vacations";
const K_SESSION = "vpg.session";
const K_ACTIVE_COMPANY = "vpg.activeCompany";
const K_WARN_ACK = "vpg.warningsAcked";

export function storageAvailable() {
  try {
    const k = "__vpg_probe__";
    localStorage.setItem(k, "1");
    localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
}

function read(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

const listeners = new Set();
export function onDataChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function notify() {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {
      /* ignore */
    }
  });
}

function write(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
  notify();
}

function uid() {
  return (
    Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10)
  );
}

export function getUsers() {
  return read(K_USERS);
}

export function getCompanies() {
  return read(K_COMPANIES);
}

export function getCompany(companyId) {
  return getCompanies().find((c) => c.id === companyId) || null;
}

export function updateCompany(companyId, patch) {
  const companies = getCompanies();
  const idx = companies.findIndex((c) => c.id === companyId);
  if (idx === -1) return null;
  companies[idx] = { ...companies[idx], ...patch };
  write(K_COMPANIES, companies);
  return companies[idx];
}

export function createCompany({ name, defaultVacationDays = 30 }) {
  const companies = getCompanies();
  const company = {
    id: uid(),
    name,
    defaultVacationDays,
    recurringCompanyVacation: [],
    createdAt: new Date().toISOString(),
  };
  companies.push(company);
  write(K_COMPANIES, companies);
  return company;
}

export function createUser({ email, password, fullName, companyId, role }) {
  const users = getUsers();
  if (users.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
    throw new Error("Ein Konto mit dieser E-Mail existiert bereits.");
  }
  const user = {
    id: uid(),
    email: email.trim(),
    password,
    fullName: fullName.trim(),
    companyId,
    role,
    createdAt: new Date().toISOString(),
  };
  users.push(user);
  write(K_USERS, users);
  return user;
}

export function findUserByEmail(email) {
  return (
    getUsers().find(
      (u) => u.email.toLowerCase() === email.trim().toLowerCase(),
    ) || null
  );
}

export function getSession() {
  try {
    const raw = localStorage.getItem(K_SESSION);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setSession(session) {
  if (session) write(K_SESSION, session);
  else localStorage.removeItem(K_SESSION);
}

export function getActiveCompanyId() {
  try {
    return localStorage.getItem(K_ACTIVE_COMPANY) || null;
  } catch {
    return null;
  }
}

export function setActiveCompanyId(id) {
  try {
    if (id) localStorage.setItem(K_ACTIVE_COMPANY, id);
    else localStorage.removeItem(K_ACTIVE_COMPANY);
    notify();
  } catch {
    /* ignore */
  }
}

// Full-store export/import used by portable-file sync.
export function exportAll() {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    activeCompanyId: getActiveCompanyId(),
    companies: getCompanies(),
    employees: read(K_EMPLOYEES),
    vacations: read(K_VACATIONS),
    warningsAcked: readAcks(),
  };
}

export function importAll(data) {
  if (!data || typeof data !== "object") {
    throw new Error("Ungültige Datei: kein Objekt.");
  }
  if (!Array.isArray(data.companies) || !Array.isArray(data.employees) || !Array.isArray(data.vacations)) {
    throw new Error("Ungültige Datei: Struktur passt nicht.");
  }
  localStorage.setItem(K_COMPANIES, JSON.stringify(data.companies));
  localStorage.setItem(K_EMPLOYEES, JSON.stringify(data.employees));
  localStorage.setItem(K_VACATIONS, JSON.stringify(data.vacations));
  if (data.activeCompanyId) {
    localStorage.setItem(K_ACTIVE_COMPANY, data.activeCompanyId);
  }
  if (data.warningsAcked && typeof data.warningsAcked === "object") {
    localStorage.setItem(K_WARN_ACK, JSON.stringify(data.warningsAcked));
  }
  notify();
}

// Ensures a company exists and is marked active. If nothing is stored yet,
// a default company is auto-created so the app can be used without any login.
export function ensureActiveCompany() {
  const companies = getCompanies();
  let activeId = getActiveCompanyId();
  if (activeId && companies.some((c) => c.id === activeId)) {
    return getCompany(activeId);
  }
  if (companies.length > 0) {
    setActiveCompanyId(companies[0].id);
    return companies[0];
  }
  const c = createCompany({ name: "Meine Firma" });
  setActiveCompanyId(c.id);
  return c;
}

export function resetAll() {
  try {
    [
      K_USERS,
      K_COMPANIES,
      K_EMPLOYEES,
      K_VACATIONS,
      K_SESSION,
      K_ACTIVE_COMPANY,
      K_WARN_ACK,
    ].forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}

function readAcks() {
  try {
    const raw = localStorage.getItem(K_WARN_ACK);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function isWarningAcked(employeeId, year) {
  const acks = readAcks();
  return Boolean(acks[`${employeeId}:${year}`]);
}

export function ackWarning(employeeId, year) {
  const acks = readAcks();
  acks[`${employeeId}:${year}`] = true;
  localStorage.setItem(K_WARN_ACK, JSON.stringify(acks));
  notify();
}

export function getEmployees(companyId) {
  return read(K_EMPLOYEES).filter((e) => e.companyId === companyId);
}

export function getEmployee(id, companyId) {
  return (
    read(K_EMPLOYEES).find((e) => e.id === id && e.companyId === companyId) ||
    null
  );
}

export function createEmployee(companyId, data) {
  const all = read(K_EMPLOYEES);
  const emp = {
    id: uid(),
    companyId,
    fullName: data.fullName.trim(),
    yearlyVacationDays: Number(data.yearlyVacationDays) || 0,
    weeklyHours: Number(data.weeklyHours) || 0,
    hireDate: data.hireDate,
    birthDate: data.birthDate || "",
    role: data.role || "employee",
    userId: data.userId || "",
    createdAt: new Date().toISOString(),
  };
  all.push(emp);
  write(K_EMPLOYEES, all);
  return emp;
}

export function updateEmployee(id, companyId, patch) {
  const all = read(K_EMPLOYEES);
  const idx = all.findIndex((e) => e.id === id && e.companyId === companyId);
  if (idx === -1) return null;
  all[idx] = { ...all[idx], ...patch };
  write(K_EMPLOYEES, all);
  return all[idx];
}

export function deleteEmployee(id, companyId) {
  const all = read(K_EMPLOYEES).filter(
    (e) => !(e.id === id && e.companyId === companyId),
  );
  write(K_EMPLOYEES, all);
  const vacs = read(K_VACATIONS).filter(
    (v) => !(v.employeeId === id && v.companyId === companyId),
  );
  write(K_VACATIONS, vacs);
}

export function getVacations(companyId, { employeeId } = {}) {
  return read(K_VACATIONS).filter(
    (v) =>
      v.companyId === companyId &&
      (employeeId ? v.employeeId === employeeId : true),
  );
}

export function createVacation(companyId, data) {
  const all = read(K_VACATIONS);
  const vac = {
    id: uid(),
    companyId,
    employeeId: data.employeeId || null,
    startDate: data.startDate,
    endDate: data.endDate,
    type: data.type,
    notes: data.notes || "",
    createdAt: new Date().toISOString(),
  };
  all.push(vac);
  write(K_VACATIONS, all);
  return vac;
}

export function updateVacation(id, companyId, patch) {
  const all = read(K_VACATIONS);
  const idx = all.findIndex((v) => v.id === id && v.companyId === companyId);
  if (idx === -1) return null;
  all[idx] = { ...all[idx], ...patch };
  write(K_VACATIONS, all);
  return all[idx];
}

export function deleteVacation(id, companyId) {
  const all = read(K_VACATIONS).filter(
    (v) => !(v.id === id && v.companyId === companyId),
  );
  write(K_VACATIONS, all);
}
