const isAuthenticated = function (req, res, next) {
    if (!req.session.user) {
        res.sendStatus(401);
    }
    next();
}

module.exports = {
    isAuthenticated,
};