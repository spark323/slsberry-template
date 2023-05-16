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
    desc: '채팅 가져오기',
    parameters: {
        room_id: { req: true, type: 'string', desc: 'room_id' },
        user_id: { req: true, type: 'string', desc: 'user_id' },
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
    const { room_id, user_id } = inputObject;
    var docClient = new AWS.DynamoDB.DocumentClient();
    let dataItem = undefined;
    try {
        dataItem = await ddbUtil.query(docClient, "chat-messages", ["room_id", "user_id"], [room_id, user_id])
    } catch (e) {
        console.error(e);
        return { predefinedError: apiSpec.errors.unexpected_error };
    }
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