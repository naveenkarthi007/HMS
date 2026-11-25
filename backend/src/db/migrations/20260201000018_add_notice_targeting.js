const { tableDefaults, timestamps } = require('../helpers');

/**
 * Notices: category, optional start time and "Send To" targeting.
 * target_type: all | hostel | floor | year. Floors (0 = ground … 5) or years (1 … 5)
 * are stored one row each in notice_target_values.
 */
exports.up = async (knex) => {
  await knex.schema.alterTable('notices', (t) => {
    t.enu('category', ['general', 'maintenance', 'mess', 'event', 'academic', 'emergency'])
      .notNullable()
      .defaultTo('general')
      .after('organisation_id');
    t.enu('target_type', ['all', 'hostel', 'floor', 'year']).notNullable().defaultTo('all').after('category');
    t.datetime('starts_at').nullable().after('published_by');
    t.index(['organisation_id', 'target_type'], 'idx_notices_org_target');
  });
  await knex.raw("UPDATE notices SET target_type = 'hostel' WHERE hostel_id IS NOT NULL");

  await knex.schema.createTable('notice_target_values', (t) => {
    tableDefaults(t);
    t.bigIncrements('id');
    t.bigInteger('notice_id').unsigned().notNullable();
    t.tinyint('value').notNullable();
    timestamps(knex, t);

    t.unique(['notice_id', 'value'], 'uq_notice_target_values_notice_value');
    t.foreign('notice_id', 'fk_notice_target_values_notice').references('id').inTable('notices').onDelete('CASCADE');
  });
  await knex.raw(
    'ALTER TABLE notice_target_values ADD CONSTRAINT chk_notice_target_values_range CHECK (value BETWEEN 0 AND 5)',
  );
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('notice_target_values');
  await knex.schema.alterTable('notices', (t) => {
    t.dropIndex(['organisation_id', 'target_type'], 'idx_notices_org_target');
    t.dropColumn('category');
    t.dropColumn('target_type');
    t.dropColumn('starts_at');
  });
};
