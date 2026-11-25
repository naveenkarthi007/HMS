const { tableDefaults, timestamps } = require('../helpers');

exports.up = async (knex) => {
  await knex.schema.createTable('warden_assignments', (t) => {
    tableDefaults(t);
    t.bigIncrements('id');
    t.bigInteger('user_id').unsigned().notNullable();
    t.bigInteger('hostel_id').unsigned().notNullable();
    t.enu('scope_type', ['hostel', 'floor', 'room_range', 'room']).notNullable().defaultTo('hostel');
    t.smallint('floor').nullable();
    t.string('room_start', 20).nullable();
    t.string('room_end', 20).nullable();
    t.string('room_number', 20).nullable();
    timestamps(knex, t);

    t.index(['user_id', 'hostel_id'], 'idx_wa_user_hostel');
    t.index(['hostel_id', 'scope_type'], 'idx_wa_hostel_scope');
    t.foreign('user_id', 'fk_wa_user').references('id').inTable('users').onDelete('CASCADE');
    t.foreign('hostel_id', 'fk_wa_hostel').references('id').inTable('hostels').onDelete('CASCADE');
  });

  // Backfill existing hostel-level warden assignments.
  await knex.raw(`
    INSERT INTO warden_assignments (user_id, hostel_id, scope_type)
    SELECT user_id, hostel_id, 'hostel'
      FROM hostel_wardens
  `);
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('warden_assignments');
};
