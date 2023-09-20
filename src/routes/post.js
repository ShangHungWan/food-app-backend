var express = require("express");
var router = express.Router();
var db = require("../helpers/db");
const { body, validationResult } = require("express-validator");
const { isAuthenticated } = require("../middlewares/auth");
const { createNotification } = require("../helpers/notification");

// TODO: pagination
router.get("/posts", isAuthenticated, async function (req, res, next) {
  req.query.search = req.query.search || '';
  req.query.from_friends = (req.query.from_friends || false) === 'true';

  let sql = "SELECT \
  p.id, \
  p.user_id, \
  u.name as user_name, \
  i.url AS user_avatar_url, \
  p.restaurant, \
  p.content, \
  count(posts_likes.user_id)::int as likes_count, \
  CASE WHEN pl.user_id IS NOT NULL THEN true ELSE false END as user_likes_post, \
  p.created_at, \
  p.updated_at \
  FROM posts as p \
  LEFT JOIN users as u ON p.user_id = u.id \
  LEFT JOIN images as i ON u.image_id = i.id \
  LEFT JOIN posts_likes ON p.id = posts_likes.post_id \
  LEFT JOIN posts_likes as pl ON p.id = pl.post_id AND pl.user_id = $2 \
  WHERE (p.restaurant LIKE $1 OR p.content LIKE $1) AND p.user_id != $2 \
  GROUP BY p.id, u.name, i.url, pl.user_id ";

  if (req.query.from_friends) {
    sql += "HAVING p.user_id IN (SELECT friend_id FROM users_friends WHERE user_id = $2) ";
  } else {
    sql += "HAVING p.user_id NOT IN (SELECT friend_id FROM users_friends WHERE user_id = $2) ";
  }

  sql += "ORDER BY p.created_at DESC";

  const result = await db.any(sql,
    [
      `%${req.query.search}%`,
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
    return res.status(400).send({ message: result.message });
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

router.get("/post/:postId", isAuthenticated, async function (req, res, next) {
  let post = await db.oneOrNone("SELECT \
      p.id, \
      p.user_id, \
      u.name as user_name, \
      i.url AS user_avatar_url, \
      p.restaurant, \
      p.content, \
      count(posts_likes.user_id)::int as likes_count, \
      CASE WHEN pl.user_id IS NOT NULL THEN true ELSE false END as user_likes_post, \
      p.created_at, \
      p.updated_at \
      FROM posts as p \
      LEFT JOIN posts_likes ON p.id = posts_likes.post_id \
      LEFT JOIN posts_likes as pl ON p.id = pl.post_id AND pl.user_id = $2 \
      LEFT JOIN users as u ON p.user_id = u.id \
      LEFT JOIN images as i ON u.image_id = i.id \
      WHERE p.id = $1 \
      GROUP BY p.id, u.name, i.url, pl.user_id",
    [
      req.params.postId,
      req.session.user,
    ]
  )
    .then(function (data) {
      return data;
    })
    .catch(function (error) {
      res.status(400).send({ message: error.message });
    });

  if (!post) {
    return res.status(404).send({ message: 'Not found.' });
  }

  const images = await db.any("SELECT \
      images.id, \
      images.url \
      FROM posts_images \
      JOIN images ON posts_images.image_id = images.id \
      WHERE posts_images.post_id = $1",
    req.params.postId,
  );

  post.images = images;
  res.send(post);
});

router.post(
  "/post",
  [
    body("restaurant").notEmpty().trim().escape().isLength({ min: 1, max: 255 }),
    body("content").notEmpty().trim().escape().isLength({ min: 1, max: 1000 }),
    body("image_ids.*").notEmpty().isInt(),
  ],
  isAuthenticated,
  async function (req, res, next) {
    const validation = validationResult(req);
    if (!validation.isEmpty()) {
      return res.status(400).send({ message: 'Validation failed.' });
    }

    if (req.body.image_ids === undefined || !Array.isArray(req.body.image_ids)) {
      return res.status(400).send({ message: 'image_ids must be array' });
    }

    const error = await db.none('INSERT INTO posts (${this:name}) VALUES(${this:csv});', {
      user_id: req.session.user,
      restaurant: req.body.restaurant,
      content: req.body.content,
    })
      .catch(function (error) {
        return error;
      });
    if (error) {
      return res
        .status(400)
        .send({
          message: error.message,
        });
    }
    const result = await db.oneOrNone('SELECT id from posts order by id desc limit 1;')

    for (image_id of req.body.image_ids) {
      const error = await db.none('INSERT INTO posts_images (post_id, image_id) VALUES ($1, $2);', [
        result.id,
        image_id,
      ])
        .catch(function (error) {
          return error;
        });

      if (error) {
        return res
          .status(400)
          .send({
            message: error.message,
          });
      }
    }

    // send notification to friends
    const friends = await db.any("SELECT \
        friend_id, \
        users.name as friend_name \
        FROM users_friends \
        JOIN users ON users_friends.user_id = users.id \
        WHERE user_id = $1",
      req.session.user);
    for (friend of friends) {
      createNotification(friend.friend_id, 'post', result.id, `${friend.friend_name} publish a new post.`);
    }

    res.send(result);
  });

router.patch(
  "/post/:postId",
  [
    body("restaurant").optional().trim().escape().isLength({ min: 1, max: 255 }),
    body("content").optional().trim().escape().isLength({ min: 1, max: 1000 }),
  ],
  isAuthenticated,
  async function (req, res, next) {
    const validation = validationResult(req);
    if (!validation.isEmpty()) {
      return res.status(400).send({ message: 'Validation failed.' });
    }

    const post = await db.oneOrNone("SELECT * FROM posts WHERE id = $1", req.params.postId);
    if (!post) {
      return res.status(404).send({ message: 'Not found.' });
    }
    if (post.user_id !== req.session.user) {
      return res.status(403).send({ message: 'Forbidden.' });
    }

    const restaurant = req.body.restaurant || post.restaurant;
    const content = req.body.content || post.content;

    db.none("UPDATE posts SET restaurant=$1, content=$2 WHERE id = $3", [
      restaurant,
      content,
      req.params.postId,
    ])
      .then(function () {
        res.sendStatus(204);
      })
      .catch(function (error) {
        res
          .status(400)
          .send({
            message: error.message,
          });
      });
  });

router.post(
  "/post/:postId/image",
  [
    body("image_ids.*").notEmpty().isInt(),
  ],
  isAuthenticated,
  async function (req, res, next) {
    const validation = validationResult(req);
    if (!validation.isEmpty()) {
      return res.status(400).send({ message: 'Validation failed.' });
    }

    const post = await db.oneOrNone("SELECT * FROM posts WHERE id = $1", req.params.postId);
    if (!post) {
      return res.status(404).send({ message: 'Not found.' });
    }
    if (post.user_id !== req.session.user) {
      return res.status(403).send({ message: 'Forbidden.' });
    }

    for (image_id of req.body.image_ids) {
      await db.none('INSERT INTO posts_images (post_id, image_id) VALUES ($1, $2);', [
        post.id,
        image_id,
      ])
        .catch(function (error) {
          res
            .status(400)
            .send({
              message: error.message,
            });
        });
    }

    res.sendStatus(204);
  });

router.delete("/post/:postId/image/:imageId", isAuthenticated, async function (req, res, next) {
  const post = await db.oneOrNone("SELECT * FROM posts WHERE id = $1", req.params.postId);
  if (!post) {
    return res.status(404).send({ message: 'Not found.' });
  }
  if (post.user_id !== req.session.user) {
    return res.status(403).send({ message: 'Forbidden.' });
  }

  db.none("DELETE FROM posts_images WHERE post_id = $1 AND image_id = $2",
    [
      req.params.postId,
      req.params.imageId,
    ])
    .then(function () {
      res.sendStatus(204);
    })
    .catch(function (error) {
      res
        .status(400)
        .send({
          message: error.message,
        });
    });
});

router.delete("/post/:postId", isAuthenticated, async function (req, res, next) {
  const post = await db.oneOrNone("SELECT * FROM posts WHERE id = $1", req.params.postId);
  if (!post) {
    return res.status(404).send({ message: 'Not found.' });
  }
  if (post.user_id !== req.session.user) {
    return res.status(403).send({ message: 'Forbidden.' });
  }

  db.none("DELETE FROM posts WHERE id = $1", req.params.postId)
    .then(function () {
      res.sendStatus(204);
    })
    .catch(function (error) {
      res
        .status(400)
        .send({
          message: error.message,
        });
    });
});

router.put("/post/:postId/like", isAuthenticated, async function (req, res, next) {
  const post = await db.oneOrNone("SELECT * FROM posts WHERE id = $1", req.params.postId);
  if (!post) {
    return res.status(404).send({ message: 'Not found.' });
  }
  const like = await db.oneOrNone("SELECT * FROM posts_likes WHERE post_id = $1 AND user_id = $2", [
    req.params.postId,
    req.session.user,
  ]);
  if (like) {
    return res.status(400).send({ message: 'Already liked.' });
  }

  // send notification to friend
  if (post.user_id !== req.session.user) {
    const me = await db.one("SELECT * from users WHERE id = $1", req.session.user);
    createNotification(post.user_id, 'post', post.id, `${me.name} like your post.`);
  }

  db.none("INSERT INTO posts_likes (post_id, user_id) VALUES ($1, $2)", [
    req.params.postId,
    req.session.user,
  ])
    .then(function () {
      res.sendStatus(204);
    })
    .catch(function (error) {
      res
        .status(400)
        .send({
          message: error.message,
        });
    });
});

router.put("/post/:postId/unlike", isAuthenticated, async function (req, res, next) {
  const post = await db.oneOrNone("SELECT * FROM posts WHERE id = $1", req.params.postId);
  if (!post) {
    return res.status(404).send({ message: 'Not found.' });
  }
  const like = await db.oneOrNone("SELECT * FROM posts_likes WHERE post_id = $1 AND user_id = $2", [
    req.params.postId,
    req.session.user,
  ]);
  if (!like) {
    return res.status(400).send({ message: 'Not like yet.' });
  }

  db.none("DELETE FROM posts_likes WHERE post_id = $1 AND user_id = $2", [
    req.params.postId,
    req.session.user,
  ])
    .then(function () {
      res.sendStatus(204);
    })
    .catch(function (error) {
      res
        .status(400)
        .send({
          message: error.message,
        });
    });
});

module.exports = router;
