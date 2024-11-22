import middy from "@middy/core";
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";


export const ioLogger = (): middy.MiddlewareObj<
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Error
> => {
  const requestEventLogger: middy.MiddlewareFn<
    APIGatewayProxyEvent,
    APIGatewayProxyResult,
    Error
  > = async (request) => {
    if (process.env.NODE_ENV === "test") {
      return;
    }
    console.log("📢 request.context.awsRequestId");
    console.log(request.context.awsRequestId);
    console.log("📢 request.event");
    console.log(JSON.stringify(request.event));
  };

  const responseEventLogger: middy.MiddlewareFn<
    APIGatewayProxyEvent,
    APIGatewayProxyResult,
    Error
  > = async (request) => {
    if (process.env.NODE_ENV === "test") {
      return;
    }
    console.log("📢 request.response");
    console.log(JSON.stringify(request?.response));
  };

  return {
    before: requestEventLogger,
    after: responseEventLogger,
    onError: responseEventLogger,
  };
};
