const AWS = require('aws-sdk');
AWS.config.update({
    region: "ap-northeast-2"
});
var ddbUtil = require("../lib/ddbUtil");
const { handleHttpRequest } = require('slsberry');
const apiSpec = {
    category: 'chat',
    event: [
        {
            type: 'REST',
            method: 'Put',
        },
    ],
    desc: 'DynamoDB 값을 넣는다.',
    parameters: {
        company_name: { req: true, type: 'String', desc: '회사명' },
        type: { req: true, type: 'String', desc: 'type' },
        email: { req: true, type: 'String', desc: 'email' },
    },
    errors: {
        unexpected_error: { status_code: 500, reason: '알 수 없는 에러' },
    },
    responses: {
        description: '',
        content: 'application/json',
        schema: {
            type: 'object',
            properties: {
                company_name: { type: 'String', desc: '회사명' },
                type: { type: 'String', desc: 'type' },
                email: { type: 'String', desc: 'email' },
                range_key: { type: 'String', desc: 'range key' },
            },
        },
    },
};
exports.apiSpec = apiSpec;
async function handler(inputObject, event) {
    const { email, company_name, type } = inputObject;
    var docClient = new AWS.DynamoDB.DocumentClient();

    const rangeKey = moment().valueOf();
    const item = {
        hash_key: "hash_test",
        range_key: moment().valueOf(),
        email: inputObject.email,
        company_name: inputObject.company_name,
        type: inputObject.type
    };
    try {
        await ddbUtil.put(docClient, "chat-messages", item);
    } catch (e) {
        console.error(e);
        return { predefinedError: apiSpec.errors.unexpected_error };
    }

    return {
        status: 200,
        response: "ok",
        data: {
            hash_key: "hash_test",
            rangeKey: rangeKey,
            ...inputObject
        }
    }
}
exports.handler = async (event, context) => {
    return await handleHttpRequest(event, context, apiSpec, handler);
};