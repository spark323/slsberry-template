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
    desc: '채팅 넣기/전달',
    parameters: {
        room_id: { req: true, type: 'string', desc: 'room_id' },
        user_id: { req: true, type: 'string', desc: 'user_id' },
        text: { req: true, type: 'string', desc: 'text' },
        name: { req: true, type: 'string', desc: 'name' },
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
    const { text, name, room_id, user_id } = inputObject;
    var docClient = new AWS.DynamoDB.DocumentClient();

    const item = {
        room_id: room_id,
        timestamp: now,
        message: text,
        user_id: user_id,
        name: name,
    };
    try {
        await ddbUtil.put(docClient, "chat-messages", item);
    } catch (e) {
        console.error(e);
        return { predefinedError: apiSpec.errors.unexpected_error };
    }

    let result = undefined;
    try {
        result = await ddbUtil.query(docClient, "userlist", ["room_id"], [room_id], { IndexName: "room_id-user_id-index" })
    } catch (e) {
        console.error(e);
        return { predefinedError: apiSpec.errors.unexpected_error };
    }
    const now = moment().valueOf();



    //이전에 불러온 방에 접속한 유저들 모두에게 채팅을 보낸다.
    const apigwManagementApi = new AWS.ApiGatewayManagementApi({
        apiVersion: '2018-11-29',
        endpoint: `${process.env.socket_api_gateway_id}.execute-api.ap-northeast-2.amazonaws.com/dev`
    });
    if (result.Items) {
        const postCalls = result.Items.map(async ({ connection_id }) => {
            const dt = { ConnectionId: connection_id, Data: JSON.stringify(item) };
            try {
                await apigwManagementApi.postToConnection(dt).promise();
            } catch (e) {
                console.log(e);
                //만약 이 접속은 끊긴 접속이라면, DB에서 삭제한다.
                if (e.statusCode === 410) {
                    console.log(`Found stale connection, deleting ${connection_id}`);
                    try {
                        await ddbUtil.doDelete(docClient, "chatapp-userlist", { "connection_id": connection_id })

                    } catch (e) {
                        console.error(e);
                    }
                }
            }
        });
        try {
            await Promise.all(postCalls);
        } catch (e) {
            return { predefinedError: apiSpec.errors.unexpected_error };
        }
    }
    return {
        status: 200,
        response: {
            result: "ok"
        }
    };
}
exports.handler = async (event, context) => {
    return await handleHttpRequest(event, context, apiSpec, handler);
};