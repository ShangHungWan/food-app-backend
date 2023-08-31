var express = require("express");
var router = express.Router();
var db = require("../db");

router.post(
    "/upload/image",
    async function (req, res, next) {
        let file;
        let uploadPath;

        if (!req.files || Object.keys(req.files).length === 0 || !req.files.file) {
            return res.status(400).send({ message: 'No files were uploaded.' });
        }

        file = req.files.file;
        const folder = '/uploads/images/';
        uploadPath = __dirname + '/../..' + folder + file.name;
        const path = folder + file.name;

        file.mv(uploadPath, async function (err) {
            if (err)
                return res.status(500).send({ message: err.message });

            await db.oneOrNone('INSERT INTO images ("url") VALUES ($1);', path)
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
            const result = await db.oneOrNone('SELECT id from images WHERE url = $1 order by id desc limit 1;', path)
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

module.exports = router;