import jwt, { SignOptions } from "jsonwebtoken";
import moment from "moment";
import { APIGatewayProxyEventV2 } from "aws-lambda";
import ddbUtil from "./aws/ddbUtil.js";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";


// openssl rand -hex 128
const secretKey: string = process.env.JWT_SECRET_KEY || "temp_secret_key";

export const USER_JWT_CONTENTS = ["email"];

export const generateJwt = (data: object, exp: string | number) => {
    return jwt.sign({ ...data }, secretKey, { expiresIn: exp } as SignOptions);
};

export const verifyJwtKey = (
    token: string,
): { verified: true; decoded: jwt.JwtPayload } | { verified: false; err: string } => {
    try {
        const decoded = jwt.verify(token, secretKey);
        console.log("[verifyJwtKey decoded]", decoded);
        if (typeof decoded === "string") throw Error("decoded jwt is string, not JwtPayload");
        return { verified: true, decoded };
    } catch (err: any) {
        console.log("[verifyJwtKey failed]", err);
        return { verified: false, err: err?.name };
    }
};

export const generateUserAccessToken = async (email: string, additionalProperties: object, exp = 12 * 60 * 60) => {
    const dynamoDBClient = new DynamoDBClient({ region: "ap-northeast-2" });
    const docClient = DynamoDBDocumentClient.from(dynamoDBClient);
    const user = await ddbUtil.query(
        docClient,
        `${process.env.service}-${process.env.stage}-user-session`,
        ["email"],
        [email],
        { rawTableName: true },
    );
    if (!user.Items || user.Items.length === 0) throw new Error(`user not found: email = ${email}`);

    const jwtItem: any = { first_jwt_iat: moment().format("YYYY-MM-DD HH:mm:ss"), ...additionalProperties };
    for (const content of USER_JWT_CONTENTS) {
        const value = user.Items[0][content];
        if (value === undefined) {
            console.log(`failed to make jwt key with jwt content, users ${content} is undefined`);
            throw new Error(`failed to make jwt key`);
        }
        jwtItem[content] = value;
    }


    return generateJwt(jwtItem, exp);
};

export const generateUserRefreshToken = async (lambdaEvent: APIGatewayProxyEventV2, email: string, additionalProperties: object) => {
    let userIp = lambdaEvent.requestContext.http.sourceIp;
    console.log(`userIp = ${userIp}`);
    const jwtItem = { ip: userIp, email };
    const token = generateJwt(jwtItem, "180d");

    try {
        const dynamoDBClient = new DynamoDBClient({ region: "ap-northeast-2" });
        const docClient = DynamoDBDocumentClient.from(dynamoDBClient);
        await ddbUtil.update(
            docClient,
            `${process.env.service}-${process.env.stage}-user-session`,
            { email },
            ["refresh_token"],
            [token],
            { rawTableName: true },

        );
        console.log("successfully update refresh token");
    } catch (e) {
        console.log(`falied to put refresh token`);
    }
    return token;
};

export const generateTokens = async (lambdaEvent: APIGatewayProxyEventV2, email: string, additionalProperties: object) => {
    const accessToken = await generateUserAccessToken(email, additionalProperties);
    const refreshToken = await generateUserRefreshToken(lambdaEvent, email, additionalProperties);
    return { accessToken, refreshToken };
};
