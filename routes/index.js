/*
 * Connect all of your endpoints together here.
 */

var express = require('express');

module.exports = function (app, router) { 
    // Each route file exports a function that RETURNS a router
    app.use('/api', require('./home.js')(express.Router()));
    app.use('/api/users', require('./users.js')(express.Router()));
    app.use('/api/tasks', require('./tasks.js')(express.Router()));
};
