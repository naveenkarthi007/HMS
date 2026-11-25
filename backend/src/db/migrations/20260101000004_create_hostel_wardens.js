const { tableDefaults, timestamps } = require('../helpers');

exports.up = (knex) =>
  knex.schema.createTable('hostel_wardens', (t) => {
    tableDefaults(t);
    t.bigIncrements('id');
    t.bigInteger('hostel_id').unsigned().notNullable();
    t.bigInteger('user_id').unsigned().notNullable();
    timestamps(knex, t);

    t.unique(['hostel_id', 'user_id'], 'uq_hostel_wardens_hostel_user');
    t.index(['user_id'], 'idx_hostel_wardens_user');
    // Assignment rows have no meaning without both sides: cascade.
    t.foreign('hostel_id', 'fk_hostel_wardens_hostel').references('id').inTable('hostels').onDelete('CASCADE');
    t.foreign('user_id', 'fk_hostel_wardens_user').references('id').inTable('users').onDelete('CASCADE');
  });

exports.down = (knex) => knex.schema.dropTableIfExists('hostel_wardens');
