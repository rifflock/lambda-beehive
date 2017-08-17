<a name="top"></a>
![lambda-beehive logo](https://github.com/rifflock/lambda-beehive/blob/master/lambda-beehive.png)

# lambda-beehive
Bee-Queue based lambda invocation tool

The purpose of this package is to queue up lambda jobs and process them asynchronously

Think of it like an SQS queue where you can schedule jobs at any point in the future instead of just 15 minutes out.

Since the queue lives on Redis this could theoretically be run using lambda functions, but my intention is to have it running on an EC2 instance.

This is currently in pre-release. A working version is in development.