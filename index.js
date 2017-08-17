"use strict";
/* eslint-disable no-console */

const QueueManager = require("./lib/QueueManager")
	, BbPromise = require("bluebird")
	, minimist = require("minimist")
	, _ = require("lodash");

BbPromise.config({
	// Enable long stack traces
	longStackTraces: true,
});

function parseArgs() {
	return minimist(process.argv.slice(2), {
		boolean: [ "debug" ],
		alias: {
			d: "debug"
		},
		default: {
			debug: false
		}
	});
}

const args = parseArgs();
global.suppressLog = !args.debug;

if (_.size(args._) === 0) {
	console.error("At least one queue name must be specified");
	return 1;
}

const region = args.AWS_REGION || process.env.AWS_REGION;
if (!region) {
	console.error("'AWS_REGION' argument or environment variable must be passed");
	return 1;
}

const apiVersion = args.AWS_LAMBDA_VERSION || "2015-03-31";
if (!args.AWS_LAMBDA_VERSION) {
	console.warn(`No 'AWS_LAMBDA_VERSION' argument specified, defaulting to ${apiVersion}`);
}

const redisHost = args.REDIS_HOST || "localhost";
if (!args.REDIS_HOST) {
	console.warn(`No 'REDIS_HOST' argument specified, defaulting to ${redisHost}`);
}

const redisPort = args.REDIS_PORT || 6379;
if (!args.REDIS_PORT) {
	console.warn(`No 'REDIS_PORT' argument specified, defaulting to ${redisPort}`);
}

const maxRetries = args.MAX_RETRIES || 2;
if (!args.MAX_RETRIES) {
	console.warn(`No 'MAX_RETRIES' argument specified, defaulting to ${maxRetries}`);
}

const qm = new QueueManager({
	region,
	queues: args._,
	maxRetries,
	apiVersion,
	redisHost,
	redisPort
});

return qm.process();
