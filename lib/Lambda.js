"use strict";

const AWS = require("aws-sdk");
const BbPromise = require("bluebird");
const _ = require("lodash");

/**
 * Error returned if AWS Lambda invocation succeeded, but responded with an error message.
 *
 * @property {String} message - Response error message.
 * @property {Object} response - Original response object returned by the Lambda function.
 * @property {String} response.errorMessage - Error message.
 * @property {String} response.errorType - Error type.
 * @property {String} name - Set to `LambdaResponseError`.
 */
class LambdaResponseError extends Error {

	/**
	 * Create a new LambdaResponseError object
	 *
	 * @param {Object} response - Response object returned by AWS Lambda.
	 * @property {string} response.errorMessage - Error message.
	 * @property {string} response.errorType - Error type.
	 */
	constructor(response) {
		response = response || {};

		super(response.errorMessage);
		this.message = response.errorMessage;
		this.response = response;
		this.name = "LambdaResponseError";
	}
}

/**
 * Error returned if AWS Lambda invocation failed and was rejected by AWS.
 *
 * @property {String} message - Error message.
 * @property {String} response.errorMessage - Error message.
 * @property {String} response.errorType - Error type.
 * @property {Number} response.statusCode - Status code.
 * @property {String} name - Set to `LambdaRequestError`.
 */
class LambdaRequestError extends Error {

	/**
	 * Create a new LambdaRequestError object
	 *
	 * @param {Object} error - Response object returned by AWS Lambda.
	 * @property {string} error.errorMessage - Error message.
	 * @property {string} error.errorType - Error type.
	 * @property {number} error.statusCode - Status code.
	 */
	constructor(error) {
		error = error || {};

		super(error.message);
		this.message = error.message;
		this.response = {
			errorMessage: error.message,
			errorType: error.code,
			statusCode: error.statusCode
		};
		this.name = "LambdaRequestError";
	}
}

class Lambda {

	constructor(awsConfig, maxRetries) {
		this.lambda = new AWS.Lambda(awsConfig);
		this.maxRetries = maxRetries;
	}

	/**
	 * Invoke a Lambda function.
	 *
	 * If a HTTP 429 (Rate Limit) response is returned by AWS, we automatically retry 
	 * up to `this.maxRetries` times.
	 * In case the Lambda returns an error response but the call itself succeeds, the promise
	 * will be rejected with a {@link LambdaResponseError}
	 *
	 * @param {string} arn - Amazon Resource Name (ARN) of the function (for example, arn:aws:lambda:us-west-2:account-id:function:ThumbNail)
	 * @param {Object} payload - Payload sent to the profile system.
	 * @param {Object} [options] - Optional options.
	 * @property {string} options.invocationType - Lambda invocation type Event|RequestResponse|DryRun. Defaults to `RequestResponse`.
	 * @returns {Promise} Bluebird promised response for `RequestResponse` invocations, `undefined` otherwise.
	 */
	invokeLambda(arn, payload, options) {
		return this._invokeLambda(arn, payload, options, 0);
	}

	/**
	 * @private
	 * @param {string} arn - Lambda function ARN to call.
	 * @param {Object} payload - Payload sent to the profile system.
	 * @param {Object} [options] - Optional options.
	 * @param {integer} [numTries=0] - Current number of retries
	 */
	_invokeLambda(arn, payload, options, numTries) {
		options = options || {};
		const params = {
			FunctionName: arn,
			InvocationType: options.invocationType || "RequestResponse",
			LogType: "None",
			Payload: JSON.stringify(payload)
		};

		const tries = numTries || 0;

		return BbPromise.fromCallback(callback => {
			this.lambda.invoke(params, callback);
		})
		.then(response => {
			if (response.StatusCode === 429) {
				if (tries === this.maxRetries) {
					return BbPromise.reject(new Error("Rate limit exceeded."));
				}

				// We are using an exponential backoff with full jitter
				return BbPromise.delay(Math.ceil(Math.random() * (200 * Math.pow(2, tries))))
				.then(() => this._invokeLambda(arn, payload, options, tries + 1));
			}

			if (params.InvocationType === "RequestResponse") {
				return BbPromise.resolve(JSON.parse(response.Payload))
				.catch(() => BbPromise.reject(new Error(`JSON Parse Error: ${JSON.stringify(response.Payload)}`)));
			}
			// Just resolve with undefined in case of asynchronous (event type) call
			return BbPromise.resolve();
		})
		.then(responsePayload => {
			if (responsePayload && (responsePayload.errorType || responsePayload.errorMessage)) {
				return BbPromise.reject(new LambdaResponseError(responsePayload));
			}
			return BbPromise.resolve(responsePayload);
		})
		.catch(err => {
			// AWS errors like token exceptions are reported here!
			if (_.isString(err.code)) {
				return BbPromise.reject(new LambdaRequestError(err));
			}
			// Forward any other error as is
			return BbPromise.reject(err);
		});
	}
}

module.exports = Lambda;
module.exports.LambdaResponseError = LambdaResponseError;
module.exports.LambdaRequestError = LambdaRequestError;