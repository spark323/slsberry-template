import middy from "@middy/core";
import { jsonSafeParse } from "@middy/util";
import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from "aws-lambda";
import { nanoid } from "nanoid";


export interface ApiKeyVerifiedContext extends Context {
  client_id: string;
  user_email?: string;
  scopes: Record<string, boolean>;
  provider: "cognito" | "api-key";
}

export const authGuard = (): middy.MiddlewareObj<
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Error,
  ApiKeyVerifiedContext
> => {
  const before: middy.MiddlewareFn<APIGatewayProxyEvent, APIGatewayProxyResult, Error> = async (
    request,
  ) => {
    console.log(request)
  };

  return {
    before,
  };
};
