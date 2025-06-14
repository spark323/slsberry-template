import { APIGatewayProxyResult } from "aws-lambda";
import { AwsCredentialIdentityProvider } from "@smithy/types";
import middy from "@middy/core";
import { FromSchema } from "json-schema-to-ts";
import { ioLogger } from "../libs/middlewares/io-logger.js";
import { globalErrorHandler } from "../libs/middlewares/global-error-handler.js";
import { userFriendlyValidator } from "../libs/middlewares/user-friendly.validator.js";
import { ensureQueryStringMiddleware } from "../libs/middlewares/defaultQuerystrings.js";

import { ResultType } from "../types.js";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { createJsonError, querySchemaToParameters } from "../libs/utils/index.js";
import ddbUtil from "../libs/aws/ddbUtil.js";
import moment from "moment";
import { nanoid } from "nanoid";



// Define the query schema for board content retrieval
const querySchema = {
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
        queryStringParameters: querySchema,
    },
    required: ["queryStringParameters"],
} as const;

// Define response schema
const responseSchema = {
    type: "object",
    properties: {
        success: { type: "boolean", describetion: "Success status" },
        hashKey: { type: "string", describetion: "Hash key" },
        rangeKey: { type: "string", describetion: "Range key" },
    },
    additionalProperties: true,
};

// Define API specifications
export const apiSpec = {
    category: "Sample",
    event: [
        {
            type: "REST",
            method: "GET",

        },
    ],
    summary: "DynamoDB util을 활용하는 예시입니다.",
    desc: "DynamoDB util을 활용하는 예시입니다.",
    //Disabled should be false if Its deployed to production.
    disabled: true,
    requestQuery: querySchemaToParameters(querySchema),
    errors: {},
    responses: {
        200: {
            description: "Successfully retrieved requested data",
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
    } = event.queryStringParameters || {};
    if (!hashKey) {
        throw createJsonError({
            statusCode: 400,
            code: "bad_request",
            message: "hashKey is required",
        });
    }

    try {
        // Extract query parameters with defaults



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

        //
        await ddbUtil.query(docClient, `sample`, [
            "hashKey", "rangeKey"], [hashKey, rangeKey]
            , {

            });
        console.log("Data queried successfully:", insertObject);

        //only hashKey
        await ddbUtil.query(docClient, `sample`,
            //When you want to query only hashKey, you only have to put hashKey in the first array without rangeKey.
            ["hashKey"],
            [rangeKey]
            , {});
        console.log("Data queried successfully:", insertObject);

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
    .use(ensureQueryStringMiddleware(querySchema))
    .use(userFriendlyValidator({ eventSchema }))
    .handler(lambdaHandler);
