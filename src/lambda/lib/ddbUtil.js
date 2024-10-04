import { QueryCommand, ScanCommand, UpdateCommand, DeleteCommand, PutCommand } from '@aws-sdk/lib-dynamodb';

async function query(docClient, tableName, keys, keyvalues, options = {}) {
	let KeyConditionExpression = '';
	let ExpressionAttributeNames = {};
	let ExpressionAttributeValues = {};
	let ProjectionExpression = '';

	KeyConditionExpression = '#' + keys[0] + ' = ' + ':' + keys[0];
	ExpressionAttributeNames['#' + keys[0]] = keys[0];
	ExpressionAttributeValues[':' + keys[0]] = keyvalues[0];

	if (keys.length > 1) {
		if (options.lessThanRange) {
			KeyConditionExpression += ' AND #' + keys[1] + ' < ' + ':' + keys[1];
		} else {
			KeyConditionExpression += ' AND #' + keys[1] + ' = ' + ':' + keys[1];
		}
		ExpressionAttributeNames['#' + keys[1]] = keys[1];
		ExpressionAttributeValues[':' + keys[1]] = keyvalues[1];
	}

	if (options.hasOwnProperty('ProjectionExpression')) {
		let list = options['ProjectionExpression'];
		for (let i = 0; i < list.length; i++) {
			let ck = list[i];
			ExpressionAttributeNames['#' + ck] = ck;
			ProjectionExpression += '#' + ck + ',';
		}
		ProjectionExpression = ProjectionExpression.substr(0, ProjectionExpression.length - 1);
	}

	const params = {
		TableName: options.rawTableName ? tableName : getTableName(tableName),
		KeyConditionExpression,
		ExpressionAttributeNames,
		ExpressionAttributeValues,
	};

	if (options.hasOwnProperty('IndexName')) {
		params['IndexName'] = options.IndexName;
	}
	if (options.hasOwnProperty('ProjectionExpression')) {
		params['ProjectionExpression'] = ProjectionExpression;
	}
	if (options.hasOwnProperty('ConsistentRead')) {
		params['ConsistentRead'] = options.ConsistentRead;
	}
	if (options.hasOwnProperty('ScanIndexForward')) {
		params['ScanIndexForward'] = options.ScanIndexForward;
	}
	if (options.hasOwnProperty('Limit')) {
		params['Limit'] = options.Limit;
	}

	const queryCommand = new QueryCommand(params);
	return docClient.send(queryCommand);
}

async function scan(docClient, tableName) {
	const params = {
		TableName: getTableName(tableName),
	};

	const scanCommand = new ScanCommand(params);
	return docClient.send(scanCommand);
}

async function update(docClient, tableName, keyMap, keys, keyvalues, options = {}, ConditionKeys = undefined, ConditionValues = undefined) {
	let UpdateExpression = '';
	let ExpressionAttributeNames = {};
	let ExpressionAttributeValues = {};
	let ConditionExpression;

	UpdateExpression = 'set ';

	for (let i = 0; i < keys.length; i++) {
		let key = keys[i];
		let values = keyvalues[i];
		const sign = key.substr(0, 1);

		if (sign == '+') {
			//incremental
			key = key.substr(1, key.length - 1);
			const nextKey = keys[i + 1];

			UpdateExpression += '#' + key + ' = ' + '#' + key + ' + ' + ':' + nextKey + ' ,';
			ExpressionAttributeNames['#' + key] = key + '';

			ExpressionAttributeValues[':' + nextKey] = values;
			i++;
		} else if (sign == '-') {
			//decremental
			key = key.substr(1, key.length - 1);
			const nextKey = keys[i + 1];

			UpdateExpression += '#' + key + ' = ' + '#' + key + ' - ' + ':' + nextKey + ' ,';
			ExpressionAttributeNames['#' + key] = key + '';

			ExpressionAttributeValues[':' + nextKey] = values;
			i++;
		} else {
			UpdateExpression += '#' + key + ' = ' + ':' + key + ' ,';
			ExpressionAttributeNames['#' + key] = key + '';
			ExpressionAttributeValues[':' + key] = values;
		}
	}
	UpdateExpression = UpdateExpression.substr(0, UpdateExpression.length - 1);

	if (ConditionKeys != undefined) {
		ConditionExpression = '';
		for (let i = 0; i < ConditionKeys.length; i++) {
			let key = ConditionKeys[i];
			let values = ConditionValues[i];
			const sign = key.substr(0, 1);
			key = key.substr(1, key.length - 1);
			ConditionExpression += '#' + key + ' ' + sign + ' ' + ':' + key + ' ,';
			ExpressionAttributeNames['#' + key] = key + '';
			ExpressionAttributeValues[':' + key] = values;
		}
		ConditionExpression = ConditionExpression.substr(0, ConditionExpression.length - 1);
	}
	if (options.Remove) {
		UpdateExpression += ' Remove';
		options.Remove.forEach((element) => {
			UpdateExpression += ' ' + element;
		});
	}
	const params = {
		TableName: options.rawTableName ? tableName : getTableName(tableName),
		Key: keyMap,
		UpdateExpression,
		ExpressionAttributeNames,
		ExpressionAttributeValues,
		ReturnValues: options.returnValues ? 'UPDATED_NEW' : 'NONE',
	};
	if (ConditionExpression != undefined) {
		params['ConditionExpression'] = ConditionExpression;
	}

	const updateCommand = new UpdateCommand(params);
	return docClient.send(updateCommand);
}

async function doDelete(docClient, tableName, keyMap, options = {}) {
	const params = {
		TableName: options.rawTableName ? tableName : getTableName(tableName),
		Key: keyMap,
	};

	const deleteCommand = new DeleteCommand(params);
	return docClient.send(deleteCommand);
}

async function put(docClient, tableName, Item, options = {}) {
	const params = {
		TableName: options.rawTableName ? tableName : getTableName(tableName),
		Item: Item,
	};

	const putCommand = new PutCommand(params);
	return docClient.send(putCommand);
}

function getTableName(tableName) {
	return `${process.env.service}-${process.env.stage}-${tableName}-${process.env.version}`;
}

// Default export the entire object
export default {
	put,
	doDelete,
	update,
	query,
	scan,
};
