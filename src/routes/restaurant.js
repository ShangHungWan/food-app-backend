var express = require("express");
var router = express.Router();
var db = require("../db");
const { isAuthenticated } = require("../middlewares/auth");
const { body, validationResult } = require("express-validator");

router.get("/restaurants", function (req, res, next) {
  req.query.search = req.query.search || '';
  req.query.region = req.query.region || '';
  req.query.sort = req.query.sort || '';
  let sql = "SELECT \
      r.id, \
      round(avg(c.score)::numeric, 1) AS score, \
      reg.name as region_name, \
      r.name, \
      r.address, \
      i.url AS image_url, \
      r.created_at, \
      r.updated_at \
    FROM restaurants AS r \
    JOIN images as i on r.image_id = i.id \
    JOIN regions as reg on r.region_id = reg.id \
    LEFT JOIN comments as c on r.id = c.restaurant_id \
    WHERE (r.name LIKE $1 OR r.address LIKE $1 OR r.phone LIKE $1)";
  if (req.query.region) {
    sql += "AND r.region_id = $2";
  }
  if (req.query.sort) {
    // TODO
  }
  sql += "GROUP BY \
  r.id, \
  reg.name, \
  r.name, \
  r.address, \
  r.phone, \
  r.url, \
  r.business_hours, \
  i.url, \
  r.created_at, \
  r.updated_at;";

  db.any(sql,
    [
      `%${req.query.search}%`,
      req.query.region,
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

router.get("/restaurant/:restaurantId", function (req, res, next) {
  db.oneOrNone("SELECT \
      r.id, \
      round(avg(c.score)::numeric, 1) AS score, \
      reg.name as region_name, \
      r.name, \
      r.address, \
      r.phone, \
      r.url, \
      r.business_hours, \
      i.url AS image_url, \
      r.created_at, \
      r.updated_at \
    FROM restaurants AS r \
    JOIN images as i on r.image_id = i.id \
    JOIN regions as reg on r.region_id = reg.id \
    LEFT JOIN comments as c on r.id = c.restaurant_id \
    WHERE r.id = $1 \
    GROUP BY \
    r.id, \
    reg.name, \
    r.name, \
    r.address, \
    r.phone, \
    r.url, \
    r.business_hours, \
    i.url, \
    r.created_at, \
    r.updated_at;",
    [req.params.restaurantId]
  )
    .then(function (data) {
      if (!data) {
        return res.status(404).send({
          status: "error",
          message: 'not found',
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

router.post(
  "/restaurant",
  [
    body("region_id").notEmpty().isInt(),
    body("image_id").notEmpty().isInt(),
    body("name").notEmpty().isString().trim().escape().isLength({ min: 1, max: 255 }),
    body("phone").notEmpty().isMobilePhone('zh-TW'),
    body("address").notEmpty().isString().trim().escape().isLength({ min: 1, max: 255 }),
    body("url").notEmpty().isURL().isLength({ min: 1, max: 255 }),
    body("business_hours").notEmpty().isString().trim().escape().isLength({ min: 1, max: 255 }),
  ],
  async function (req, res, next) {
    const validation = validationResult(req);
    if (!validation.isEmpty()) {
      return res.send({ errors: validation.array() });
    }

    db.query('INSERT INTO restaurants (${this:name}) VALUES(${this:csv}); ', {
      region_id: req.body.region_id,
      image_id: req.body.image_id,
      name: req.body.name,
      address: req.body.address,
      phone: req.body.phone,
      url: req.body.url,
      business_hours: req.body.business_hours,
    })
      .then(function (data) {
        res.sendStatus(200);
      })
      .catch(function (error) {
        res
          .status(400)
          .send({
            message: error.message,
          });
      });
  });

router.get("/restaurant/:restaurantId/comments", function (req, res, next) {
  req.query.has_image = req.query.has_image === true;
  req.query.sort_by = req.query.sort_by || 'created_at';
  req.query.sort_order = req.query.sort_order || 'desc';
  const sortByList = [
    'created_at',
    'score',
  ];
  const sortOrderList = [
    'desc',
    'asc',
  ];
  if (!req.query.sort_by in sortByList) {
    req.query.sort_by = sortByList[0];
  }
  if (!req.query.sort_order in sortOrderList) {
    req.query.sort_order = sortOrderList[0];
  }

  let sql = "SELECT \
      c.id, \
      u.name as user_name, \
      u.id as user_id, \
      avatar.url as user_avatar_url, \
      c.comment, \
      c.score, \
      i.url AS image_url, \
      c.created_at, \
      c.updated_at \
    FROM comments AS c \
    JOIN restaurants as r on c.restaurant_id = r.id \
    JOIN images as i on c.image_id = i.id \
    JOIN users as u on c.user_id = u.id \
    JOIN images as avatar on u.image_id = avatar.id \
    WHERE r.id = $1";

  if (req.query.has_image) {
    sql += " AND c.image_id IS NOT NULL";
  }

  sql += " ORDER BY " + req.query.sort_by + " " + req.query.sort_order;

  db.any(sql,
    [
      req.params.restaurantId,
      req.query.sort_by,
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

router.post(
  "/restaurant/:restaurantId/comment",
  [
    body("image_id").optional().isInt(),
    body("comment").notEmpty().isString().trim().escape(),
    body("score").notEmpty().isInt(),
  ],
  isAuthenticated,
  function (req, res, next) {
    const validation = validationResult(req);
    if (!validation.isEmpty()) {
      return res.send({ errors: validation.array() });
    }

    if (req.body.score < 1 || req.body.score > 5) {
      return res
        .status(400)
        .send({
          message: 'score must between 1~5.',
        });
    }

    db.query('INSERT INTO comments (${this:name}) VALUES(${this:csv}); ', {
      restaurant_id: req.params.restaurantId,
      user_id: req.session.user,
      image_id: req.body.image_id,
      comment: req.body.comment,
      score: req.body.score,
    })
      .then(function (data) {
        res.sendStatus(200);
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
