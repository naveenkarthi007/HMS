exports.up = (knex) =>
  knex.raw(`
    CREATE OR REPLACE VIEW v_room_occupancy AS
    SELECT
      r.id                                         AS room_id,
      r.room_number                                AS room_number,
      r.floor                                      AS floor,
      r.room_type                                  AS room_type,
      r.status                                     AS room_status,
      h.id                                         AS hostel_id,
      h.name                                       AS hostel_name,
      h.organisation_id                            AS organisation_id,
      h.gender                                     AS gender,
      r.capacity                                   AS capacity,
      COUNT(a.id)                                  AS occupied,
      CAST(r.capacity AS SIGNED) - COUNT(a.id)     AS available
    FROM rooms r
    JOIN hostels h ON h.id = r.hostel_id
    LEFT JOIN allocations a ON a.room_id = r.id AND a.status = 'active'
    GROUP BY r.id, r.room_number, r.floor, r.room_type, r.status, h.id, h.name, h.organisation_id, h.gender, r.capacity
  `);

exports.down = (knex) => knex.raw('DROP VIEW IF EXISTS v_room_occupancy');
