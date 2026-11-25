const { tableDefaults, timestamps } = require('../helpers');

exports.up = async (knex) => {
  await knex.schema.createTable('hostel_applications', (t) => {
    tableDefaults(t);
    t.bigIncrements('id');
    t.bigInteger('student_id').unsigned().notNullable();
    t.bigInteger('preferred_hostel_id').unsigned().nullable();
    t.enu('preferred_room_type', ['single', 'double', 'triple', 'quad']).nullable();
    t.string('student_note', 500).nullable();
    t.enu('status', ['pending', 'approved', 'rejected', 'cancelled']).notNullable().defaultTo('pending');
    t.bigInteger('reviewed_by').unsigned().nullable();
    t.timestamp('reviewed_at').nullable();
    t.string('review_note', 500).nullable();
    // The allocation created when the application was approved.
    t.bigInteger('allocation_id').unsigned().nullable();
    timestamps(knex, t);

    t.index(['student_id', 'status'], 'idx_hostel_applications_student_status');
    t.index(['preferred_hostel_id'], 'idx_hostel_applications_preferred_hostel');
    t.index(['reviewed_by'], 'idx_hostel_applications_reviewed_by');
    t.index(['allocation_id'], 'idx_hostel_applications_allocation');
    // RESTRICT: student_id feeds the stored generated column below (students service removes rows first).
    t.foreign('student_id', 'fk_hostel_applications_student').references('id').inTable('students').onDelete('RESTRICT');
    t.foreign('preferred_hostel_id', 'fk_hostel_applications_hostel')
      .references('id')
      .inTable('hostels')
      .onDelete('SET NULL');
    t.foreign('reviewed_by', 'fk_hostel_applications_reviewed_by')
      .references('id')
      .inTable('users')
      .onDelete('SET NULL');
    t.foreign('allocation_id', 'fk_hostel_applications_allocation')
      .references('id')
      .inTable('allocations')
      .onDelete('SET NULL');
  });

  // Only one pending application per student.
  await knex.raw(`
    ALTER TABLE hostel_applications
      ADD COLUMN pending_student_id BIGINT UNSIGNED
        GENERATED ALWAYS AS (IF(status = 'pending', student_id, NULL)) STORED,
      ADD UNIQUE KEY uq_hostel_applications_one_pending (pending_student_id)
  `);
};

exports.down = (knex) => knex.schema.dropTableIfExists('hostel_applications');
