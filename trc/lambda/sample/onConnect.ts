import middy from "@middy/core";
import type { APIGatewayProxyResult, APIGatewayProxyWebsocketEventV2, APIGatewayProxyEventBase, APIGatewayEventWebsocketRequestContextV2 } from "aws-lambda";

import { querySchemaToParameters, createJsonError, } from "../libs/utils/index.js";


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
            route: '$connect',
        },

    ],
    //Disabled should be false if Its deployed to production.
    disabled: true,
    summary: "Websocket Connect",
    desc: "Websocket Connect",
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
    console.log(JSON.stringify(event, null, 2));
    const eventT = event as APIGatewayProxyEventBase<APIGatewayEventWebsocketRequestContextV2>
    const { queryStringParameters } = eventT;


    return {
        statusCode: 200,
        body: JSON.stringify({

        }),
    };


}

export const handler = middy()
    .handler(lambdaHandler);
