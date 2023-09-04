/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = pgm => {
    pgm.createTable('posts_likes', {
        post_id: {
            type: 'integer',
            notNull: true,
            references: 'posts(id)',
            onDelete: 'cascade',
            index: true,
        },
        user_id: {
            type: 'integer',
            notNull: true,
            references: 'users(id)',
            onDelete: 'cascade',
            index: true,
        },
        created_at: {
            type: 'timestamp',
            notNull: true,
            default: pgm.func('current_timestamp')
        },
    });
};

exports.down = pgm => {
    pgm.dropTable('posts_likes');
};
