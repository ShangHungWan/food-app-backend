var express = require("express");
var router = express.Router();
var db = require("../db");
const { body, validationResult } = require("express-validator");
const { hash_password, validate_password } = require("../bcrypt");
const { isAuthenticated } = require("../auth");

// TODO: pagination
router.get("/", isAuthenticated, function (req, res, next) {
  req.query.search = req.query.search || '';
  db.any("SELECT \
        id, \
        name, \
        CASE WHEN EXISTS ( \
          SELECT 1 FROM users_friends WHERE user_id = $2 AND u.id = friend_id \
        ) THEN TRUE ELSE FALSE END AS is_friends \
      FROM users AS u \
      WHERE email LIKE $1 OR name LIKE $1 OR phone LIKE $1",
    [
      `%${req.query.search}%`,
      req.session.user,
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

router.get("/show/:userId", function (req, res, next) {
  db.oneOrNone("SELECT id, email, name, phone, created_at, updated_at from users WHERE id = $1", req.params.userId)
    .then(function (data) {
      if (!data) {
        return res.status(404).send({
          status: "error",
          message: 'user not found',
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
  "/register",
  [
    body("email").notEmpty().trim().isEmail(),
    body("name").notEmpty().isString().trim().escape().isLength({ min: 1, max: 16 }),
    body("phone").notEmpty().isMobilePhone('zh-TW'),
    body("password").notEmpty().isString().trim().escape().isLength({ min: 8, max: 16 }).custom((value, { req, loc, path }) => {
      if (value !== req.body.confirm_password) {
        throw new Error("Passwords don't match");
      } else {
        return value;
      }
    }),
  ],
  async function (req, res, next) {
    const validation = validationResult(req);
    if (!validation.isEmpty()) {
      return res.send({ errors: validation.array() });
    }

    // check if email exists
    const emailResult = await db.oneOrNone('SELECT * FROM users WHERE email = $1', req.body.email);
    if (emailResult) {
      return res.send({ errors: [{ msg: 'Email already exists' }] });
    }

    db.query('INSERT INTO users (${this: name}) VALUES(${ this: csv }); ', {
      name: req.body.name,
      email: req.body.email,
      password: await hash_password(req.body.password),
      phone: req.body.phone,
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
  },
);

router.post(
  "/login",
  [
    body("email").notEmpty().trim().isEmail(),
    body("password").notEmpty().isString().trim(),
  ],
  async function (req, res, next) {
    const validation = validationResult(req);
    if (!validation.isEmpty()) {
      return res.send({ errors: validation.array() });
    }

    const result = await db.oneOrNone('SELECT id, password from users WHERE email = $1;', req.body.email)
      .then(function (data) {
        return data;
      })
      .catch(function (error) {
        res
          .status(400)
          .send({
            message: error.message,
          });
      });

    if (!result || !validate_password(req.body.password, result.password)) {
      return res
        .status(400)
        .send({ message: 'Login failed' });
    }

    req.session.regenerate(function (err) {
      if (err) {
        console.log(err);
        return res
          .status(400)
          .send({ message: 'Login failed' });
      }

      req.session.user = result.id;
      return res.sendStatus(204);
    });
  }
);

router.post('/logout', isAuthenticated, function (req, res, next) {
  req.session.user = null
  req.session.save(function (err) {
    if (err) {
      console.log(err);
      return res
        .status(400)
        .send({ message: 'Logout failed' });
    }

    req.session.regenerate(function (err) {
      if (err) {
        console.log(err);
        return res
          .status(400)
          .send({ message: 'Logout failed' });
      }
      return res.sendStatus(204);
    })
  })
})

router.get("/me", isAuthenticated, function (req, res, next) {
  db.one("SELECT id, email, name, phone, created_at, updated_at from users where id = $1", req.session.user)
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
