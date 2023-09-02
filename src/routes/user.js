var express = require("express");
var router = express.Router();
var db = require("../db");
const { isAuthenticated } = require("../middlewares/auth");
const { FRIENDS_REQUEST_STATUS } = require("../enums/friends_request_status");

// TODO: pagination
router.get("/users", isAuthenticated, function (req, res, next) {
  req.query.search = req.query.search || '';
  db.any("SELECT \
        u.id, \
        email, \
        name, \
        a.url AS image_url, \
        u.created_at, \
        u.updated_at, \
        CASE WHEN EXISTS ( \
          SELECT 1 FROM users_friends WHERE user_id = $2 AND u.id = friend_id \
        ) THEN TRUE ELSE FALSE END AS is_friends \
      FROM users AS u \
      JOIN images as a on u.image_id = a.id \
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
        message: error.message,
      });
    });
});

router.get("/user/:userId", function (req, res, next) {
  db.oneOrNone("SELECT \
        u.id, \
        email, \
        name, \
        a.url AS image_url, \
        u.created_at, \
        u.updated_at, \
        CASE WHEN EXISTS ( \
          SELECT 1 FROM users_friends WHERE user_id = $2 AND u.id = friend_id \
        ) THEN TRUE ELSE FALSE END AS is_friends \
      FROM users AS u \
      JOIN images as a on u.image_id = a.id \
      WHERE u.id = $1", [req.params.userId, req.session.user])
    .then(function (data) {
      if (!data) {
        return res.status(404).send({
          message: 'Not found',
        });
      }

      res.send(data);
    })
    .catch(function (error) {
      res.status(400).send({
        message: error.message,
      });
    });
});

router.get("/user/:userId/friends", function (req, res, next) {
  db.oneOrNone("SELECT id, name, image_url from users WHERE id IN ( \
    SELECT friend_id FROM users_friends WHERE user_id = $1 \
  )", req.params.userId)
    .then(function (data) {
      if (!data) {
        return res.status(404).send({
          message: 'Not found',
        });
      }

      res.send(data);
    })
    .catch(function (error) {
      res.status(400).send({
        message: error.message,
      });
    });
});

router.post("/user/:userId/friend-request", isAuthenticated, async function (req, res, next) {
  if (req.session.user === req.params.userId) {
    return res.status(404).send({
      message: 'Can\'t send request to yourself.',
    });
  }

  const existPendingRequest = await db.oneOrNone("SELECT * FROM friends_requests WHERE sender_id = $1 AND receiver_id = $2 AND status = $3", [
    req.session.user,
    req.params.userId,
    FRIENDS_REQUEST_STATUS.PENDING,
  ])
    .catch(function (error) {
      res.status(400).send({
        message: error.message,
      });
    });

  if (existPendingRequest) {
    return res.status(400).send({
      message: 'Already sent request.',
    });
  }

  db.oneOrNone("INSERT INTO friends_requests (${this:name}) VALUES(${this:csv});", {
    sender_id: req.session.user,
    receiver_id: req.params.userId,
    status: FRIENDS_REQUEST_STATUS.PENDING,
  })
    .then(function (data) {
      res.sendStatus(204);
    })
    .catch(function (error) {
      res.status(400).send({
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
    a.url AS image_url, \
    u.created_at, \
    u.updated_at \
    from users as u \
    JOIN images as a on u.image_id = a.id \
    where u.id = $1 \
    ", req.session.user)
    .then(function (data) {
      res.send(data);
    })
    .catch(function (error) {
      res.status(400).send({
        message: error.message,
      });
    });
});

module.exports = router;
