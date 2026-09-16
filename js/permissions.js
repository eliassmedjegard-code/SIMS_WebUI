// Central RBAC policy: which roles can do what. Kept separate from auth.js
// so that swapping the identity provider (mock accounts -> Azure Entra ID
// App Roles) never touches these rules — only how `user.role` gets set
// changes, not what each role is allowed to do.

export const permissions = {
  // Local AI connection/model/generation settings affect every user of this
  // instance and can point the app at an arbitrary endpoint, so only Admins
  // may change them.
  manageLocalAiSettings: ['Admin'],
  clearConversation: ['Admin', 'ComplianceOfficer', 'Employee'],
  changeTheme: ['Admin', 'ComplianceOfficer', 'Employee'],
};

export function can(user, action) {
  const allowedRoles = permissions[action];
  if (!allowedRoles) return false;
  return !!user && allowedRoles.includes(user.role);
}
