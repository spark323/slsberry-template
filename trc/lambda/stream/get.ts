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
import { querySchema, apiSpec, responseSchema } from "./get_header.js";

const eventSchema = {
    type: "object",
    properties: {


    },
    required: [],
} as const;



export async function lambdaHandler(
    event: FromSchema<typeof eventSchema> & { v3TestProfile: AwsCredentialIdentityProvider },

): Promise<any> {
    // const { pk, sk } = event.queryStringParameters;
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
            path: process.env.PATH,
            fallbackMessage: JSON.stringify({
                message: "Internal Server Error",
                code: "internal_server_error",
            }),
        }),
    )
    .use(userFriendlyValidator({ eventSchema }))
    .handler(lambdaHandler);


