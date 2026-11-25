const { tableDefaults, timestamps } = require('../helpers');

exports.up = async (knex) => {
  await knex.schema.createTable('leave_requests', (t) => {
    tableDefaults(t);
    t.bigIncrements('id');
    t.bigInteger('student_id').unsigned().notNullable();
    t.date('from_date').notNullable();
    t.date('to_date').notNullable();
    t.string('reason', 500).notNullable();
    t.enu('status', ['pending', 'approved', 'rejected']).notNullable().defaultTo('pending');
    t.bigInteger('reviewed_by').unsigned().nullable();
    t.timestamp('reviewed_at').nullable();
    t.string('review_note', 500).nullable();
    timestamps(knex, t);

    t.index(['student_id', 'status'], 'idx_leave_requests_student_status');
    t.index(['reviewed_by'], 'idx_leave_requests_reviewed_by');
    t.foreign('student_id', 'fk_leave_requests_student').references('id').inTable('students').onDelete('CASCADE');
    t.foreign('reviewed_by', 'fk_leave_requests_reviewed_by').references('id').inTable('users').onDelete('SET NULL');
  });

  await knex.raw('ALTER TABLE leave_requests ADD CONSTRAINT chk_leave_requests_dates CHECK (to_date >= from_date)');
};

exports.down = (knex) => knex.schema.dropTableIfExists('leave_requests');
