/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = pgm => {
    pgm.createTable('resturants', {
        id: 'id',
        region_id: {
            type: 'integer',
            notNull: true,
            references: 'regions(id)',
            onDelete: 'cascade',
            index: true,
        },
        image_id: {
            type: 'integer',
            notNull: true,
            references: 'images(id)',
            onDelete: 'cascade',
            index: true,
        },
        name: { type: 'varchar(255)', notNull: true, index: true },
        address: { type: 'varchar(255)', notNull: true, index: true },
        phone: { type: 'varchar(255)', notNull: true, index: true },
        url: { type: 'varchar(255)', notNull: true, index: true },
        business_hours: { type: 'text', notNull: true },
        created_at: {
            type: 'timestamp',
            notNull: true,
            default: pgm.func('current_timestamp')
        },
        updated_at: {
            type: 'timestamp',
            notNull: true,
            default: pgm.func('current_timestamp')
        },
    });
};

exports.down = pgm => {
    pgm.dropTable('resturants');
};
