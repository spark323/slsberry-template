const AWS = require('aws-sdk');
AWS.config.update({
    region: "ap-northeast-2"
});
const { handleHttpRequest } = require('slsberry');
const apiSpec = {
    category: 'Test',
    event: [
        {
            type: 'REST',
            method: 'Get',
        },
    ],
    desc: '현재 엔진 상태 조회',
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
    console.log(event);
    try {
        var s3 = new AWS.S3({});
        var params = {};
        const data = await s3.listBuckets(params).promise();
        return {
            status: 200,
            response: {
                result: 'success',
                records: data
            },
        };
    }
    catch (e) {
        console.error(e);
        return { predefinedError: apiSpec.errors.unexpected_error };
    }
}
exports.handler = async (event, context) => {
    return await handleHttpRequest(event, context, apiSpec, handler);
};