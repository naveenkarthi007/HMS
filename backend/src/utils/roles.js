const MANAGER_GENDER = {
  boys_hostel_manager: 'male',
  girls_hostel_manager: 'female',
};

const MANAGER_ROLES = Object.keys(MANAGER_GENDER);
const ADMIN_ROLES = ['org_admin', ...MANAGER_ROLES];
const STAFF_ROLES = [...ADMIN_ROLES, 'warden'];

function getManagedGender(user) {
  return MANAGER_GENDER[user?.role] || null;
}

function isAdminRole(role) {
  return ADMIN_ROLES.includes(role);
}

module.exports = {
  MANAGER_GENDER,
  MANAGER_ROLES,
  ADMIN_ROLES,
  STAFF_ROLES,
  getManagedGender,
  isAdminRole,
};
