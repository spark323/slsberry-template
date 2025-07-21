import middy from "@middy/core";
import httpJsonBodyParser from "@middy/http-json-body-parser";
import type { APIGatewayProxyResult } from "aws-lambda";
import { ioLogger } from "../../libs/middlewares/io-logger.js";
import { globalErrorHandler } from "../../libs/middlewares/global-error-handler.js";
import { userFriendlyValidator } from "../../libs/middlewares/user-friendly.validator.js";
import { FromSchema } from "json-schema-to-ts";
import { querySchemaToParameters, createJsonError } from "../../libs/utils/index.js";
import { DynamoDBClient, PutItemCommand, DeleteItemCommand } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { AwsCredentialIdentityProvider } from "@smithy/types";

import { ResultType } from "../../types/types.js";
import dsqlUtill from "../../libs/utils/dsqlUtillWrapper.js";
import atomicCounterUtil from "../../libs/aws/atomicCounterUtil.js";
const bodySchema = {
  type: "object",
  properties: {
    contents: { type: "string", description: "Contents of the item" },
  },
  required: ["contents"],
  additionalProperties: true,
} as const;

// prettier-ignore
const responseSchema = {
  type: "object",
  properties: {
    message: { type: "string" },
  },
  additionalProperties: true,
} as const;

export const apiSpec = {
  category: "Template",
  event: [
    {
      type: "REST",
      method: "Post",
    },

  ],
  summary: "test template",
  desc: "Template 을 생성합니다.",

  requestBody: {
    required: true,
    content: { "application/json": { schema: bodySchema } },
  },
  errors: {},
  responses: {
    200: {
      description: "",
      content: { "application/json": { schema: responseSchema } },
    },
    400: { $ref: "#/components/responses/Validation" },
    401: { $ref: "#/components/responses/Unauthorized" },
    403: { $ref: "#/components/responses/InsufficientScope" },
    404: { $ref: "#/components/responses/NotFound" },
    415: { $ref: "#/components/responses/UnsupportedMediaType" },
    500: { $ref: "#/components/responses/InternalServerError" },
  },
};

const eventSchema = {
  type: "object",
  properties: {
    body: bodySchema,
  },

  required: ["body"],
} as const;

export async function lambdaHandler(
  event: FromSchema<typeof eventSchema> & { v3TestProfile: AwsCredentialIdentityProvider },
): Promise<APIGatewayProxyResult> {
  const { contents } = event.body;
  try {
    const contentsData = {
      idx: await atomicCounterUtil.incrementCounter("contents", 1, event.v3TestProfile),
      contents: contents,

    };

    await dsqlUtill.create('tb_contents', contentsData, event.v3TestProfile);
    return {
      statusCode: 201,
      body: JSON.stringify({
        result: ResultType.Success,
      }),
    };
  } catch (error) {
    console.log('Error creating organization invitation:', error);
    // Check if error is already a formatted error from createJsonError
    const err = error as any;
    if (err?.statusCode && err?.code) {
      throw err;
    }
    throw createJsonError({
      statusCode: 500,
      code: "InternalServerError",
      message: "Error creating organization invitation",
    });
  }


}

export const handler = middy()
  .use(ioLogger())
  .use(
    globalErrorHandler({
      name: apiSpec.summary,
      path: process.env.URI_PATH,
      fallbackMessage: JSON.stringify({
        message: "Internal Server Error",
        code: "internal_server_error",
      }),
    }),
  )
  .use(httpJsonBodyParser({ disableContentTypeError: true }))
  .use(userFriendlyValidator({ eventSchema }))
  .handler(lambdaHandler);
