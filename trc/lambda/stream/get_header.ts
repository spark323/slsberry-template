import { querySchemaToParameters, createJsonError } from "../libs/utils/index.js";

export const querySchema = {
    type: "object",
    properties: {

    },
    required: [],
    additionalProperties: false,
} as const;
// prettier-ignore
export const responseSchema = {
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
            method: "GET"

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
    // layers: [
    //     //리전별로 다름 https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch-Application-Signals-Enable-Lambda.html#Enable-Lambda-Layers
    //     "arn:aws:lambda:ap-northeast-2:615299751070:layer:AWSOpenTelemetryDistroJs:5"
    // ],
    // environment: {
    //     AWS_LAMBDA_EXEC_WRAPPER: "/opt/otel-instrument"
    // },
    // doNotHandleError:true,
    //아래 내용을 해야 실제로 500에러를 badrequest 취급.
    //--------------------------------------------------------------------------------
    summary: "test template",
    desc: "Template 을 생성합니다.",
    // requestBody: {
    //     required: true,
    //     content: { "application/json": { schema: bodySchema } },
    // },
    target_function: `stream/get`,
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



