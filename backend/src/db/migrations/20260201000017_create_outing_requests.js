const { tableDefaults, timestamps } = require('../helpers');

exports.up = async (knex) => {
  await knex.schema.createTable('outing_requests', (t) => {
    tableDefaults(t);
    t.bigIncrements('id');
    t.bigInteger('student_id').unsigned().notNullable();
    // The hostel the student lived in when asking (an event record, like complaints.hostel_id).
    t.bigInteger('hostel_id').unsigned().notNullable();
    t.string('destination', 150).notNullable();
    t.string('reason', 500).notNullable();
    t.datetime('out_at').notNullable();
    t.datetime('expected_return_at').notNullable();
    t.enu('status', ['pending', 'approved', 'rejected', 'cancelled', 'out', 'returned'])
      .notNullable()
      .defaultTo('pending');
    t.bigInteger('reviewed_by').unsigned().nullable();
    t.timestamp('reviewed_at').nullable();
    t.string('review_note', 500).nullable();
    t.datetime('checked_out_at').nullable();
    t.datetime('returned_at').nullable();
    timestamps(knex, t);

    t.index(['student_id', 'status'], 'idx_outing_requests_student_status');
    t.index(['hostel_id', 'status'], 'idx_outing_requests_hostel_status');
    t.index(['reviewed_by'], 'idx_outing_requests_reviewed_by');
    t.foreign('student_id', 'fk_outing_requests_student').references('id').inTable('students').onDelete('CASCADE');
    t.foreign('hostel_id', 'fk_outing_requests_hostel').references('id').inTable('hostels').onDelete('RESTRICT');
    t.foreign('reviewed_by', 'fk_outing_requests_reviewed_by').references('id').inTable('users').onDelete('SET NULL');
  });

  await knex.raw(
    'ALTER TABLE outing_requests ADD CONSTRAINT chk_outing_requests_times CHECK (expected_return_at > out_at)',
  );
};

exports.down = (knex) => knex.schema.dropTableIfExists('outing_requests');
