import { createError } from "@middy/util";
import { ApiGatewayManagementApiClient, PostToConnectionCommand, GoneException } from "@aws-sdk/client-apigatewaymanagementapi";
import ddbUtil from "../aws/ddbUtil.js";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { ResultType } from "../../types.js";
// remove all undefined values from an object
export function removeUndefined<T extends object>(obj: T): T {
    return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;
}
export const getS3bucketName = (type: "src", region: string) => {

    if (type === "src") {
        return `qnect.${process.env.stage}.${region}-resourcebucket`
    }


    return `qnect.${process.env.stage}.${region}-resourcebucket`
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
    error.message = JSON.stringify({ message, code, result: ResultType.Error });
    error.expose = true;


    return error;
};
export async function sendWebsocketToProjectClient(docClient: DynamoDBDocumentClient, project_id: string, message: string) {
    let data = await ddbUtil.query(docClient, `${process.env.service}-${process.env.stage}-participant-session`,
        ["project_id"], [project_id], {
        rawTableName: true,
        IndexName: "project_id-nickname-index",
    });
    if (!data.Items || data.Items.length === 0) {

        return;
    }
    console.log("posting project target:", data.Items)
    console.log("posting project message:", message)
    const apigwManagementApi = new ApiGatewayManagementApiClient({
        apiVersion: '2018-11-29',
        region: process.env.region,
        endpoint: `https://${process.env.socket_api_gateway_id}.execute-api.ap-northeast-2.amazonaws.com/${process.env.stage}-${process.env.version}`,
    });
    for (const item of data.Items) {
        const connectionId = item.connection_id;



        const dt = { ConnectionId: connectionId, Data: message };
        try {
            await apigwManagementApi.send(new PostToConnectionCommand(dt));
        } catch (e) {
            console.log(e);
            //중간에 끊긴 connection은 삭제한다.
            if (e instanceof GoneException) {
                console.log(`Found stale connection, deleting ${connectionId}`);
                await ddbUtil.doDelete(docClient,
                    `${process.env.service}-${process.env.stage}-participant-session`,
                    { "connection_id": connectionId },
                    {
                        rawTableName: true,
                    }
                )
            }
            else {
                console.log("Error sending message:", e);
            }
        }
    }
}
export async function sendWebsocketToProjectAdmin(docClient: DynamoDBDocumentClient, project_id: string, message: string) {
    let data = await ddbUtil.query(docClient, `${process.env.service}-${process.env.stage}-project-session`,
        ["project_id"], [project_id], {
        rawTableName: true,
        IndexName: "project_id-index",
    });
    if (!data.Items || data.Items.length === 0) {

        return;
    }
    console.log("posting project message:", data.Items)
    const apigwManagementApi = new ApiGatewayManagementApiClient({
        apiVersion: '2018-11-29',
        region: process.env.region,
        endpoint: `https://${process.env.socket_api_gateway_id}.execute-api.ap-northeast-2.amazonaws.com/${process.env.stage}-${process.env.version}`,
    });

    for (const item of data.Items) {
        const connectionId = item.connection_id;


        const dt = { ConnectionId: connectionId, Data: message };
        try {
            await apigwManagementApi.send(new PostToConnectionCommand(dt));
        } catch (e) {
            console.log(e);
            //중간에 끊긴 connection은 삭제한다.
            if (e instanceof GoneException) {
                console.log(`Found stale connection, deleting ${connectionId}`);
                await ddbUtil.doDelete(docClient,
                    `${process.env.service}-${process.env.stage}-project-session`,
                    { "connection_id": connectionId },
                    {
                        rawTableName: true,
                    }
                )
            }
            else {
                console.log("Error sending message:", e);
            }
        }
    }
}


export const calcualteAnswerScore = (timeDeleta: number, maxTimeout: number = 30000) => {

    // Calculate the score based on the time delta
    // This is a simple example, you can adjust the formula as needed
    const baseScore = 100; // Base score for a correct answer
    const maxTimeDelta = maxTimeout; // 1 minute in milliseconds
    const penaltyFactor = 0.01; // Penalty factor for each millisecond over the max time delta

    console.log(`Calculating score: timeDelta=${timeDeleta}, maxTimeDelta=${maxTimeDelta}, baseScore=${baseScore}, penaltyFactor=${penaltyFactor}`);
    if (timeDeleta >= maxTimeDelta) {
        return baseScore;
    } else {
        return baseScore + (maxTimeDelta - timeDeleta) * penaltyFactor
    }


}


