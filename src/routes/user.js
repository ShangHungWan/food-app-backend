var express = require("express");
var router = express.Router();
var db = require("../helpers/db");
const { body, validationResult } = require("express-validator");
const { isAuthenticated } = require("../middlewares/auth");
const { FRIENDS_REQUEST_STATUS } = require("../enums/friends_request_status");
const { hash_password, validate_password } = require("../helpers/bcrypt");
const { GENDER } = require("../enums/genders");

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
      LEFT JOIN images as a on u.image_id = a.id \
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
      LEFT JOIN images as a on u.image_id = a.id \
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
  LEFT JOIN images as a on u.image_id = a.id \
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

router.get("/user/:userId/posts", async function (req, res, next) {
  const result = await db.any("SELECT \
    p.id, \
    p.user_id, \
    p.restaurant, \
    p.content, \
    count(posts_likes.user_id)::int as likes_count, \
    CASE WHEN pl.user_id IS NOT NULL THEN true ELSE false END as user_likes_post, \
    p.created_at, \
    p.updated_at \
    FROM posts as p \
    LEFT JOIN posts_images ON p.id = posts_images.post_id \
    LEFT JOIN images ON posts_images.image_id = images.id \
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
      return data;
    })
    .catch(function (error) {
      return error;
    });

  if (result instanceof Error) {
    return res.status(400).send({
      message: result.message,
    });
  }

  for (let post of result) {
    const images = await db.any("SELECT \
        images.id, \
        images.url \
        FROM posts_images \
        JOIN images ON posts_images.image_id = images.id \
        WHERE posts_images.post_id = $1",
      post.id,
    );
    post.images = images;
  }

  res.send(result);
});

router.post("/user/:userId/friend-request", isAuthenticated, async function (req, res, next) {
  if (req.session.user == req.params.userId) {
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

router.get("/me", isAuthenticated, async function (req, res, next) {
  const result = await db.one("SELECT \
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
    LEFT JOIN images as a on u.image_id = a.id \
    where u.id = $1 \
    ", req.session.user)
    .then(function (data) {
      return data;
    })
    .catch(function (error) {
      return error;
    });

  if (result instanceof Error) {
    return res.status(400).send({
      message: result.message,
    });
  }

  result.birthday = result.birthday ? result.birthday.toISOString().split('T')[0] : null;
  return res.send(result);
});

router.patch(
  "/me",
  [
    body("name").optional().isString().trim().escape().isLength({ min: 1, max: 16 }),
    body("phone").optional().isMobilePhone('zh-TW'),
    body("birthday").optional().isDate(),
    body("address").optional().isString().trim().escape().isLength({ min: 1, max: 255 }),
    body("gender").optional().isIn(GENDER),
    body("image_id").optional().isInt(),
    body("password").notEmpty().isString().trim().custom(async function (value, { req, loc, path }) {
      const result = await db.oneOrNone('SELECT * FROM users WHERE id = $1', req.session.user);
      if (!validate_password(value, result.password)) {
        throw new Error("Passwords don't match");
      } else {
        return value;
      }
    }),
    body("new_password").optional().isString().trim().escape().isLength({ min: 8, max: 16 }).custom((value, { req, loc, path }) => {
      if (value !== req.body.new_confirm_password) {
        throw new Error("Passwords don't match");
      } else {
        return value;
      }
    }),
  ],
  isAuthenticated,
  async function (req, res, next) {
    const validation = validationResult(req);
    if (!validation.isEmpty()) {
      console.log(validation.errors)
      return res.status(400).send({ message: 'Validation failed.' });
    }

    const result = await db.oneOrNone('SELECT * FROM users WHERE id = $1', req.session.user);

    const name = req.body.name || result.name;
    const phone = req.body.phone || result.phone;
    const birthday = req.body.birthday || result.birthday;
    const address = req.body.address || result.address;
    const gender = req.body.gender || result.gender;
    const image_id = req.body.image_id || result.image_id;
    const password = await hash_password(req.body.new_password || req.body.password);

    db.none("UPDATE users SET name=$1, phone=$2, birthday=$3, address=$4, gender=$5, image_id=$6, password=$7 WHERE id = $8",
      [
        name,
        phone,
        birthday,
        address,
        gender,
        image_id,
        password,
        req.session.user,
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

router.put(
  "/me/position",
  [
    body("latitude").notEmpty().isFloat(),
    body("longitude").notEmpty().isFloat(),
  ],
  isAuthenticated,
  async function (req, res, next) {
    const validation = validationResult(req);
    if (!validation.isEmpty()) {
      return res.status(400).send({ message: 'Validation failed.' });
    }
    if (req.body.latitude < -90 || req.body.latitude > 90) {
      return res.status(400).send({ message: 'Latitude must be between -90 and 90.' });
    }
    if (req.body.longitude < -180 || req.body.longitude > 180) {
      return res.status(400).send({ message: 'Longitude must be between -180 and 180.' });
    }

    const result = await db.one('SELECT * FROM users WHERE id = $1', req.session.user);

    db.none("UPDATE users SET last_position=POINT($1, $2), updated_at=NOW() WHERE id = $3",
      [
        req.body.latitude,
        req.body.longitude,
        req.session.user,
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

router.get(
  "/me/online-friend-positions",
  isAuthenticated,
  async function (req, res, next) {
    db.any("SELECT \
      u.id, \
      u.name, \
      u.last_position[0] as latitude, \
      u.last_position[1] as longitude, \
      a.url AS image_url, \
      u.updated_at \
      FROM users AS u \
      LEFT JOIN images as a on u.image_id = a.id \
      WHERE u.id IN ( \
        SELECT friend_id FROM users_friends WHERE user_id = $1 \
        ) \
        AND u.last_position IS NOT NULL \
        AND u.updated_at > NOW() - INTERVAL '3 minute'",
      req.session.user,
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

router.get("/friends-requests", isAuthenticated, function (req, res, next) {
  db.any("SELECT \
    fr.id, \
    fr.sender_id, \
    u.name, \
    img.url AS image_url, \
    fr.created_at \
    FROM friends_requests as fr \
    JOIN users as u on u.id = sender_id \
    LEFT JOIN images as img on u.image_id = img.id \
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
