var express = require("express");
var router = express.Router();
var db = require("../db");
const { isAuthenticated } = require("../middlewares/auth");

// TODO: pagination
router.get("/posts", isAuthenticated, function (req, res, next) {
  req.query.search = req.query.search || '';
  db.any("SELECT \
        id, \
        author_id, \
        location, \
        content, \
        image_url, \
        created_at, \
        updated_at \
      FROM posts \
      WHERE location LIKE $1 OR content LIKE $1",
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

router.patch("/post/:postId", isAuthenticated, function (req, res, next) {
  // TODO
});

router.put("/post/:postId/like", isAuthenticated, function (req, res, next) {
  // TODO
});

router.put("/post/:postId/unlike", isAuthenticated, function (req, res, next) {
  // TODO
});

module.exports = router;
