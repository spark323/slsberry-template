const { handleHttpRequest } = require('slsberry');

//실제 함수 설정은 count_get.js 에서 설정

async function handler(inputObject, event) {
    let responseStream = event.responseStream;

    const httpResponseMetadata = {
        statusCode: 200,
        headers: {
            "Content-Type": "text;charset=utf-8",
            "X-Custom-Header": "Example-Custom-Header"
        }
    };
    responseStream = awslambda.HttpResponseStream.from(responseStream, httpResponseMetadata);


    let list = Array.from({ length: 300 }, (_, i) => `${(i + 1)} 초가 지났습니다.</br>`)
    list.unshift(`<meta charset="UTF-8">`)
    list.unshift("<html>")

    for (let i of list) {
        responseStream.write(i);
        await new Promise(r => setTimeout(r, 1000));
    }
    responseStream.end();
    return {
        status: 200,
        response: {
            ...inputObject,
        }
    };
}
const apiSpec = require("./count_get").apiSpec
exports.handler = awslambda.streamifyResponse(


    async (event, responseStream, context) => {
        console.log(JSON.stringify(event));
        await handleHttpRequest({
            ...event,
            responseStream: responseStream
        }, context, apiSpec, handler);
    }
)
