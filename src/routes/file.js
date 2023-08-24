var express = require('express');
const path = require('path');
var router = express.Router();

router.get('/uploads/avatars/:avatarUrl', function (req, res, next) {
  const options = {
    root: path.join(__dirname + "/../../uploads/avatars/"),
  };

  res.sendFile(req.params.avatarUrl, options, function (err) {
    if (err) {
      res.sendStatus(404);
    }
  });
});

module.exports = router;
