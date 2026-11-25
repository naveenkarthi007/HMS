const { tableDefaults, timestamps } = require('../helpers');

exports.up = (knex) =>
  knex.schema.createTable('organisations', (t) => {
    tableDefaults(t);
    t.bigIncrements('id');
    t.string('name', 150).notNullable().unique('uq_organisations_name');
    t.string('code', 20).notNullable().unique('uq_organisations_code');
    t.string('address', 255).nullable();
    t.string('contact_email', 150).nullable();
    t.string('contact_phone', 20).nullable();
    t.boolean('is_active').notNullable().defaultTo(true);
    timestamps(knex, t);
  });

exports.down = (knex) => knex.schema.dropTableIfExists('organisations');
