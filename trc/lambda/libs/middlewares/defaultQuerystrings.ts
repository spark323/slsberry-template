import middy from '@middy/core';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
type QuerySchema = {
    properties: Record<string, { type: string; description?: string; default?: string }>;
};

export const ensureQueryStringMiddleware = (schema: QuerySchema) => {
    return {
        before: async (request: { event: APIGatewayProxyEvent }) => {
            if (!request.event.queryStringParameters) {
                request.event.queryStringParameters = {};
            }

            for (const [key, value] of Object.entries(schema.properties)) {
                if (
                    !(key in request.event.queryStringParameters) &&
                    value.default !== undefined
                ) {
                    request.event.queryStringParameters[key] = value.default;
                }
            }
        },
    };
};