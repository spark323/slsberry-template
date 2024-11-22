import { DynamoDBDocumentClient, QueryCommand, ScanCommand, UpdateCommand, DeleteCommand, PutCommand } from '@aws-sdk/lib-dynamodb';

interface IQueryOptions {
	ProjectionExpression?: string[];
	IndexName?: string;
	ConsistentRead?: boolean;
	ScanIndexForward?: boolean;
	Limit?: number;
	lessThanRange?: boolean;
	rawTableName?: boolean;
}

interface IUpdateOptions {
	Remove?: string[];
	rawTableName?: boolean;
	returnValues?: boolean;
}

async function query(
	docClient: DynamoDBDocumentClient,
	tableName: string,
	keys: string[],
	keyvalues: any[],
	options: IQueryOptions = {}
): Promise<any> {
	let KeyConditionExpression = '';
	let ExpressionAttributeNames: Record<string, string> = {};
	let ExpressionAttributeValues: Record<string, any> = {};
	let ProjectionExpression = '';

	KeyConditionExpression = `#${keys[0]} = :${keys[0]}`;
	ExpressionAttributeNames[`#${keys[0]}`] = keys[0];
	ExpressionAttributeValues[`:${keys[0]}`] = keyvalues[0];

	if (keys.length > 1) {
		if (options.lessThanRange) {
			KeyConditionExpression += ` AND #${keys[1]} < :${keys[1]}`;
		} else {
			KeyConditionExpression += ` AND #${keys[1]} = :${keys[1]}`;
		}
		ExpressionAttributeNames[`#${keys[1]}`] = keys[1];
		ExpressionAttributeValues[`:${keys[1]}`] = keyvalues[1];
	}

	if (options.ProjectionExpression) {
		ProjectionExpression = options.ProjectionExpression.map((ck) => {
			ExpressionAttributeNames[`#${ck}`] = ck;
			return `#${ck}`;
		}).join(',');
	}

	const params: any = {
		TableName: options.rawTableName ? tableName : getTableName(tableName),
		KeyConditionExpression,
		ExpressionAttributeNames,
		ExpressionAttributeValues,
	};

	if (options.IndexName) params.IndexName = options.IndexName;
	if (ProjectionExpression) params.ProjectionExpression = ProjectionExpression;
	if (options.ConsistentRead !== undefined) params.ConsistentRead = options.ConsistentRead;
	if (options.ScanIndexForward !== undefined) params.ScanIndexForward = options.ScanIndexForward;
	if (options.Limit !== undefined) params.Limit = options.Limit;

	const queryCommand = new QueryCommand(params);
	return docClient.send(queryCommand);
}

async function scan(docClient: DynamoDBDocumentClient, tableName: string): Promise<any> {
	const params = {
		TableName: getTableName(tableName),
	};

	const scanCommand = new ScanCommand(params);
	return docClient.send(scanCommand);
}

async function update(
	docClient: DynamoDBDocumentClient,
	tableName: string,
	keyMap: Record<string, any>,
	keys: string[],
	keyvalues: any[],
	options: IUpdateOptions = {},
	ConditionKeys?: string[],
	ConditionValues?: any[]
): Promise<any> {
	let UpdateExpression = 'set ';
	let ExpressionAttributeNames: Record<string, string> = {};
	let ExpressionAttributeValues: Record<string, any> = {};
	let ConditionExpression: string | undefined;

	for (let i = 0; i < keys.length; i++) {
		let key = keys[i];
		let value = keyvalues[i];
		const sign = key[0];

		if (sign === '+' || sign === '-') {
			key = key.substring(1);
			const nextKey = keys[++i];
			UpdateExpression += `#${key} = #${key} ${sign} :${nextKey},`;
			ExpressionAttributeNames[`#${key}`] = key;
			ExpressionAttributeValues[`:${nextKey}`] = value;
		} else {
			UpdateExpression += `#${key} = :${key},`;
			ExpressionAttributeNames[`#${key}`] = key;
			ExpressionAttributeValues[`:${key}`] = value;
		}
	}

	UpdateExpression = UpdateExpression.slice(0, -1);

	if (ConditionKeys && ConditionValues) {
		ConditionExpression = ConditionKeys
			.map((key, index) => {
				const sign = key[0];
				const trimmedKey = key.slice(1);
				ExpressionAttributeNames[`#${trimmedKey}`] = trimmedKey;
				ExpressionAttributeValues[`:${trimmedKey}`] = ConditionValues[index];
				return `#${trimmedKey} ${sign} :${trimmedKey}`;
			})
			.join(', ');
	}

	if (options.Remove) {
		UpdateExpression += ' REMOVE ' + options.Remove.join(', ');
	}

	const params: any = {
		TableName: options.rawTableName ? tableName : getTableName(tableName),
		Key: keyMap,
		UpdateExpression,
		ExpressionAttributeNames,
		ExpressionAttributeValues,
		ReturnValues: options.returnValues ? 'UPDATED_NEW' : 'NONE',
	};

	if (ConditionExpression) params.ConditionExpression = ConditionExpression;

	const updateCommand = new UpdateCommand(params);
	return docClient.send(updateCommand);
}

async function doDelete(
	docClient: DynamoDBDocumentClient,
	tableName: string,
	keyMap: Record<string, any>,
	options: { rawTableName?: boolean } = {}
): Promise<any> {
	const params = {
		TableName: options.rawTableName ? tableName : getTableName(tableName),
		Key: keyMap,
	};

	const deleteCommand = new DeleteCommand(params);
	return docClient.send(deleteCommand);
}

async function put(
	docClient: DynamoDBDocumentClient,
	tableName: string,
	Item: Record<string, any>,
	options: { rawTableName?: boolean } = {}
): Promise<any> {
	const params = {
		TableName: options.rawTableName ? tableName : getTableName(tableName),
		Item,
	};

	const putCommand = new PutCommand(params);
	return docClient.send(putCommand);
}

function getTableName(tableName: string): string {
	return `${process.env.service}-${process.env.stage}-${tableName}-${process.env.version}`;
}

export default {
	put,
	doDelete,
	update,
	query,
	scan,
};
