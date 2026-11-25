const { tableDefaults, timestamps } = require('../helpers');

exports.up = (knex) =>
  knex.schema.createTable('refresh_tokens', (t) => {
    tableDefaults(t);
    t.bigIncrements('id');
    t.bigInteger('user_id').unsigned().notNullable();
    t.string('token_hash', 64).notNullable().unique('uq_refresh_tokens_hash');
    t.timestamp('expires_at').notNullable();
    t.timestamp('revoked_at').nullable();
    timestamps(knex, t);

    t.index(['user_id'], 'idx_refresh_tokens_user');
    t.foreign('user_id', 'fk_refresh_tokens_user').references('id').inTable('users').onDelete('CASCADE');
  });

exports.down = (knex) => knex.schema.dropTableIfExists('refresh_tokens');
