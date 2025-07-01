import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { AwsCredentialIdentityProvider } from "@smithy/types";
import ddbUtil from "./ddbUtil.js";

async function incrementCounter(
    counterName: string,
    incrementBy: number = 1,
    credential?: AwsCredentialIdentityProvider
): Promise<number> {


    const dynamoDBClient = new DynamoDBClient({
        region: "ap-northeast-2",
        credentials: credential
    });
    const docClient = DynamoDBDocumentClient.from(dynamoDBClient);

    const result = await ddbUtil.update(docClient,
        `${process.env.service}-${process.env.stage}-atomic-counter`,
        { counter_name: counterName }, ["+val", "val"], [incrementBy], { returnValues: true, rawTableName: true });
    const newVal = result.Attributes.val;
    console.log(`Counter ${counterName} incremented by ${incrementBy}. New value: ${newVal}`);
    return newVal;

}
export default {
    incrementCounter
};
