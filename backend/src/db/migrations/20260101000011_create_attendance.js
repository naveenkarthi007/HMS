const { tableDefaults, timestamps } = require('../helpers');

exports.up = (knex) =>
  knex.schema.createTable('attendance', (t) => {
    tableDefaults(t);
    t.bigIncrements('id');
    t.bigInteger('student_id').unsigned().notNullable();
    t.bigInteger('hostel_id').unsigned().notNullable();
    t.date('date').notNullable();
    t.enu('status', ['present', 'absent', 'on_leave']).notNullable();
    t.bigInteger('marked_by').unsigned().nullable();
    timestamps(knex, t);

    t.unique(['student_id', 'date'], 'uq_attendance_student_date');
    t.index(['hostel_id', 'date'], 'idx_attendance_hostel_date');
    t.index(['marked_by'], 'idx_attendance_marked_by');
    t.foreign('student_id', 'fk_attendance_student').references('id').inTable('students').onDelete('CASCADE');
    t.foreign('hostel_id', 'fk_attendance_hostel').references('id').inTable('hostels').onDelete('RESTRICT');
    t.foreign('marked_by', 'fk_attendance_marked_by').references('id').inTable('users').onDelete('SET NULL');
  });

exports.down = (knex) => knex.schema.dropTableIfExists('attendance');
