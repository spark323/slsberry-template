import middy from "@middy/core";
import type { APIGatewayProxyResult, APIGatewayProxyWebsocketEventV2 } from "aws-lambda";

import { querySchemaToParameters, createJsonError } from "../../libs/utils/index.js";
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from "@aws-sdk/client-apigatewaymanagementapi"
const querySchema = {
  type: "object",
  properties: {

  },
  required: [],
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
      type: 'websocket',
      method: 'websocket',
      route: '$default',
    },

  ],

  summary: "Websocket default",
  desc: "Websocket default",

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
  event: APIGatewayProxyWebsocketEventV2,
): Promise<APIGatewayProxyResult> {

  console.log(event);
  const connectionId = event.requestContext.connectionId;
  console.log(connectionId);

  const apigwManagementApi = new ApiGatewayManagementApiClient({
    apiVersion: '2018-11-29',
    region: process.env.region,
    endpoint: `https://${process.env.socket_api_gateway_id}.execute-api.ap-northeast-2.amazonaws.com/${process.env.stage}-${process.env.version}`,
  });

  const dt = {
    ConnectionId: connectionId, Data: JSON.stringify({
      "type": "pong",
      "connectionId": connectionId
    })
  };
  try {
    await apigwManagementApi.send(new PostToConnectionCommand(dt));
  } catch (e) {
    console.log(e);

  }
  return {
    statusCode: 200,
    body: JSON.stringify({
      connectionId: connectionId
    }),
  };
}

export const handler = middy()
  .handler(lambdaHandler);
