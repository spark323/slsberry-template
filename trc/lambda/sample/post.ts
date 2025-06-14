import { APIGatewayProxyResult } from "aws-lambda";
import { AwsCredentialIdentityProvider } from "@smithy/types";
import middy from "@middy/core";
import { FromSchema } from "json-schema-to-ts";

import { userFriendlyValidator } from "../libs/middlewares/user-friendly.validator.js"

import { ResultType } from "../types.js"
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { createJsonError } from "../libs/utils/index.js";
import ddbUtil from "../libs/utils/aws/ddbUtil.js"
import moment from "moment";
import { nanoid } from "nanoid";
import httpJsonBodyParser from "@middy/http-json-body-parser";


const bodySchema = {
    type: "object",
    properties: {
        hashKey: { type: "string", description: "Hash key for the request" },
        rangeKey: { type: "string", description: "Range key for the request" },
    },
    required: [],
    additionalProperties: true,
} as const;

// Define the event schema
const eventSchema = {
    type: "object",
    properties: {
        body: bodySchema,
    },
    required: ["body"],
} as const;

// Define response schema
const responseSchema = {
    type: "object",
    properties: {

        type: "object",
        properties: {
        },

    },
    additionalProperties: true
};

// Define API specifications
export const apiSpec = {
    category: "Sample",
    event: [
        {
            type: "REST",
            method: "POST",

        },
    ],
    summary: "DynamoDB util을 활용하는 Post/Put 함수의 예시입니다.",
    desc: "Example of using DynamoDB util to perform Post/Put operations",
    //Disabled should be false if Its deployed to production.
    disabled: true,
    requestBody: {
        required: true,
        content: { "application/json": { schema: bodySchema } },
    },
    errors: {},
    responses: {
        200: {
            description: "Successfully Post requested data",
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
    event: FromSchema<typeof eventSchema> & { v3TestProfile: AwsCredentialIdentityProvider },

): Promise<APIGatewayProxyResult> {

    const dynamoDBClient = new DynamoDBClient({
        region: "ap-northeast-2",
        credentials: event.v3TestProfile
    });
    const docClient = DynamoDBDocumentClient.from(dynamoDBClient);
    const {
        hashKey,
        rangeKey,
    } = event.body;

    if (!hashKey) {
        throw createJsonError({
            statusCode: 400,
            code: "bad_request",
            message: "hashKey is required",
        });
    }
    try {


        const insertObject = {
            hashKey: hashKey,
            rangeKey: rangeKey,
            date_time: moment().format("YYYY-MM-DD HH:mm:ss"),
            random_string: nanoid(10),

        }

        await ddbUtil.put(docClient, `sample`, insertObject, {

        });
        console.log("Data inserted successfully:", insertObject);
        // Example of using ddbUtil to update an item in the table

        await ddbUtil.query(docClient, `sample`, [

            "hashKey", "rangeKey"],
            [
                hashKey,
                rangeKey,
            ]
            , {

            });
        console.log("Data queried successfully:", insertObject);


        //only hashKey
        await ddbUtil.query(docClient, `sample`,
            //When you want to query only hashKey, you only have to put hashKey in the first array without rangeKey.
            ["hashKey"],
            [rangeKey]
            , {});

        await ddbUtil.scan(docClient, `sample`);
        console.log("Data scanned successfully:", insertObject);

        await ddbUtil.update(docClient, `sample`,
            {
                hashKey: hashKey,
                rangeKey: rangeKey
            },
            ["random_string"],
            [
                nanoid(10),
            ],
            {

            },
        );
        console.log("Data updated successfully:", insertObject);
        // Example of using ddbUtil to delete an item in the table
        await ddbUtil.doDelete(docClient, `sample`, {
            hashKey: hashKey,
            rangeKey: rangeKey
        }, {

        });
        console.log("Data deleted successfully:", insertObject);



        // Example of Sending a message to a WebSocket connection



        return {
            statusCode: 200,
            body: JSON.stringify({
                success: ResultType.Success,
                data: {
                    hashKey: hashKey,
                    rangeKey: rangeKey,
                },
            }),
        };

    } catch (error) {
        console.error('Error retrieving board content:', error);
        throw createJsonError({
            statusCode: 500,
            code: "internal_server_error",
            message: "Internal Server Error",
        });
    }
}


export const handler = middy()
    .use(httpJsonBodyParser({ disableContentTypeError: true }))
    .use(userFriendlyValidator({ eventSchema }))
    .handler(lambdaHandler);
