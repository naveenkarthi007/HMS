const { tableDefaults, timestamps } = require('../helpers');

exports.up = (knex) =>
  knex.schema.createTable('audit_logs', (t) => {
    tableDefaults(t);
    t.bigIncrements('id');
    t.bigInteger('organisation_id').unsigned().nullable();
    t.bigInteger('user_id').unsigned().nullable();
    t.string('action', 60).notNullable();
    t.string('entity', 60).notNullable();
    t.bigInteger('entity_id').unsigned().nullable();
    t.json('meta').nullable();
    timestamps(knex, t);

    t.index(['organisation_id', 'created_at'], 'idx_audit_logs_org_created');
    t.index(['user_id'], 'idx_audit_logs_user');
    t.index(['entity', 'entity_id'], 'idx_audit_logs_entity');
    // Audit history outlives the actors: keep rows, drop the link.
    t.foreign('organisation_id', 'fk_audit_logs_organisation')
      .references('id')
      .inTable('organisations')
      .onDelete('SET NULL');
    t.foreign('user_id', 'fk_audit_logs_user').references('id').inTable('users').onDelete('SET NULL');
  });

exports.down = (knex) => knex.schema.dropTableIfExists('audit_logs');
