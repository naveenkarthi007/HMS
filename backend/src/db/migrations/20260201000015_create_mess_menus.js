const { tableDefaults, timestamps } = require('../helpers');

exports.up = (knex) =>
  knex.schema.createTable('mess_menus', (t) => {
    tableDefaults(t);
    t.bigIncrements('id');
    t.bigInteger('hostel_id').unsigned().notNullable();
    t.date('date').notNullable();
    t.string('breakfast', 500).nullable();
    t.string('lunch', 500).nullable();
    t.string('snacks', 500).nullable();
    t.string('dinner', 500).nullable();
    t.string('notes', 500).nullable();
    t.bigInteger('updated_by').unsigned().nullable();
    timestamps(knex, t);

    t.unique(['hostel_id', 'date'], 'uq_mess_menus_hostel_date');
    t.index(['updated_by'], 'idx_mess_menus_updated_by');
    // A menu belongs to its hostel.
    t.foreign('hostel_id', 'fk_mess_menus_hostel').references('id').inTable('hostels').onDelete('CASCADE');
    t.foreign('updated_by', 'fk_mess_menus_updated_by').references('id').inTable('users').onDelete('SET NULL');
  });

exports.down = (knex) => knex.schema.dropTableIfExists('mess_menus');
