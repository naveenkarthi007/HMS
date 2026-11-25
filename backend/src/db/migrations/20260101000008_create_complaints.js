const { tableDefaults, timestamps } = require('../helpers');

exports.up = (knex) =>
  knex.schema.createTable('complaints', (t) => {
    tableDefaults(t);
    t.bigIncrements('id');
    t.bigInteger('student_id').unsigned().notNullable();
    t.bigInteger('hostel_id').unsigned().notNullable();
    t.enu('category', ['electrical', 'plumbing', 'cleaning', 'furniture', 'internet', 'mess', 'other']).notNullable();
    t.string('title', 150).notNullable();
    t.text('description').notNullable();
    t.enu('priority', ['low', 'medium', 'high']).notNullable().defaultTo('medium');
    t.enu('status', ['open', 'in_progress', 'resolved', 'closed']).notNullable().defaultTo('open');
    t.bigInteger('assigned_to').unsigned().nullable();
    t.timestamp('resolved_at').nullable();
    timestamps(knex, t);

    t.index(['student_id'], 'idx_complaints_student');
    t.index(['hostel_id', 'status'], 'idx_complaints_hostel_status');
    t.index(['assigned_to'], 'idx_complaints_assigned_to');
    t.foreign('student_id', 'fk_complaints_student').references('id').inTable('students').onDelete('CASCADE');
    t.foreign('hostel_id', 'fk_complaints_hostel').references('id').inTable('hostels').onDelete('RESTRICT');
    t.foreign('assigned_to', 'fk_complaints_assigned_to').references('id').inTable('users').onDelete('SET NULL');
  });

exports.down = (knex) => knex.schema.dropTableIfExists('complaints');
