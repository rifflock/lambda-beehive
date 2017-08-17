"use strict";
/* eslint-disable no-console */

const Queue = require("bee-queue");
const BbPromise = require("bluebird");
const Lambda = require("./Lambda");
const _ = require("lodash");

class QueueManager {

	constructor(opts) {
		this.lambda = new Lambda({
			apiVersion: opts.apiVersion,
			region: opts.region
		}, opts.maxRetries);

		this.redis = {
			host: opts.redisHost,
			port: opts.redisPort
		};
		this.queueNames = opts.queues;
		this.queues = [];
	}

	process() {
		if (_.isEmpty(this.queueNames)) {
			return BbPromise.reject(new TypeError("No queueNames passed to process call"));
		}
		return BbPromise.map(this.queueNames, queueName => {
			console.log(`Creating queue "${queueName}"`);
			return new Queue(queueName, {
				redis: this.redis,
				isWorker: true,
				removeOnSuccess: true
			});
		})
		.tap(queues => this.queues = queues)
		.map(queue => {
			console.log(`Processing "${queue.name}"`);
			return queue.process(job => {
				console.log(`Pulled job ${job.id}`);
				const arn = _.get(job, "data.lambdaArn");
				if (!arn) {
					console.error("Lambda ARN is a require property for each job");
					return BbPromise.resolve();
				}
				const event = _.get(job, "data.event", {});
				const options = _.get(job, "data.options", {});
				console.log(`Sending job to ARN: ${arn}, with event:`, event);
				return this.lambda.invokeLambda(arn, event, options)
				.tap(result => {
					if (options.invocationType === "RequestResponse" || !options.invocationType) {
						console.log(`Completed job sent to ${arn} with result:`, result);
					}
					else {
						console.log(`Sent job to ${arn}`);
					}
				})
				.catch(err => {
					console.error(`Encountered an error sending job to ${arn}`, err);
					return BbPromise.reject(err);
				});
			});
		});
	}

	stop() {
		// console.log("Closing queues");
		// // Await close on each
		// return BbPromise.map(this.queues, queue => {
		// 	return queue.close(30 * 1000);
		// });
	}

	purge() {
		// console.log("Clearing queues");
		// 
		// return BbPromise.map(this.queues, queue => {
		// 	return queue.destroy();
		// });
	}
}

module.exports = QueueManager;