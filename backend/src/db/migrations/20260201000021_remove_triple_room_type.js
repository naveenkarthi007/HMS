exports.up = async (knex) => {
  await knex('rooms').where({ room_type: 'triple' }).update({ room_type: 'quad' });
  await knex('hostel_applications').where({ preferred_room_type: 'triple' }).update({ preferred_room_type: 'quad' });

  await knex.raw("ALTER TABLE rooms MODIFY COLUMN room_type ENUM('single', 'double', 'quad') NOT NULL");
  await knex.raw("ALTER TABLE hostel_applications MODIFY COLUMN preferred_room_type ENUM('single', 'double', 'quad') NULL");
};

exports.down = async (knex) => {
  await knex.raw("ALTER TABLE rooms MODIFY COLUMN room_type ENUM('single', 'double', 'triple', 'quad') NOT NULL");
  await knex.raw(
    "ALTER TABLE hostel_applications MODIFY COLUMN preferred_room_type ENUM('single', 'double', 'triple', 'quad') NULL",
  );
};
