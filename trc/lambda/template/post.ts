import middy from "@middy/core";
import httpJsonBodyParser from "@middy/http-json-body-parser";
import type { APIGatewayProxyResult } from "aws-lambda";
import { ioLogger } from "../libs/middlewares/io-logger.js"
import { globalErrorHandler } from "../libs/middlewares/global-error-handler.js";
import { userFriendlyValidator } from "../libs/middlewares/user-friendly.validator.js"
import { FromSchema } from "json-schema-to-ts";
import { querySchemaToParameters, createJsonError } from "../libs/utils/index.js";
import { DynamoDBClient, PutItemCommand, DeleteItemCommand } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { AwsCredentialIdentityProvider } from "@smithy/types";
import ddbUtil from '../libs/aws/ddbUtil.js';

const bodySchema = {
  type: "object",
  properties: {
    pk: { type: "string" },
    sk: { type: "string" },

  },
  required: ["pk", "sk"],
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
    // {
    //     type: "REST",
    //     method: "POST",
    //     path: "/v2/admin/templates",
    //     authorizer: "recoAuthorizer",
    // },
  ],
  summary: "test template",
  desc: "Template 을 생성합니다.",
  // requestBody: {
  //     required: true,
  //     content: { "application/json": { schema: bodySchema } },
  // },
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
  const { pk, sk, } = event.body;
  const dynamoDBClient = new DynamoDBClient({
    region: "ap-northeast-2",
    credentials: event.v3TestProfile,

  });
  const docClient = DynamoDBDocumentClient.from(dynamoDBClient);
  console.log(event)
  await ddbUtil.put(docClient, "data", { hashKey: pk, rangeKey: sk, data: event.body })


  return {
    statusCode: 200,
    body: JSON.stringify({
      message: {
        pk,
        sk,

      }
    }),
  };
}

export const handler = middy()
  .use(ioLogger())
  .use(
    globalErrorHandler({
      name: apiSpec.summary,
      path: process.env.PATH,
      fallbackMessage: JSON.stringify({
        message: "Internal Server Error",
        code: "internal_server_error",
      }),
    }),
  )
  .use(httpJsonBodyParser())
  .use(userFriendlyValidator({ eventSchema }))
  .handler(lambdaHandler);