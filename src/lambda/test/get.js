const { handleHttpRequest } = require('slsberry');
const apiSpec = {
    category: 'Test',
    event: [
        {
            type: 'Pure'
        },
    ],
    desc: '테스트 함수 ',
    parameters: {
        input1: { req: true, type: 'string', desc: 'input1' },
        input2: { req: true, type: 'string', desc: 'input2' },
    },
    errors: {
        engine_not_supported: { status_code: 404, reason: '현재 지원하지 않는 엔진입니다.' },
    },
    responses: {
        description: '',
        content: 'application/json',
        schema: {
            type: 'object',
            properties: {
                input1: { type: 'String', desc: 'input1' },
                input2: { type: 'String', desc: 'input2' },

            },
        },
    },
};

exports.apiSpec = apiSpec;
async function handler(inputObject, event) {
    console.log(event);
    const { input1, input2 } = inputObject;
    const data = {
        input1: input1,
        input2: input2,
    }
    return {
        status: 200,
        response: {
            result: 'success',
            data: data
        },
    };
}
exports.handler = async (event, context) => {
    return await handleHttpRequest(event, context, apiSpec, handler);
};
