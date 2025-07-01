import middy from "@middy/core";
import type { APIGatewayProxyResult, APIGatewayProxyWebsocketEventV2 } from "aws-lambda";

import { querySchemaToParameters, createJsonError, sendWebsocketToProjectAdmin } from "../libs/utils/index.js";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import ddbUtil from "../libs/aws/ddbUtil.js";
import { WebsocketMessageType } from "../types.js";

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
            route: '$disconnect',
        },

    ],

    summary: "Websocket disconnect",
    desc: "Websocket disconnect",

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


export async function lambdaHandler(
    event: APIGatewayProxyWebsocketEventV2,
): Promise<APIGatewayProxyResult> {

    console.log(event);

    const dynamoDBClient = new DynamoDBClient({
        region: "ap-northeast-2",
    });
    const docClient = DynamoDBDocumentClient.from(dynamoDBClient);

    await ddbUtil.doDelete(docClient, `${process.env.service}-${process.env.stage}-participant-session`, { connection_id: event.requestContext.connectionId }, { rawTableName: true });

    let data = await ddbUtil.query(docClient, `${process.env.service}-${process.env.stage}-participant-session`,
        ["connection_id"], [event.requestContext.connectionId], {
        rawTableName: true,
    });
    if (!data.Items || data.Items.length === 0) {
        console.log("no connection id found", event.requestContext.connectionId);
        return {
            statusCode: 200,
            body: JSON.stringify({}),
        };
    }
    const projectId = data.Items[0].project_id;
    await sendWebsocketToProjectAdmin(docClient,
        projectId!, JSON.stringify({
            message_type: WebsocketMessageType.UserLeave,
            content: {
                nickname: data.Items[0].nickname,
            }
        })
    )


    return {
        statusCode: 200,
        body: JSON.stringify({

        }),
    };
}

export const handler = middy()
    .handler(lambdaHandler);
