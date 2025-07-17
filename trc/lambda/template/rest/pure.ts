import middy from "@middy/core";
import { APIGatewayProxyEventV2 } from 'aws-lambda';
export const apiSpec = {
  hide: true,
  category: "template",
  event: [
    {
      type: "Pure",
    },
  ],
  parameters: {},
  responses: {
    description: "",
  },
};

export async function lambdaHandler(event: any) {

}

export const handler = middy().handler(lambdaHandler);
