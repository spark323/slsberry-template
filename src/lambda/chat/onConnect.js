const AWS = require('aws-sdk');
AWS.config.update({
    region: "ap-northeast-2"
});
var moment = require('moment');
var ddbUtil = require("../lib/ddbUtil");
const { handleHttpRequest } = require('slsberry');
const apiSpec = {
    category: 'chat',
    event: [
        {
            type: 'websocket',
            method: 'websocket',
            route: '$connect',
        },
    ],
    desc: '웹소캣 접속 시 initilize 함수.',
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
    const item = {
        room_id: inputObject.room_id,
        connection_id: event.requestContext.connectionId,
        user_id: inputObject.user_id,
        timestamp: moment().valueOf()
    }
    try {
        await ddbUtil.put(docClient, "userlist", item);
    } catch (e) {
        console.error(e);
        return { predefinedError: apiSpec.errors.unexpected_error };
    }
    return {
        status: 200,
        response: {
            result: "success"
        }
    };
}
exports.handler = async (event, context) => {
    return await handleHttpRequest(event, context, apiSpec, handler);
};