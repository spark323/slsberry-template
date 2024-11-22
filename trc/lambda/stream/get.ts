import middy from "@middy/core";

import { ioLogger } from "../libs/middlewares/io-logger.js"
import { globalErrorHandler } from "../libs/middlewares/global-error-handler.js";
import { userFriendlyValidator } from "../libs/middlewares/user-friendly.validator.js"
import { FromSchema } from "json-schema-to-ts";
import { querySchemaToParameters, createJsonError } from "../libs/utils/index.js";
import { DynamoDBClient, PutItemCommand, DeleteItemCommand } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { AwsCredentialIdentityProvider } from "@smithy/types";
import { Readable } from 'stream';
import ddbUtil from '../libs/aws/ddbUtil.js';
import { time } from "console";
const querySchema = {
    type: "object",
    properties: {
        pk: { type: "string", description: "Partition Key", },
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
            path: "/template",
        },
        // {
        //     type: "REST",
        //     method: "POST",
        //     path: "/v2/admin/templates",
        //     authorizer: "recoAuthorizer",
        // },
    ],
    timeout: 300,
    url: {
        cors: true
    },
    //---applicationsignal 모니터링을 위한 세팅
    layers: [
        //리전별로 다름 https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch-Application-Signals-Enable-Lambda.html#Enable-Lambda-Layers
        "arn:aws:lambda:ap-northeast-2:615299751070:layer:AWSOpenTelemetryDistroJs:5"
    ],
    environment: {
        AWS_LAMBDA_EXEC_WRAPPER: "/opt/otel-instrument"
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

): Promise<any> {
    const { pk, sk } = event.queryStringParameters;
    let responseStream = event.responseStream;

    const readableStream = new Readable({
        read() {
            // This function is intentionally left empty
            // Data will be pushed dynamically using `push`
        },
    });


    let list = Array.from({ length: 300 }, (_, i) => `${(i + 1)} 초가 지났습니다.</br>`)
    list.unshift(`<meta charset="UTF-8">`)
    list.unshift("<html>")

    for (let i of list) {
        readableStream.push(i);
        await new Promise(r => setTimeout(r, 1000));
    }
    readableStream.push(null);
    return {
        statusCode: 200,
        body: readableStream,
        headers: {
            "Content-Type": "text;charset=utf-8",
            "X-Custom-Header": "Example-Custom-Header"
        }
    };
}

export const handler = middy({
    timeoutEarlyResponse: () => {
        return {
            statusCode: 408
        }
    },
    streamifyResponse: true
})
    .use(ioLogger())
    .use(
        globalErrorHandler({
            name: apiSpec.summary,
            path: apiSpec.event[0].path,
            fallbackMessage: JSON.stringify({
                message: "Internal Server Error",
                code: "internal_server_error",
            }),
        }),
    )
    .use(userFriendlyValidator({ eventSchema }))
    .handler(lambdaHandler);


