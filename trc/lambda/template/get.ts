import middy from "@middy/core";
import type { APIGatewayProxyResult } from "aws-lambda";
import { ioLogger } from "../libs/middlewares/io-logger.js";
import { globalErrorHandler } from "../libs/middlewares/global-error-handler.js";
import { userFriendlyValidator } from "../libs/middlewares/user-friendly.validator.js";
import { FromSchema } from "json-schema-to-ts";
import { querySchemaToParameters, createJsonError } from "../libs/utils/index.js";
import { DynamoDBClient, PutItemCommand, DeleteItemCommand } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { AwsCredentialIdentityProvider } from "@smithy/types";
import ddbUtil from "../libs/aws/ddbUtil.js";
const querySchema = {
  type: "object",
  properties: {
    pk: { type: "string", description: "Partition Key" },
    sk: { type: "string", description: "Sort Key" },
  },
  required: ["pk"],
  additionalProperties: false,
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
      method: "GET",
    },
    // {
    //     type: "REST",
    //     method: "POST",
    //     path: "/v2/admin/templates",
    //     authorizer: "recoAuthorizer",
    // },
  ],
  //---applicationsignal 모니터링을 위한 세팅
  layers: [
    //리전별로 다름 https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch-Application-Signals-Enable-Lambda.html#Enable-Lambda-Layers
    "arn:aws:lambda:ap-northeast-2:615299751070:layer:AWSOpenTelemetryDistroJs:5",
  ],
  environment: {
    AWS_LAMBDA_EXEC_WRAPPER: "/opt/otel-instrument",
  },
  //아래 내용을 해야 실제로 500에러를 badrequest 취급.
  //--------------------------------------------------------------------------------
  summary: "test template",
  desc: "Template 을 생성합니다.",
  // requestBody: {
  //     required: true,
  //     content: { "application/json": { schema: bodySchema } },
  // },
  requestQuery: querySchemaToParameters(querySchema),
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
    queryStringParameters: querySchema,
  },
  required: ["queryStringParameters"],
} as const;

export async function lambdaHandler(
  event: FromSchema<typeof eventSchema> & { v3TestProfile: AwsCredentialIdentityProvider },
): Promise<APIGatewayProxyResult> {
  const { pk, sk } = event.queryStringParameters;
  console.log(event);

  const dynamoDBClient = new DynamoDBClient({
    region: "ap-northeast-2",
    credentials: event.v3TestProfile,
  });
  const docClient = DynamoDBDocumentClient.from(dynamoDBClient);

  // throw createJsonError({
  //     statusCode: 400,
  //     code: "DoesNotHaveControlPanelSpec",
  //     message: "This engine does not have an control panel spec.",
  // });
  let data = await ddbUtil.query(docClient, "data", ["hashKey", "rangeKey"], [pk, sk]);
  console.log("test1");

  return {
    statusCode: 200,
    body: JSON.stringify({
      message: {
        data: data.Items,
      },
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
  .use(userFriendlyValidator({ eventSchema }))
  .handler(lambdaHandler);
