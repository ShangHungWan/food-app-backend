var express = require("express");
var router = express.Router();
var db = require("../db");
const { body, validationResult } = require("express-validator");
const { hash_password, validate_password } = require("../bcrypt");
const { isAuthenticated } = require("../middlewares/auth");
const { GENDER } = require("../enums/genders");

router.post(
    "/auth/register",
    [
        body("email").notEmpty().trim().isEmail(),
        body("name").notEmpty().isString().trim().escape().isLength({ min: 1, max: 16 }),
        body("phone").notEmpty().isMobilePhone('zh-TW'),
        body("birthday").notEmpty().isDate(),
        body("address").notEmpty().isString().trim().escape().isLength({ min: 1, max: 255 }),
        body("gender").isIn(GENDER),
        body("avatar_id").notEmpty().isInt(),
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

        db.query('INSERT INTO users (${this:name}) VALUES(${this:csv}); ', {
            name: req.body.name,
            email: req.body.email,
            password: await hash_password(req.body.password),
            phone: req.body.phone,
            birthday: req.body.birthday,
            address: req.body.address,
            gender: req.body.gender,
            avatar_id: req.body.avatar_id,
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
    "/auth/upload/avatar",
    async function (req, res, next) {
        let avatar;
        let uploadPath;

        if (!req.files || Object.keys(req.files).length === 0) {
            return res.status(400).send('No files were uploaded.');
        }

        avatar = req.files.avatar;
        uploadPath = __dirname + '/../../uploads/avatars/' + avatar.name;
        const path = '/uploads/avatars/' + avatar.name;

        avatar.mv(uploadPath, async function (err) {
            if (err)
                return res.status(500).send(err);

            await db.oneOrNone('INSERT INTO "public"."avatars" ("url") VALUES ($1);', path)
                .then(function () {
                    return;
                })
                .catch(function (error) {
                    res
                        .status(400)
                        .send({
                            message: error.message,
                        });
                });
            const result = await db.oneOrNone('SELECT id from avatars WHERE url = $1 order by id desc limit 1;', path)
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
            res.send(result);
        });
    }
);

router.post(
    "/auth/login",
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

router.post('/auth/logout', isAuthenticated, function (req, res, next) {
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
});

module.exports = router;