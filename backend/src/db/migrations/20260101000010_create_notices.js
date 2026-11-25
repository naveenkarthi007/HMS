const { tableDefaults, timestamps } = require('../helpers');

exports.up = (knex) =>
  knex.schema.createTable('notices', (t) => {
    tableDefaults(t);
    t.bigIncrements('id');
    t.bigInteger('organisation_id').unsigned().notNullable();
    t.bigInteger('hostel_id').unsigned().nullable();
    t.enu('audience_gender', ['all', 'male', 'female']).notNullable().defaultTo('all');
    t.string('title', 150).notNullable();
    t.text('body').notNullable();
    t.boolean('is_pinned').notNullable().defaultTo(false);
    t.bigInteger('published_by').unsigned().nullable();
    // DATETIME (not TIMESTAMP): admins may pick expiry dates beyond 2038.
    t.datetime('expires_at').nullable();
    timestamps(knex, t);

    t.index(['organisation_id', 'is_pinned'], 'idx_notices_org_pinned');
    t.index(['hostel_id'], 'idx_notices_hostel');
    t.index(['published_by'], 'idx_notices_published_by');
    t.foreign('organisation_id', 'fk_notices_organisation')
      .references('id')
      .inTable('organisations')
      .onDelete('CASCADE');
    t.foreign('hostel_id', 'fk_notices_hostel').references('id').inTable('hostels').onDelete('CASCADE');
    t.foreign('published_by', 'fk_notices_published_by').references('id').inTable('users').onDelete('SET NULL');
  });

exports.down = (knex) => knex.schema.dropTableIfExists('notices');
