"use strict";

/* global base_dir */
/* eslint promise/always-return: off */

const Queue = require("bee-queue");
const chai = require("chai");
const sinon = require("sinon");
const proxyquire = require("proxyquire");
const BbPromise = require("bluebird");

class LambdaStub {
	constructor() {}
	invokeLambda() {}
	_invokeLambda() {}
}

const QueueManager = proxyquire(`${base_dir}/lib/QueueManager`, {
	"./Lambda": LambdaStub
});

chai.use(require("chai-as-promised"));
chai.use(require("sinon-chai"));

const expect = chai.expect;

describe("Queue Manager", function() {
	this.timeout(10000);
	// Vars defined in before step
	let qm;
	let jobId;
	let sandbox;
	let lambdaInvokeSpy;
	let testQueue;

	// Test constants
	const redisHost = "localhost";
	const redisPort = 6379;
	const queueName = "testQueue";
	const lambdaArn = "test-lambda-invoke";
	const lambdaEvent = {
		test: "test"
	};

	// Initialize vars
	before(() => {
		qm = new QueueManager({
			region: "us-east-1",
			queues: [ queueName ],
			maxRetries: 2,
			apiVersion: "2015-03-31",
			redisHost,
			redisPort
		});
		sandbox = sinon.sandbox.create();
		lambdaInvokeSpy = sandbox.stub(LambdaStub.prototype, "invokeLambda").callsFake((arn, event) => BbPromise.resolve({ arn, event }));
		testQueue = new Queue(queueName, {
			redis: {
				host: redisHost,
				port: redisPort
			},
			isWorker: false,
			removeOnSuccess: true
		});
	});

	after(() => {
		sandbox.restore();
		testQueue.destroy();
	});

	it("should add job to the queue", () => {
		return testQueue.createJob({
			lambdaArn,
			event: lambdaEvent
		})
		.save()
		.then(job => {
			jobId = job.id;
			expect(jobId).to.not.be.undefined;
			return testQueue.getJob(jobId);
		})
		.then(job => {
			// Job is in the queue
			expect(job).to.be.an("object");
			expect(job.status).to.equal("created");
		});
	});

	it("should process the queue", () => {
		return qm.process()
		.delay(1000)
		.then(() => {
			return testQueue.getJob(jobId)
			.then(job => {
				expect(job).to.be.null;
				expect(lambdaInvokeSpy).to.be.calledOnce;
				expect(lambdaInvokeSpy).to.be.calledWith(lambdaArn, lambdaEvent, {});
			});
		});
	});
});