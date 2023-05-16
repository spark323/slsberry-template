const AWS = require('aws-sdk');
AWS.config.update({
    region: "ap-northeast-2"
});
const { handleHttpRequest } = require('slsberry');
const apiSpec = {
    category: 'http',
    event: [
        {
            type: 'REST',
            method: 'Get',
        },
    ],
    desc: 'GET Template',
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
                hashKey: { type: 'String', desc: 'hash_key' },
            },
        },
    },
};
exports.apiSpec = apiSpec;
async function handler(inputObject, event) {
    const { hash_key } = inputObject;
    //do something with inputs

    return {
        status: 200,
        response: {
            ...inputObject
        }
    };
}
exports.handler = async (event, context) => {
    return await handleHttpRequest(event, context, apiSpec, handler);
};