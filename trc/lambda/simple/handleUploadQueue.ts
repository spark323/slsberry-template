import middy from "@middy/core";
import sqsBatch from "@middy/sqs-partial-batch-failure";
import type { SQSEvent } from "aws-lambda";
import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { Base64 } from "js-base64";
import { DynamoDBClient, PutItemCommand, DeleteItemCommand } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import ddbUtil from "../libs/aws/ddbUtil.js";

import axios from "axios";
import moment from "moment";
import { nanoid } from "nanoid";
import { Readable } from "stream";
import sesUtilV2 from "../libs/aws/sesUtilV2.js";
import { SESv2Client } from "@aws-sdk/client-sesv2";
export const apiSpec = {
	hide: true,
	category: "Sqs",
	event: [
		{
			type: "sqs",
			sqs: `OriginUploadQueue`,
			batchSize: 1,
		},
	],
	desc: "S3 버킷에 파일이 올라오면,트리거 된 SQS를 이벤트 기반으로 파일을 가져와서 FashionSnap에 요청하는 로직을 처리",
	parameters: {},
	responses: {
		description: "",
	},
};

export async function lambdaHandler(event: SQSEvent) {
	console.log(event);
	const s3 = new S3Client({
		region: process.env.region,
	});

	for (const record of event.Records) {
		const body = JSON.parse(record.body);
		//우선 파일의 메타데이터를 가져온다.
		//메타데이터에 seq및 이메일 등 파일을 처리하기 위한 정보가 담겨있다.
		const headparams = {
			Bucket: body.bucket,
			Key: decodeURIComponent(body.key.replace(/\+/g, " ")),
		};
		const metadata = await s3.send(new HeadObjectCommand(headparams));
		//만약 메타데이터에 RequestID가 없다면, 샘플 이미지로 간주하고 sqs메세지 안에 들어있는 requestID를 사용
		const requestId = metadata.Metadata?.request_id || body.requestId;
		const dynamoDBClient = new DynamoDBClient({
			region: "ap-northeast-2",
		});
		const docClient = DynamoDBDocumentClient.from(dynamoDBClient);

		let data = await ddbUtil.query(docClient, `${process.env.service}-${process.env.stage}-demo-request`, ["request_id"], [requestId], {
			rawTableName: true,
		});

		if (data.Items.length === 0) {
			console.log("invalid data:", requestId, ",", body.key);
			return;
		}

		let dateItem = data.Items[0];

		const comment = dateItem.comment;
		const totalNum = dateItem.total_num;
		const gender = dateItem.gender;
		const email = dateItem.email;
		const org_file_name = dateItem.org_file_name;
		const fileSize = metadata.ContentLength;
		const height = dateItem.height;
		const width = dateItem.width;
		const ethnicity = dateItem.ethnicity;
		const age = dateItem.age;

		const STATUS_CALLBACK_URL = `https://${process.env.api_gateway_id}.execute-api.${process.env.region}.amazonaws.com/${process.env.stage}/callback`;

		const payloadParm = {
			size: fileSize,
			org_file_name: org_file_name,
			gender: gender,
			ethnicity: ethnicity,
			age: age,
			cfg: 3.5,
			height: height,
			width: width,
			customer_name: "reconlabs",
			project_name: "fs-demo",
			product_id: requestId,
			client_id: "fashionsnap-demo",
			callback_url: STATUS_CALLBACK_URL,
		};
		console.log(payloadParm);

		const getOriginFileParm = {
			Bucket: body.bucket,
			Key: decodeURIComponent(body.key.replace(/\+/g, " ")),
		};
		console.log(getOriginFileParm);

		const getOriginCommand = new GetObjectCommand(getOriginFileParm);
		const originDataFileStream = await s3.send(getOriginCommand);

		const originFileBuffer = await streamToBuffer(originDataFileStream.Body as Readable);

		for (let i = 0; i < totalNum; i++) {
			const s3SignedUrlData = await axios({
				method: "GET",
				url: `${process.env.fashionsnapAPI}/dev/task/fsdemo`,
				params: payloadParm,
			});
			console.log(s3SignedUrlData);
			const seq = s3SignedUrlData.data.seq;
			const url = s3SignedUrlData.data.url;

			await axios.put(url, originFileBuffer);

			//업로드 성공 횟수 추가
			await ddbUtil.update(
				docClient,
				`${process.env.service}-${process.env.stage}-demo-request`,
				{ request_id: requestId },
				["+fs_requested", "val"],
				[1],
				{
					rawTableName: true,
				}
			);

			await ddbUtil.put(
				docClient,
				`${process.env.service}-${process.env.stage}-fs-request`,
				{
					seq: seq,
					request_id: requestId,
					status: "created",
					email: email,
					datetime: moment().format("YYYY-MM-DD HH:mm:ss"),
					org_file_name: org_file_name,
				},
				{
					rawTableName: true,
				}
			);
		}
		console.log("test done");

		await sesUtilV2.sendRequestEmail(
			new SESv2Client({ region: "ap-northeast-2" }),
			[email],
			JSON.stringify({
				email: email,
				comment: comment,
			})
		);
	}
	return {
		statusCode: 200,
		body: JSON.stringify({}),
	};
}
const streamToBuffer = (stream: Readable): Promise<Buffer> => {
	return new Promise((resolve, reject) => {
		const chunks: Uint8Array[] = [];
		stream.on("data", (chunk: Uint8Array) => chunks.push(chunk));
		stream.on("end", () => resolve(Buffer.concat(chunks)));
		stream.on("error", reject);
	});
};
export const handler = middy().handler(lambdaHandler);
