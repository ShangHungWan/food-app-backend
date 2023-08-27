var express = require("express");
var router = express.Router();
var db = require("../db");

router.get("/regions", function (req, res, next) {
  db.any("SELECT * FROM regions")
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
