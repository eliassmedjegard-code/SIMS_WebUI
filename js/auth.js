// Mock authentication for local development and testing.
//
// This is a deliberate stand-in for Azure Entra ID. When Entra ID is wired
// up, this whole module gets replaced by MSAL.js (loginRedirect/loginPopup +
// reading the `roles` claim off the ID token) — nothing else in the app
// should need to change, because everything else only depends on
// `getCurrentUser()` returning `{ name, username, role }` and on `hasRole()`.
// Keep that shape stable across the swap.

const STORAGE_KEY = 'aica.auth.v1';

// Stand-in for Entra ID App Roles (see the RBAC plan: Admin / ComplianceOfficer
// / Employee app roles, assigned to users/groups in Enterprise Applications).
export const roles = ['Admin', 'ComplianceOfficer', 'Employee'];

// Stand-in for real employee accounts. In production these don't exist here
// at all — Entra ID owns identity, and role assignment happens in the Azure
// portal, not in this file.
export const testAccounts = [
  { username: 'alice.admin', name: 'Alice Andersson', role: 'Admin', initials: 'AA' },
  { username: 'carl.compliance', name: 'Carl Carlsson', role: 'ComplianceOfficer', initials: 'CC' },
  { username: 'erik.employee', name: 'Erik Eriksson', role: 'Employee', initials: 'EE' },
];

// sessionStorage (not localStorage) so each browser tab can be "logged in"
// as a different test account — convenient for testing role differences
// side by side without accounts clobbering each other.
export function getCurrentUser() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function login(username) {
  const account = testAccounts.find((a) => a.username === username);
  if (!account) throw new Error(`Unknown test account: ${username}`);
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(account));
  } catch {
    // sessionStorage unavailable — the user stays "logged in" for this page load only.
  }
  return account;
}

export function logout() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to clean up if storage was never available.
  }
}

export function hasRole(user, ...allowed) {
  return !!user && allowed.includes(user.role);
}
