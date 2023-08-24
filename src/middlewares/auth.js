const isAuthenticated = function (req, res, next) {
    if (!req.session.user) {
        return res.sendStatus(401);
    }
    next();
}

module.exports = {
    isAuthenticated,
};