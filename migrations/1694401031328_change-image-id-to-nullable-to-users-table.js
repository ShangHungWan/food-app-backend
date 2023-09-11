/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = pgm => {
    pgm.alterColumn('users', 'image_id', {
        notNull: false,
    });
};

exports.down = pgm => {
    pgm.alterColumn('users', 'image_id', {
        notNull: true,
    });
};
