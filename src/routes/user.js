var express = require("express");
var router = express.Router();
var db = require("../db");
const { body, validationResult } = require("express-validator");
const { hash_password, validate_password } = require("../bcrypt");
const { isAuthenticated } = require("../auth");

router.get("/", function (req, res, next) {
  db.any("SELECT id, email, name, phone, created_at, updated_at from users")
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

    db.query('INSERT INTO users (${this:name}) VALUES (${this:csv});', {
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

    const password = await db.oneOrNone('SELECT PASSWORD from users WHERE email = $1;', req.body.email)
      .then(function (data) {
        return data.password;
      })
      .catch(function (error) {
        res
          .status(400)
          .send({
            message: error.message,
          });
      });

    if (!password || !validate_password(req.body.password, password)) {
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

      req.session.user = req.body.email;
      return res.sendStatus(204);
    });
  }
);

router.post('/logout', function (req, res, next) {
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
  db.one("SELECT id, email, name, phone, created_at, updated_at from users where email = $1", req.session.user)
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
