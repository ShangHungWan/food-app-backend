/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = pgm => {
    pgm.createTable('regions', {
        id: 'id',
        name: { type: 'varchar(255)', notNull: true, index: true, unique: true },
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
    pgm.dropTable('regions');
};
