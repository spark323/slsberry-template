const AWS = require('aws-sdk');
AWS.config.update({
    region: "ap-northeast-2"
});
const { handleHttpRequest } = require('slsberry');
const apiSpec = {
    category: 's3',
    event: [
        {
            type: 'REST',
            method: 'Get',
        },
    ],
    desc: 'S3 버킷 목록을 출력하는 함수',
    parameters: {
        userId: { req: true, type: 'string', desc: '유저 아이디' },
        excludeBucket: { req: false, type: 'string', desc: '제외할 버킷 이름' },
    },
    errors: {
        unexpected_error: { status_code: 500, reason: '알 수 없는 에러' },
        invalid_format: { status_code: 400, reason: '버킷이름 포맷이 잘못되었습니다.' },
    },
    responses: {
        description: '',
        content: 'application/json',
        schema: {
            type: 'array',
            items: {
                type: "object",
                properties: {
                    bucketName: { type: 'String', desc: '버킷이름' },

                },
            }

        },
    },
};
exports.apiSpec = apiSpec;
async function handler(inputObject, event) {
    const { hash_key } = inputObject;
    //do something with inputs

    if (false) {
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