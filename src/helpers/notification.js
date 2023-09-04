var db = require("./db");

const createNotification = async function (user_id, notifiable_type, notifiable_id, message) {
    await db.none("INSERT INTO notifications (user_id, notifiable_type, notifiable_id, message) VALUES ($1, $2, $3, $4)",
        [
            user_id,
            notifiable_type,
            notifiable_id,
            message,
        ],
    );
}

module.exports = {
    createNotification,
};