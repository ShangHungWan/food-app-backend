/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = pgm => {
    pgm.createTable('friends_requests', {
        id: 'id',
        sender_id: {
            type: 'integer',
            notNull: true,
            references: 'users(id)',
            onDelete: 'cascade',
            index: true,
        },
        receiver_id: {
            type: 'integer',
            notNull: true,
            references: 'users(id)',
            onDelete: 'cascade',
            index: true,
        },
        status: { type: 'varchar(20)', notNull: true, index: true },
        created_at: {
            type: 'timestamp',
            notNull: true,
            default: pgm.func('current_timestamp')
        },
    });
};

exports.down = pgm => {
    pgm.dropTable('friends_requests');
};
