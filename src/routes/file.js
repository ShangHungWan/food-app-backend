var express = require('express');
const path = require('path');
var router = express.Router();

router.get('/uploads/images/:url', function (req, res, next) {
  const options = {
    root: path.join(__dirname + "/../../uploads/images/"),
  };

  res.sendFile(req.params.url, options, function (err) {
    if (err) {
      res.sendStatus(404);
    }
  });
});

module.exports = router;
