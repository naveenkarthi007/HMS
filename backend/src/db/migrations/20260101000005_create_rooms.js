const { tableDefaults, timestamps } = require('../helpers');

exports.up = async (knex) => {
  await knex.schema.createTable('rooms', (t) => {
    tableDefaults(t);
    t.bigIncrements('id');
    t.bigInteger('hostel_id').unsigned().notNullable();
    t.string('room_number', 20).notNullable();
    t.smallint('floor').notNullable().defaultTo(0);
    t.tinyint('capacity').notNullable();
    t.enu('room_type', ['single', 'double', 'triple', 'quad']).notNullable();
    t.enu('status', ['active', 'maintenance']).notNullable().defaultTo('active');
    timestamps(knex, t);

    t.unique(['hostel_id', 'room_number'], 'uq_rooms_hostel_number');
    t.index(['hostel_id', 'status'], 'idx_rooms_hostel_status');
    t.foreign('hostel_id', 'fk_rooms_hostel').references('id').inTable('hostels').onDelete('RESTRICT');
  });

  await knex.raw('ALTER TABLE rooms ADD CONSTRAINT chk_rooms_capacity CHECK (capacity BETWEEN 1 AND 6)');
};

exports.down = (knex) => knex.schema.dropTableIfExists('rooms');
