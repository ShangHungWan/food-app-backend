/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = pgm => {
    pgm.createTable('posts', {
        id: 'id',
        user_id: {
            type: 'integer',
            notNull: true,
            references: 'users(id)',
            onDelete: 'cascade',
            index: true,
        },
        restaurant: { type: 'varchar(255)', notNull: true, index: true },
        content: { type: 'text', notNull: true },
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
    pgm.dropTable('posts');
};
