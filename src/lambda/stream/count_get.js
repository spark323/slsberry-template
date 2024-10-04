export const apiSpec = {
    category: 'stream',
    event: [
        {
            type: 'Pure',
        },
    ],
    desc: 'Lambda Function URL + Response Stream을 활용한 count 함수',
    parameters: {
        hashKey: { req: false, type: 'string', desc: 'hash_key' },
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
    url: {
        cors: true
    },
    response_stream: true,
    //커스텀 타임아웃
    timeout: 500,
    target_function: `stream/get`,

};
