/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = pgm => {
    pgm.addColumns('users', {
        last_position: { type: 'point', notNull: false, default: null },
    });
};

exports.down = pgm => {
    pgm.dropColumns('users', ['last_position']);
};
