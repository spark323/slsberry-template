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
            method: 'Get',
        },
    ],
    desc: 'DynamoDB의 값을 조회한다.',
    parameters: {
        hash_key: { req: true, type: 'string', desc: 'hash_key' },
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

            },
        },
    },
};
exports.apiSpec = apiSpec;
async function handler(inputObject, event) {
    const { hash_key } = inputObject;
    var docClient = new AWS.DynamoDB.DocumentClient();
    let dataItem = undefined;
    try {
        dataItem = await ddbUtil.query(docClient, "test-ddb", ["hash_key"], [hash_key])
    } catch (e) {
        console.error(e);
        return { predefinedError: apiSpec.errors.unexpected_error };
    }
    return {
        status: 200,
        response: {
            ...dataItem.Items
        }
    };
}
exports.handler = async (event, context) => {
    return await handleHttpRequest(event, context, apiSpec, handler);
};