var express = require("express");
var router = express.Router();
var db = require("../helpers/db");

router.get("/regions", function (req, res, next) {
  db.any("SELECT name FROM regions")
    .then(function (data) {
      res.send(data);
    })
    .catch(function (error) {
      res.status(400).send({ message: error.message });
    });
});

module.exports = router;