export const ShouldNotExist = async <T>(
    target: T | undefined | Promise<T | undefined>,
    variables: Record<string, any> = {},
): Promise<void> => {
    const value = await target;

    // todo: if value is array, check if it's empty or only contains sub elements in varaibles

    if (value) {
        const message = `${formatVariables(variables)} already exists`;
        throw createJsonError({
            statusCode: 400,
            code: "Duplicated",
            message,
        });
    }
};

export const ShouldExist = async <T>(
    target: T | undefined | Promise<T | undefined>,
    variables: Record<string, any> = {},
): Promise<T> => {
    const value = await target;

    // if value is undefined or empty array, throw not found error
    if (!value || (Array.isArray(value) && value.length === 0)) {
        const message = `${formatVariables(variables)} not found`;
        throw createJsonError({
            statusCode: 404,
            code: "NotFound",
            message,
        });
    }
    return value;
};

export const CouldExist = async <T>(
    condition: boolean,
    target: T | undefined | Promise<T | undefined>,
    variables: Record<string, any> = {},
): Promise<T | undefined> => {
    if (condition) {
        return await ShouldExist(target, variables);
    }
};


const formatVariables = (variables: Record<string, any>) => {
    return Object.entries(variables)
        .map(([key, value]) => `$${key}=${value}`)
        .join(", ");
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
    >,
    required: readonly string[];
    additionalProperties?: boolean;
}) {
    return Object.entries(querySchema.properties).map(([key, value]) => {
        const { type, description, enum: _enum } = value;
        return {
            name: key,
            in: "query",
            required: querySchema.required.includes(key),
            description,
            schema: { type, enum: _enum },
            example: value.example,
            enum: value.enum,
        };
    });
}
export function pathSchemaToParameters(pathSchema: {
    properties: Record<string, { type: string; description: string; example?: any }>;
}) {
    return Object.entries(pathSchema.properties).map(([key, value]) => {
        const { type, description } = value;
        return {
            name: key,
            in: "path",
            required: true,
            description,
            schema: { type },
            example: value.example,
        };
    });
}

export function convertKeysWithDotToNestedObjects(target: Record<string, any>) {
    const result: Record<string, any> = {};
    const keysWithDot = Object.keys(target).filter((key) => key.includes("."));

    for (const key in target) {
        if (!keysWithDot.includes(key)) {
            result[key] = target[key];
        }

        if (keysWithDot.includes(key)) {
            const keyParts = key.split(".");
            let currentItem = result;
            for (let i = 0; i < keyParts.length - 1; i++) {
                const currentKey = keyParts[i];
                if (!currentItem[currentKey]) {
                    currentItem[currentKey] = {};
                }
                currentItem = currentItem[currentKey];
            }
            const lastKey = keyParts[keyParts.length - 1];
            currentItem[lastKey] = target[key];
        }
    }

    return result;
}

export function extractRegionFromBucket(bucket: string) {
    const regex = /^recon-core-operative\.([a-zA-Z0-9-]+)\.amazonaws\.com\//;
    const match = bucket.match(regex);

    if (match && match[1]) {
        return match[1];
    } else {
        return "ap-northeast-2";
    }
}

export function camelToSnake(obj: any): any {
    if (typeof obj !== "object" || obj === null) {
        return obj;
    }

    if (Array.isArray(obj)) {
        return obj.map((item) => camelToSnake(item));
    }

    return Object.keys(obj).reduce((acc: any, key: string) => {
        const value = obj[key];
        const snakeKey = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
        acc[snakeKey] = camelToSnake(value);
        return acc;
    }, {});
}

export function combineArray<T>(arr: T[], targetFieldName: string, resultFieldName: string) {
    // 그룹 이름을 저장할 객체
    const groupNamesMap: any = {};

    // 배열을 순회하면서 그룹 이름을 매핑합니다.
    arr.forEach((item: any) => {
        const { idx, id, [targetFieldName]: group_name } = item;
        if (!groupNamesMap[id]) {
            groupNamesMap[id] = { idx, id, [resultFieldName]: [] };
        }
        groupNamesMap[id][resultFieldName].push(group_name);
    });

    return Object.values(groupNamesMap);
}
