/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = pgm => {
    pgm.createTable('users', {
        id: 'id',
        email: { type: 'varchar(255)', notNull: true, unique: true, index: true },
        password: { type: 'varchar(255)', notNull: true },
        name: { type: 'varchar(255)', notNull: true, index: true },
        phone: { type: 'char(10)', notNull: true, index: true },
        birthday: { type: 'date', notNull: false, index: true },
        address: { type: 'varchar(255)', notNull: false, index: true },
        gender: { type: 'varchar(10)', notNull: false, index: true },
        image_id: {
            type: 'integer',
            notNull: true,
            references: 'images(id)',
            onDelete: 'cascade',
            index: true,
        },
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
    pgm.dropTable('users');
};
