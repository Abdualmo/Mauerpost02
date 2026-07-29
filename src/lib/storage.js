const K_USERS = "vpg.users";
const K_COMPANIES = "vpg.companies";
const K_EMPLOYEES = "vpg.employees";
const K_VACATIONS = "vpg.vacations";
const K_SESSION = "vpg.session";

function read(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function write(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
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
