/**
 * Add boys_hostel_manager and girls_hostel_manager roles to users.role.
 */
exports.up = async (knex) => {
  await knex.raw(
    "ALTER TABLE users MODIFY COLUMN role ENUM('super_admin', 'org_admin', 'boys_hostel_manager', 'girls_hostel_manager', 'warden', 'student') NOT NULL",
  );
};

exports.down = async (knex) => {
  await knex('users').whereIn('role', ['boys_hostel_manager', 'girls_hostel_manager']).del();
  await knex.raw("ALTER TABLE users MODIFY COLUMN role ENUM('super_admin', 'org_admin', 'warden', 'student') NOT NULL");
};
