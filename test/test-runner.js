"use strict";

/* eslint-disable no-console */
const path = require("path");

global.base_dir = path.resolve(__dirname, "..");

// Enable bluebird debug settings for unit tests
require("bluebird").config({
	longStackTraces: true
});


/**
 * Add the test suites here.
 */
// require("./tests/Lambda");
require("./tests/QueueManager");
