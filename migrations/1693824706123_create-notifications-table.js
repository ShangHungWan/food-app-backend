/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = pgm => {
    pgm.createTable('notifications', {
        id: 'id',
        user_id: {
            type: 'integer',
            notNull: true,
            references: 'users(id)',
            onDelete: 'cascade',
            index: true,
        },
        notifiable_type: {
            type: 'varchar(255)',
            notNull: true,
            index: true,
        },
        notifiable_id: {
            type: 'integer',
            notNull: true,
            index: true,
        },
        message: {
            type: 'text',
            notNull: true,
        },
        read_at: {
            type: 'timestamp',
            notNull: false,
            default: null,
        },
        created_at: {
            type: 'timestamp',
            notNull: true,
            default: pgm.func('current_timestamp'),
        },
        updated_at: {
            type: 'timestamp',
            notNull: true,
            default: pgm.func('current_timestamp'),
        },
    });
};

exports.down = pgm => {
    pgm.dropTable('notifications');
};
