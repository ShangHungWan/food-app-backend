/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = pgm => {
    pgm.createTable('users_friends', {
        user_id: {
            type: 'integer',
            notNull: true,
            references: 'users(id)',
            onDelete: 'cascade',
            index: true,
        },
        friend_id: {
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
    pgm.dropTable('users_friends');
};
