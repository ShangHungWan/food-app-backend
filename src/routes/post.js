var express = require("express");
var router = express.Router();
var db = require("../helpers/db");
const { body, validationResult } = require("express-validator");
const { isAuthenticated } = require("../middlewares/auth");

// TODO: pagination
router.get("/posts", isAuthenticated, function (req, res, next) {
  req.query.search = req.query.search || '';
  req.query.from_friends = (req.query.from_friends || false) === 'true';

  let sql = "SELECT \
  p.id, \
  p.user_id, \
  u.name as user_name, \
  i.url AS user_avatar_url, \
  p.restaurant, \
  p.content, \
  array_agg(images.url) as image_urls, \
  count(posts_likes.user_id)::int as likes_count, \
  CASE WHEN pl.user_id IS NOT NULL THEN true ELSE false END as user_likes_post, \
  p.created_at, \
  p.updated_at \
  FROM posts as p \
  LEFT JOIN posts_images ON p.id = posts_images.post_id \
  LEFT JOIN images ON posts_images.image_id = images.id \
  LEFT JOIN users as u ON p.user_id = u.id \
  LEFT JOIN images as i ON u.image_id = i.id \
  LEFT JOIN posts_likes ON p.id = posts_likes.post_id \
  LEFT JOIN posts_likes as pl ON p.id = pl.post_id AND pl.user_id = $2 \
  WHERE p.restaurant LIKE $1 OR p.content LIKE $1 \
  GROUP BY p.id, u.name, i.url, pl.user_id";

  if (req.query.from_friends) {
    sql += " HAVING p.user_id IN (SELECT friend_id FROM users_friends WHERE user_id = $2)";
  }

  db.any(sql,
    [
      `%${req.query.search}%`,
      req.session.user,
    ],
  )
    .then(function (data) {
      res.send(data);
    })
    .catch(function (error) {
      res.status(400).send({ message: error.message });
    });
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

    await db.none('INSERT INTO posts (${this:name}) VALUES(${this:csv});', {
      user_id: req.session.user,
      restaurant: req.body.restaurant,
      content: req.body.content,
    })
      .catch(function (error) {
        res
          .status(400)
          .send({
            message: error.message,
          });
      });
    const result = await db.oneOrNone('SELECT id from posts order by id desc limit 1;')

    for (image_id of req.body.image_ids) {
      await db.none('INSERT INTO posts_images (post_id, image_id) VALUES ($1, $2);', [
        result.id,
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
