import middy from "@middy/core";
import { APIGatewayProxyEvent } from "aws-lambda";


import axios from "axios";
import moment from "moment";

import { Readable } from "stream";

export const apiSpec = {
	hide: true,
	category: "Sqs",
	event: [
		{
			type: "REST",
			method: "Post",
		},
	],
	desc: "desc",
	parameters: {},
	responses: {
		description: "",
	},
};

export async function lambdaHandler(event: APIGatewayProxyEvent) {
	console.log(event);

	console.log(JSON.stringify(event));
	return {
		statusCode: 200,
		body: JSON.stringify({}),
	};
}

export const handler = middy().handler(lambdaHandler);
