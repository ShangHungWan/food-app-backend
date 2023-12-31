var express = require('express');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var debug = require('debug')('food-app:server');
var http = require('http');
var cors = require('cors')
require('dotenv').config();
var session = require('express-session')
const fileUpload = require('express-fileupload');

var indexRouter = require('./routes/index');
var userRouter = require('./routes/user');
var postRouter = require('./routes/post');
var authRouter = require('./routes/auth');
var fileRouter = require('./routes/file');
var restaurantRouter = require('./routes/restaurant');
var regionRouter = require('./routes/region');
var uploadRouter = require('./routes/upload');
var notificationRouter = require('./routes/notification');

var app = express();
var port = normalizePort(process.env.PORT || '3000');
app.set('port', port);

app.use(cors({
    origin: '*',
}))
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(fileUpload());

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true
}))

app.use('/', indexRouter);
app.use('/', userRouter);
app.use('/', postRouter);
app.use('/', authRouter);
app.use('/', fileRouter);
app.use('/', restaurantRouter);
app.use('/', regionRouter);
app.use('/', uploadRouter);
app.use('/', notificationRouter);

var server = http.createServer(app);
server.listen(port);
server.on('error', onError);
server.on('listening', onListening);

/**
 * Normalize a port into a number, string, or false.
 */

function normalizePort(val) {
    var port = parseInt(val, 10);

    if (isNaN(port)) {
        // named pipe
        return val;
    }

    if (port >= 0) {
        // port number
        return port;
    }

    return false;
}

/**
 * Event listener for HTTP server "error" event.
 */

function onError(error) {
    if (error.syscall !== 'listen') {
        throw error;
    }

    var bind = typeof port === 'string'
        ? 'Pipe ' + port
        : 'Port ' + port;

    // handle specific listen errors with friendly messages
    switch (error.code) {
        case 'EACCES':
            console.error(bind + ' requires elevated privileges');
            process.exit(1);
        case 'EADDRINUSE':
            console.error(bind + ' is already in use');
            process.exit(1);
        default:
            throw error;
    }
}

/**
 * Event listener for HTTP server "listening" event.
 */

function onListening() {
    var addr = server.address();
    var bind = typeof addr === 'string'
        ? 'pipe ' + addr
        : 'port ' + addr.port;
    debug('Listening on ' + bind);
}
