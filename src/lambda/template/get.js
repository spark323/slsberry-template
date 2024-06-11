const { handleHttpRequest } = require('slsberry');
const apiSpec = {
    category: 'http',
    event: [
        {
            type: 'REST',
            method: 'Get',
        },
    ],
    desc: 'GET Template',
    parameters: {
        hashKey: { req: true, type: 'string', desc: 'hash_key' },
        counter: { req: true, type: 'integer', desc: 'counter' },
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
};
exports.apiSpec = apiSpec;
async function handler(inputObject, event) {
    const { hashKey, counter } = inputObject;
    // const dynamoDBClient = new DynamoDBClient({
    //     region: "ap-northeast-2",
    //     credentials: event.v3TestProfile,

    // });
    // const docClient = DynamoDBDocumentClient.from(dynamoDBClient);
    console.log(inputObject);
    //do something with inputs

    if (false) {
        return { predefinedError: apiSpec.errors.unexpected_error };
    }
    // const dynamoDBClient = new DynamoDBClient({
    //     region: "ap-northeast-2",
    //     credentials: event.v3TestProfile

    // });
    return {
        status: 200,
        response: {
            ...inputObject,
            counter: counter + 1

        }
    };
}
exports.handler = async (event, context) => {
    return await handleHttpRequest(event, context, apiSpec, handler);
};