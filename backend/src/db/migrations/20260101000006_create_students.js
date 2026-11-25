const { tableDefaults, timestamps } = require('../helpers');

exports.up = async (knex) => {
  await knex.schema.createTable('students', (t) => {
    tableDefaults(t);
    t.bigIncrements('id');
    t.bigInteger('user_id').unsigned().notNullable().unique('uq_students_user');
    t.bigInteger('organisation_id').unsigned().notNullable();
    t.string('register_no', 30).notNullable();
    t.string('department', 100).notNullable();
    t.tinyint('year').notNullable();
    t.string('guardian_name', 120).nullable();
    t.string('guardian_phone', 20).nullable();
    t.string('address', 255).nullable();
    t.date('date_of_birth').nullable();
    timestamps(knex, t);

    t.unique(['organisation_id', 'register_no'], 'uq_students_org_register');
    // Deleting a user account removes the student profile with it.
    t.foreign('user_id', 'fk_students_user').references('id').inTable('users').onDelete('CASCADE');
    t.foreign('organisation_id', 'fk_students_organisation')
      .references('id')
      .inTable('organisations')
      .onDelete('RESTRICT');
  });

  await knex.raw('ALTER TABLE students ADD CONSTRAINT chk_students_year CHECK (year BETWEEN 1 AND 5)');
};

exports.down = (knex) => knex.schema.dropTableIfExists('students');
