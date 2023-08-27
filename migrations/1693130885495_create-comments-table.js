/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = pgm => {
    pgm.createTable('comments', {
        id: 'id',
        user_id: {
            type: 'integer',
            notNull: true,
            references: 'users(id)',
            onDelete: 'cascade',
            index: true,
        },
        resturant_id: {
            type: 'integer',
            notNull: true,
            references: 'resturants(id)',
            onDelete: 'cascade',
            index: true,
        },
        image_id: {
            type: 'integer',
            notNull: false,
            references: 'images(id)',
            onDelete: 'cascade',
            index: true,
        },
        score: { type: 'integer', notNull: true, index: true },
        comment: { type: 'text', notNull: true },
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
    pgm.dropTable('comments');
};
