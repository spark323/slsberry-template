const AWS = require('aws-sdk');
AWS.config.update({
    region: "ap-northeast-2"
});
const { handleHttpRequest } = require('slsberry');
var ddbUtil = require("../lib/ddbUtil");
const apiSpec = {
    category: 'counter',
    event: [
        {
            type: 'REST',
            method: 'Get',
        },
    ],
    memorySize: 500,
    desc: '현재 지정한 카운터의 값을 가져온다.',
    parameters: {
        counterId: { req: true, type: 'string', desc: '카운터 아이디' },
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
                lastModified: { type: 'String', desc: '가장 마지막으로 카운터를 업데이트 한 날짜(YYYY-MM-DD HH:mm:ss' },
            },
        },
    },
};
exports.apiSpec = apiSpec;
async function handler(inputObject, event) {
    const { counterId } = inputObject;
    //do something with inputs

    if (false) {
        return { predefinedError: apiSpec.errors.unexpected_error };
    }
    try {
        const docClient = new AWS.DynamoDB.DocumentClient({ apiVersion: '2012-08-10', region: 'ap-northeast-2' });

        const data = await ddbUtil.query(docClient, process.env.counter_table_name, ['counter_id'], [counterId], { rawTableName: true });
        if (data.Items.length < 1) {
            return { predefinedError: apiSpec.errors.invalid_counter_id };
        }
        const value = data.Items[0].counter;


        return {
            status: 200,
            response: {
                value: value,

                lastModified: data.Items[0].last_modified
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