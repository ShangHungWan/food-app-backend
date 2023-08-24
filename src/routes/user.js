var express = require("express");
var router = express.Router();
var db = require("../db");
const { isAuthenticated } = require("../middlewares/auth");

// TODO: pagination
router.get("/users", isAuthenticated, function (req, res, next) {
  req.query.search = req.query.search || '';
  db.any("SELECT \
        u.id, \
        email, \
        name, \
        a.url AS avatar_url, \
        u.created_at, \
        u.updated_at, \
        CASE WHEN EXISTS ( \
          SELECT 1 FROM users_friends WHERE user_id = $2 AND u.id = friend_id \
        ) THEN TRUE ELSE FALSE END AS is_friends \
      FROM users AS u \
      JOIN avatars as a on u.avatar_id = a.id \
      WHERE email LIKE $1 OR name LIKE $1 OR phone LIKE $1",
    [
      `%${req.query.search}%`,
      req.session.user,
    ],
  )
    .then(function (data) {
      res.send(data);
    })
    .catch(function (error) {
      res.status(400).send({
        status: "error",
        message: error.message,
      });
    });
});

router.get("/user/:userId", function (req, res, next) {
  db.oneOrNone("SELECT \
        u.id, \
        email, \
        name, \
        a.url AS avatar_url, \
        u.created_at, \
        u.updated_at, \
        CASE WHEN EXISTS ( \
          SELECT 1 FROM users_friends WHERE user_id = $2 AND u.id = friend_id \
        ) THEN TRUE ELSE FALSE END AS is_friends \
      FROM users AS u \
      JOIN avatars as a on u.avatar_id = a.id \
      WHERE u.id = $1", [req.params.userId, req.session.user])
    .then(function (data) {
      if (!data) {
        return res.status(404).send({
          status: "error",
          message: 'user not found',
        });
      }

      res.send(data);
    })
    .catch(function (error) {
      res.status(400).send({
        status: "error",
        message: error.message,
      });
    });
});

router.get("/user/:userId/friends", function (req, res, next) {
  db.oneOrNone("SELECT id, name, avatar_url from users WHERE id IN ( \
    SELECT friend_id FROM users_friends WHERE user_id = $1 \
  )", req.params.userId)
    .then(function (data) {
      if (!data) {
        return res.status(404).send({
          status: "error",
          message: 'user not found',
        });
      }

      res.send(data);
    })
    .catch(function (error) {
      res.status(400).send({
        status: "error",
        message: error.message,
      });
    });
});

router.get("/user/:userId/posts", function (req, res, next) {
  // TODO
});

router.get("/me", isAuthenticated, function (req, res, next) {
  db.one("SELECT \
    u.id, \
    email, \
    name, \
    phone, \
    birthday, \
    address, \
    gender, \
    a.url AS avatar_url, \
    u.created_at, \
    u.updated_at \
    from users as u \
    JOIN avatars as a on u.avatar_id = a.id \
    where u.id = $1 \
    ", req.session.user)
    .then(function (data) {
      res.send(data);
    })
    .catch(function (error) {
      res.status(400).send({
        status: "error",
        message: error.message,
      });
    });
});

module.exports = router;
