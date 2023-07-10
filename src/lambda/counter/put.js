const AWS = require('aws-sdk');
AWS.config.update({
    region: "ap-northeast-2"
});
const { handleHttpRequest } = require('slsberry');
var ddbUtil = require("../lib/ddbUtil");
var moment = require("moment");
const apiSpec = {
    category: 'counter',
    event: [
        {
            type: 'REST',
            method: 'Put',
        },
    ],
    desc: '현재 지정한 카운터의 값을 업데이트 한다.',
    parameters: {
        counterId: { req: true, type: 'string', desc: '카운터 아이디' },
        value: { req: true, type: 'integer', desc: '증감할 값' },
    },
    errors: {
        unexpected_error: { status_code: 500, reason: '알 수 없는 에러' },
        invalid_counter_id: { status_code: 400, reason: '올바르지 않은 카운터 아이디입니다.' },
    },
    responses: {
        description: '',
        content: 'application/json',
        schema: {
            type: 'object',
            properties: {
                value: { type: 'Integer', desc: '현재 카운터의 값' },
            },
        },
    },
};
exports.apiSpec = apiSpec;
async function handler(inputObject, event) {
    const { counterId, value } = inputObject;
    //do something with inputs
    try {
        const docClient = new AWS.DynamoDB.DocumentClient({ apiVersion: '2012-08-10', region: 'ap-northeast-2' });

        const data = await ddbUtil.update(docClient, process.env.counter_table_name, { counter_id: counterId },
            ['last_modified', '+counter', 'val'], [moment().format("YYYY-MM-DD HH:mm:ss"), value], { rawTableName: true, returnValues: true });
        const _value = data.Attributes.counter
        return {
            status: 200,
            response: {
                value: _value,
            }
        };
    }
    catch (e) {
        console.log(e);
        return { predefinedError: apiSpec.errors.unexpected_error };
    }
}
exports.handler = async (event, context) => {
    return await handleHttpRequest(event, context, apiSpec, handler);
};