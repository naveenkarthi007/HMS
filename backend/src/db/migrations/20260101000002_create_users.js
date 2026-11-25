const { tableDefaults, timestamps } = require('../helpers');

exports.up = async (knex) => {
  await knex.schema.createTable('users', (t) => {
    tableDefaults(t);
    t.bigIncrements('id');
    t.bigInteger('organisation_id').unsigned().nullable();
    t.string('name', 120).notNullable();
    t.string('email', 150).notNullable().unique('uq_users_email');
    t.string('password_hash', 255).notNullable();
    t.enu('role', ['super_admin', 'org_admin', 'warden', 'student']).notNullable();
    t.enu('gender', ['male', 'female']).nullable();
    t.string('phone', 20).nullable();
    t.boolean('is_active').notNullable().defaultTo(true);
    t.timestamp('last_login_at').nullable();
    timestamps(knex, t);

    t.index(['organisation_id', 'role'], 'idx_users_org_role');
    t.foreign('organisation_id', 'fk_users_organisation')
      .references('id')
      .inTable('organisations')
      .onDelete('RESTRICT');
  });

  // Only super admins may exist without an organisation.
  await knex.raw(
    "ALTER TABLE users ADD CONSTRAINT chk_users_org_role CHECK ((role = 'super_admin') OR (organisation_id IS NOT NULL))",
  );
};

exports.down = (knex) => knex.schema.dropTableIfExists('users');
