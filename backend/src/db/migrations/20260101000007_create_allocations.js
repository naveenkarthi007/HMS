const { tableDefaults, timestamps } = require('../helpers');

exports.up = async (knex) => {
  await knex.schema.createTable('allocations', (t) => {
    tableDefaults(t);
    t.bigIncrements('id');
    t.bigInteger('student_id').unsigned().notNullable();
    t.bigInteger('room_id').unsigned().notNullable();
    t.bigInteger('allocated_by').unsigned().nullable();
    t.date('start_date').notNullable();
    t.date('end_date').nullable();
    t.enu('status', ['active', 'vacated']).notNullable().defaultTo('active');
    timestamps(knex, t);

    t.index(['student_id'], 'idx_allocations_student');
    t.index(['room_id', 'status'], 'idx_allocations_room_status');
    t.index(['allocated_by'], 'idx_allocations_allocated_by');
    // History must be removed explicitly (students service does this inside a transaction).
    // RESTRICT is also required by MySQL because student_id feeds a stored generated column.
    t.foreign('student_id', 'fk_allocations_student').references('id').inTable('students').onDelete('RESTRICT');
    t.foreign('room_id', 'fk_allocations_room').references('id').inTable('rooms').onDelete('RESTRICT');
    t.foreign('allocated_by', 'fk_allocations_allocated_by').references('id').inTable('users').onDelete('SET NULL');
  });

  // Exactly one active allocation per student: the generated column is NULL for vacated rows,
  // and a UNIQUE index ignores NULLs.
  await knex.raw(`
    ALTER TABLE allocations
      ADD COLUMN active_student_id BIGINT UNSIGNED
        GENERATED ALWAYS AS (IF(status = 'active', student_id, NULL)) STORED,
      ADD UNIQUE KEY uq_allocations_one_active_per_student (active_student_id),
      ADD CONSTRAINT chk_allocations_dates CHECK (end_date IS NULL OR end_date >= start_date),
      ADD CONSTRAINT chk_allocations_status_end
        CHECK ((status = 'active' AND end_date IS NULL) OR (status = 'vacated' AND end_date IS NOT NULL))
  `);
};

exports.down = (knex) => knex.schema.dropTableIfExists('allocations');
