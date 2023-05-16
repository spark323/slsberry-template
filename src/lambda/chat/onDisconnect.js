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
            route: '$disconnect',
        },
    ],
    desc: '웹소캣 접속 시 Disconnect  처리.',
    parameters: {

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
    const docClient = new AWS.DynamoDB.DocumentClient({ apiVersion: '2012-08-10', region: 'ap-northeast-2' });
    try {
        await ddbUtil.doDelete(docClient, process.env.websocket_ddb, {
            connection_id: event.requestContext.connectionId,
        });
    } catch (e) {
        console.log(e)
        return { predefinedError: 'internal_server_error' };
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