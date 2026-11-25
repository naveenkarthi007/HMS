const { tableDefaults, timestamps } = require('../helpers');

exports.up = (knex) =>
  knex.schema.createTable('hostels', (t) => {
    tableDefaults(t);
    t.bigIncrements('id');
    t.bigInteger('organisation_id').unsigned().notNullable();
    t.string('name', 120).notNullable();
    t.string('code', 20).notNullable();
    t.enu('gender', ['male', 'female']).notNullable();
    t.string('address', 255).nullable();
    t.boolean('is_active').notNullable().defaultTo(true);
    timestamps(knex, t);

    t.unique(['organisation_id', 'code'], 'uq_hostels_org_code');
    t.index(['organisation_id', 'gender'], 'idx_hostels_org_gender');
    t.foreign('organisation_id', 'fk_hostels_organisation')
      .references('id')
      .inTable('organisations')
      .onDelete('RESTRICT');
  });

exports.down = (knex) => knex.schema.dropTableIfExists('hostels');
