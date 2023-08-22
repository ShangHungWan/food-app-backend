const bcrypt = require("bcrypt")
const saltRounds = 10
const hash_password = async function (password) {
    return await bcrypt
        .genSalt(saltRounds)
        .then(salt => {
            return bcrypt.hashSync(password, salt);
        })
        .catch(err => {
            console.error(err.message);
            return null;
        });
}
const validate_password = bcrypt.compareSync;

module.exports = {
    hash_password,
    validate_password,
};