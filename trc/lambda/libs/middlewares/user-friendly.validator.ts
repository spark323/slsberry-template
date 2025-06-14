import middy from "@middy/core";
import validator from "@middy/validator";
import { transpileSchema } from "@middy/validator/transpile";
import { ErrorObject } from "ajv";
import localize from "ajv-i18n";
import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from "aws-lambda";
import { createJsonError } from "../utils/index.js";

export const userFriendlyValidator = ({
  eventSchema,
  querySchema,
  bodySchema,
  opt = {
    transpile: true,
  },
}: {
  eventSchema: any;
  querySchema?: any;
  bodySchema?: any;
  opt?: any;
}) => {
  const onError: middy.MiddlewareFn<APIGatewayProxyEvent, APIGatewayProxyResult, Error, Context> = async (request) => {
    const cause = request.error?.cause as Record<string, any>;
    if (request.error && cause?.package === "@middy/validator") {
      const errorMessages = cause.data;
      request.error = createJsonError({
        statusCode: 400,
        message: formatUserFriendlyErrors(errorMessages || []),
        code: "ValidationError",
      });
    }
  };

  return {
    ...validator({
      // todo: transpile performance improvement
      eventSchema: opt.transpile
        ? transpileSchema(eventSchema, {
            allErrors: true,
            strictSchema: false,
            useDefaults: true,
          })
        : eventSchema,
      languages: { en: localize.en },
    }),
    onError: onError,
  };
};

function formatUserFriendlyErrors(errorMessages: ErrorObject[]) {
  return errorMessages
    .map((error) => {
      const instancePath = error.instancePath || "";
      const message = error.message || "";

      return `${instancePath} ${message}`;
    })
    .join("\n");
}
