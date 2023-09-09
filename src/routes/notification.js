var express = require("express");
var router = express.Router();
var db = require("../helpers/db");
const { isAuthenticated } = require("../middlewares/auth");

router.get("/notifications", isAuthenticated, async function (req, res, next) {
  const result = await db.any("SELECT \
        id, \
        notifiable_type, \
        notifiable_id, \
        message, \
        read_at, \
        created_at, \
        updated_at \
      FROM notifications \
      WHERE user_id = $1",
    [
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

  for (let notification of result) {
    const images = await db.any("SELECT \
        images.id, \
        images.url \
        FROM posts_images \
        JOIN images ON posts_images.image_id = images.id \
        WHERE posts_images.post_id = $1",
      notification.notifiable_id,
    );
    notification.images = images;
  }

  return res.send(result);
});

router.put("/notification/:notificationId/read", isAuthenticated, async function (req, res, next) {
  const notification = await db.oneOrNone("SELECT id FROM notifications WHERE id = $1 AND user_id = $2",
    [
      req.params.notificationId,
      req.session.user,
    ],
  );
  if (!notification) {
    return res.status(404).send({
      message: "Notification not found",
    });
  }

  db.none("UPDATE notifications SET read_at = current_timestamp WHERE id = $1",
    [
      req.params.notificationId,
    ],
  )
    .then(function () {
      res.sendStatus(204);
    })
    .catch(function (error) {
      res.status(400).send({
        message: error.message,
      });
    });
});

module.exports = router;
