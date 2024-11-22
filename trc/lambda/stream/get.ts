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


export const handler = awslambda.streamifyResponse(


    async (event, responseStream, context) => {



        const httpResponseMetadata = {
            statusCode: 200,
            headers: {
                "Content-Type": "text;charset=utf-8",
                "X-Custom-Header": "Example-Custom-Header"
            }
        };
        responseStream = awslambda.HttpResponseStream.from(responseStream, httpResponseMetadata);


        let list = Array.from({ length: 300 }, (_, i) => `${(i + 1)} 초가 지났습니다.</br>`)
        list.unshift(`<meta charset="UTF-8">`)
        list.unshift("<html>")

        for (let i of list) {
            responseStream.write(i);
            console.log(i)
            await new Promise(r => setTimeout(r, 1000));
        }
        responseStream.end();
        let response = {
            isBase64Encoded: false,
            statusCode: 200,
            headers: {

                "Content-Type": "application/json; charset=utf-8",
                "Access-Control-Expose-Headers": "*",

                "Access-Control-Allow-Origin": "*",


            },
            body: JSON.stringify({
                "message": "success",
            }),
        };
        return response;
    }
)

