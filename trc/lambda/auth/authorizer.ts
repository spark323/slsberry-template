import middy from "@middy/core";
import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { verifyJwtKey } from '../libs/jwt.js';
export const apiSpec = {
    hide: true,
    category: "Authorizer",
    event: [
        {
            type: "Pure",
        },
    ],
    desc: "AppAuthorizer",
    parameters: {},
    responses: {
        description: "",
    },
};
export async function lambdaHandler(event: APIGatewayProxyEventV2) {
    let response = { isAuthorized: false, context: {} };
    const tokenFromRequest = event.headers.authorization?.split(' ')[1];
    console.log('[Authorizer: tokenFromRequest]', tokenFromRequest);
    const verifyJwt = verifyJwtKey(tokenFromRequest ?? '');
    response.isAuthorized = verifyJwt.verified;
    if (verifyJwt.verified === true) {
        response.context = { ...verifyJwt.decoded };
    } else {
        console.log('[Authorizer: Verification Failed]');
        response.context = { err: verifyJwt.err };
    }
    return response;
}
export const handler = middy().handler(lambdaHandler);
