var express = require("express");
var router = express.Router();
var db = require("../db");
const { isAuthenticated } = require("../middlewares/auth");
const { body, validationResult } = require("express-validator");

router.get("/restaurants", async function (req, res, next) {
  req.query.place_ids = req.query.place_ids || '';
  let sql = "SELECT \
    r.place_id, \
    round(avg(c.score)::numeric, 1) AS score, \
    r.created_at \
    FROM restaurants AS r \
    LEFT JOIN comments as c on r.id = c.restaurant_id \
    WHERE r.place_id IN ($1:csv) \
    GROUP BY \
    r.place_id, \
    r.created_at;";

  const result = await db.any(sql,
    [req.query.place_ids],
  )
    .then(function (data) {
      return data;
    })
    .catch(function (error) {
      res.status(400).send({
        status: "error",
        message: error.message,
      });
    });

  const missingRestaurantIds = req.query.place_ids.filter((placeId) => {
    return !result.some((restaurant) => {
      return restaurant.place_id === placeId;
    });
  });

  for (restaurantId of missingRestaurantIds) {
    await getOrCreate(restaurantId);
  }

  db.any(sql,
    [req.query.place_ids],
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

router.get("/restaurant/:restaurantId", async function (req, res, next) {
  try {
    res.send(await getOrCreate(req.params.restaurantId, res));
  } catch (error) {
    res.status(400).send({
      status: "error",
      message: error.message,
    });
  }
});

router.get("/restaurant/:placeId/comments", function (req, res, next) {
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
    WHERE r.place_id = $1";

  if (req.query.has_image) {
    sql += " AND c.image_id IS NOT NULL";
  }

  sql += " ORDER BY " + req.query.sort_by + " " + req.query.sort_order;

  db.any(sql,
    [
      req.params.placeId,
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
  "/restaurant/:placeId/comment",
  [
    body("image_id").optional().isInt(),
    body("comment").notEmpty().isString().trim().escape(),
    body("score").notEmpty().isInt(),
  ],
  isAuthenticated,
  async function (req, res, next) {
    const validation = validationResult(req);
    if (!validation.isEmpty()) {
      return res.status(400).send({ errors: validation.array() });
    }

    if (req.body.score < 1 || req.body.score > 5) {
      return res
        .status(400)
        .send({
          message: 'score must between 1~5.',
        });
    }

    const restaurantId = await db.one("SELECT \
      r.id \
      FROM restaurants AS r \
      WHERE r.place_id = $1",
      [req.params.placeId],
    )
      .then(function (data) {
        return data.id;
      })
      .catch(function (error) {
        return null;
      });

    if (restaurantId === null) {
      return res
        .status(404)
        .send({
          message: 'not found',
        });
    }

    db.query('INSERT INTO comments (${this:name}) VALUES(${this:csv});', {
      restaurant_id: restaurantId,
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

async function getOrCreate(restaurantId) {
  const exists = await db.oneOrNone("SELECT \
      place_id \
    FROM restaurants as r \
    WHERE r.place_id = $1",
    [restaurantId],
  )
    .then(function (data) {
      return data !== null;
    })
    .catch(function (error) {
      throw error;
    });

  if (!exists) {
    await db.query('INSERT INTO restaurants (place_id) VALUES($1)', [restaurantId])
      .catch(function (error) {
        throw error;
      });
  }

  return await db.one("SELECT \
    r.place_id, \
    round(avg(c.score)::numeric, 1) AS score, \
    r.created_at \
    FROM restaurants AS r \
    LEFT JOIN comments as c on r.id = c.restaurant_id \
    WHERE r.place_id = $1 \
    GROUP BY \
    r.place_id, \
    r.created_at",
    [restaurantId],
  )
    .then(function (data) {
      return data;
    })
    .catch(function (error) {
      throw error;
    });
}

module.exports = router;
