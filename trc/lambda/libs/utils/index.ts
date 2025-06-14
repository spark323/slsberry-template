import { createError } from "@middy/util";
import { ApiGatewayManagementApiClient, PostToConnectionCommand, GoneException } from "@aws-sdk/client-apigatewaymanagementapi";
import ddbUtil from "../aws/ddbUtil.js";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
// remove all undefined values from an object
export function removeUndefined<T extends object>(obj: T): T {
    return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;
}

export const createJsonError = ({
    statusCode,
    code,
    message,
    ...opts
}: {
    statusCode: number;
    code: string;
    message: string;
    [key: string]: any;
}) => {
    const error = createError(statusCode, message, opts);

    error.statusCode = statusCode;
    error.code = code;
    error.message = JSON.stringify({ message, code });
    error.expose = true;

    return error;
};

export function querySchemaToParameters(querySchema: {
    properties: Record<
        string,
        {
            type: string;
            description: string;
            example?: any;
            enum?: readonly string[];
        }
    >;
}) {
    return Object.entries(querySchema.properties).map(([key, value]) => {
        const { type, description, enum: _enum } = value;
        return {
            name: key,
            in: "query",
            required: false,
            description,
            schema: { type, enum: _enum },
            example: value.example,
            enum: value.enum,
        };
    });
}

export async function sendWebsocketToUsersInTable(docClient: DynamoDBDocumentClient, tableName: string, message: string) {
    let data = await ddbUtil.scan(docClient, tableName);
    console.log("scan result:", data);
    if (!data.Items || data.Items.length === 0) {

        return;
    }
    console.log("posting project message:", data.Items)
    for (const item of data.Items) {
        const connectionId = item.connection_id;

        const apigwManagementApi = new ApiGatewayManagementApiClient({
            apiVersion: '2018-11-29',
            region: process.env.region,
            endpoint: `https://${process.env.socket_api_gateway_id}.execute-api.ap-northeast-2.amazonaws.com/${process.env.stage}-${process.env.version}`,
        });

        const dt = { ConnectionId: connectionId, Data: message };
        try {
            await apigwManagementApi.send(new PostToConnectionCommand(dt));
        } catch (e) {
            console.log(e);
            //중간에 끊긴 connection은 삭제한다.
            if (e instanceof GoneException) {
                console.log(`Found stale connection, deleting ${connectionId}`);
                await ddbUtil.doDelete(docClient,
                    tableName,
                    { "connection_id": connectionId },
                    {

                    }
                )
            }
            else {
                console.log("Error sending message:", e);
            }
        }
    }
}