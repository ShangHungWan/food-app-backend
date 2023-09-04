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
  db.any("SELECT u.id, u.name, a.url as image_url from users as u \
  JOIN images as a on u.image_id = a.id \
  WHERE u.id IN ( \
    SELECT friend_id FROM users_friends WHERE user_id = $1 \
  )", req.params.userId)
    .then(function (data) {
      res.send(data);
    })
    .catch(function (error) {
      res.status(400).send({
        message: error.message,
      });
    });
});

router.get("/user/:userId/posts", function (req, res, next) {
  db.any("SELECT \
    p.id, \
    p.user_id, \
    p.restaurant, \
    p.content, \
    count(posts_likes.user_id)::int as likes_count, \
    CASE WHEN pl.user_id IS NOT NULL THEN true ELSE false END as user_likes_post, \
    p.created_at, \
    p.updated_at \
    FROM posts as p \
    LEFT JOIN posts_likes ON p.id = posts_likes.post_id \
    LEFT JOIN posts_likes as pl ON p.id = pl.post_id AND pl.user_id = $2 \
    WHERE p.user_id = $1 \
    GROUP BY p.id, pl.user_id",
    [
      req.params.userId,
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

router.post("/user/:userId/friend-request", isAuthenticated, async function (req, res, next) {
  if (req.session.user === req.params.userId) {
    return res.status(404).send({
      message: 'Can\'t send request to yourself.',
    });
  }

  const existFriend = await db.oneOrNone("SELECT * FROM users_friends WHERE user_id = $1 AND friend_id = $2", [
    req.session.user,
    req.params.userId,
  ])
    .catch(function (error) {
      res.status(400).send({
        message: error.message,
      });
    });

  if (existFriend) {
    return res.status(400).send({
      message: 'Already friends.',
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

  db.none("INSERT INTO friends_requests (${this:name}) VALUES(${this:csv});", {
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

router.get("/friends-requests", isAuthenticated, function (req, res, next) {
  db.any("SELECT \
    fr.id, \
    fr.sender_id, \
    u.name, \
    img.url AS image_url, \
    fr.created_at \
    FROM friends_requests as fr \
    JOIN users as u on u.id = sender_id \
    JOIN images as img on u.image_id = img.id \
    WHERE receiver_id = $1 AND status = $2",
    [
      req.session.user,
      FRIENDS_REQUEST_STATUS.PENDING,
    ])
    .then(function (data) {
      res.send(data);
    })
    .catch(function (error) {
      res.status(400).send({
        message: error.message,
      });
    });
});

router.put("/friends-request/:friendRequestId/accept", isAuthenticated, async function (req, res, next) {
  const request = await db.oneOrNone("SELECT * FROM friends_requests WHERE receiver_id = $1 AND status = $2 AND id = $3",
    [
      req.session.user,
      FRIENDS_REQUEST_STATUS.PENDING,
      req.params.friendRequestId,
    ])
    .then(function (data) {
      return data;
    })
    .catch(function (error) {
      return null;
    });

  if (!request) {
    return res.status(404).send({
      message: 'Not found',
    });
  }

  await db.none("UPDATE friends_requests SET status=$1 WHERE id = $2",
    [
      FRIENDS_REQUEST_STATUS.ACCEPTED,
      request.id,
    ])
    .catch(function (error) {
      res.status(400).send({
        message: error.message,
      });
    });

  await db.none("INSERT INTO users_friends (user_id, friend_id) VALUES ($1, $2), ($2, $1)",
    [
      request.sender_id,
      request.receiver_id,
    ])
    .catch(function (error) {
      res.status(400).send({
        message: error.message,
      });
    });

  res.sendStatus(204);
});

router.put("/friends-request/:friendRequestId/reject", isAuthenticated, async function (req, res, next) {
  const request = await db.oneOrNone("SELECT * FROM friends_requests WHERE receiver_id = $1 AND status = $2 AND id = $3",
    [
      req.session.user,
      FRIENDS_REQUEST_STATUS.PENDING,
      req.params.friendRequestId,
    ])
    .then(function (data) {
      return data;
    })
    .catch(function (error) {
      return null;
    });

  if (!request) {
    return res.status(404).send({
      message: 'Not found',
    });
  }

  db.none("UPDATE friends_requests SET status=$1 WHERE id = $2",
    [
      FRIENDS_REQUEST_STATUS.REJECTED,
      request.id,
    ])
    .then(function (data) {
      res.sendStatus(204);
    })
    .catch(function (error) {
      res.status(400).send({
        message: error.message,
      });
    });
});

module.exports = router;
