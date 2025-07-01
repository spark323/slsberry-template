import {
    RDSDataClient,
    ExecuteStatementCommand,
} from "@aws-sdk/client-rds-data";
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";
import { AwsCredentialIdentityProvider } from "@smithy/types";

class MySQLDataAPIUtil {
    private rdsClient: RDSDataClient;

    private database: string;
    private rdsArn: string;
    private secretArn: string;

    private constructor(
        rdsClient: RDSDataClient,
        rdsArn: string,
        secretArn: string,
        database: string,
    ) {
        this.rdsClient = rdsClient;


        this.rdsArn = rdsArn;
        this.secretArn = secretArn;
        this.database = database;

    }

    static async create(
        awsCredentials: AwsCredentialIdentityProvider | undefined,
        region: string,
        rdsArn: string,
        secretArn: string,
        database: string
    ): Promise<MySQLDataAPIUtil> {
        const rdsClient = new RDSDataClient({ credentials: awsCredentials, region });
        return new MySQLDataAPIUtil(rdsClient, rdsArn, secretArn, database);
    }
    private async executeSQL(sql: string, parameters: any[] = [], transactionId?: string, returnEmpty?: boolean): Promise<any> {
        console.log("Executing SQL (Parameterized):", sql);

        const sqlParams = parameters.map((param) => ({
            name: param.name,
            value:
                param.value === null || param.value === undefined
                    ? { isNull: true } // Handle null/undefined
                    : typeof param.value === "number"
                        ? Number.isInteger(param.value)
                            ? { longValue: param.value } // Integer values
                            : { doubleValue: param.value } // Float/double values
                        : typeof param.value === "boolean"
                            ? { booleanValue: param.value }
                            : param.value instanceof Buffer
                                ? { blobValue: param.value }
                                : { stringValue: String(param.value) },
        }));

        // Generate and log raw SQL with actual values (for debugging)
        let rawSql = sql;
        parameters.forEach((param) => {
            const value =
                param.value === null || param.value === undefined
                    ? "NULL"
                    : typeof param.value === "string"
                        ? `'${param.value}'`
                        : param.value;
            rawSql = rawSql.replace(`:${param.name}`, String(value));
        });

        console.log("Raw SQL (Debugging Only, Not Executed):", rawSql);
        console.log("SQL Parameters:", sqlParams);

        const command = new ExecuteStatementCommand({
            resourceArn: this.rdsArn,
            secretArn: this.secretArn,
            database: this.database,
            sql,
            includeResultMetadata: true,
            parameters: sqlParams,
            transactionId,
        });

        const response = await this.rdsClient.send(command);

        if (!response.records || response.records.length === 0) return returnEmpty ? [] : response;

        return response.records.map((row) => {
            const formattedRow: Record<string, any> = {};
            row.forEach((col, index) => {
                const columnName = response.columnMetadata?.[index]?.label || `col${index}`;
                formattedRow[columnName] =
                    col.isNull !== undefined
                        ? null // Handle null values
                        : col.stringValue ?? col.longValue ?? col.doubleValue ?? col.booleanValue ?? col.blobValue ?? null;
            });
            return formattedRow;
        });
    }



    async select(tableName: string, condition: string, projection: string = "*"): Promise<any> {
        return await this.executeSQL(`SELECT ${projection} FROM ${tableName} WHERE ${condition}`);
    }
    async create(tableName: string, item: Record<string, any> | Record<string, any>[]): Promise<any> {
        // Handle batch insert if item is an array
        if (Array.isArray(item) && item.length > 0) {
            console.log(`Batch inserting ${item.length} items into ${tableName}`);

            if (item.length === 0) {
                return [];
            }

            // Get column names from the first item
            const keys = Object.keys(item[0]);

            // Prepare values placeholders for all rows
            const rowsPlaceholders = item.map((_, rowIndex) =>
                `(${keys.map((_, colIndex) => `:param${rowIndex}_${colIndex}`).join(", ")})`
            ).join(", ");

            // Process values to stringify JSON objects
            const processedItems = item.map(rowItem => {
                const processedRow: Record<string, any> = {};
                Object.keys(rowItem).forEach(key => {
                    const value = rowItem[key];
                    // Check if value is an object (but not null, Date, or Buffer) and stringify it
                    if (value !== null && typeof value === 'object' && !(value instanceof Date) && !(value instanceof Buffer)) {
                        processedRow[key] = JSON.stringify(value);
                    } else {
                        processedRow[key] = value;
                    }
                });
                return processedRow;
            });            // Prepare parameters for all values
            let params: Array<{ name: string; value: any }> = [];
            processedItems.forEach((rowItem, rowIndex) => {
                keys.forEach((key, colIndex) => {
                    // Skip null values entirely
                    if (rowItem[key] !== null && rowItem[key] !== undefined) {
                        params.push({
                            name: `param${rowIndex}_${colIndex}`,
                            value: rowItem[key]
                        });
                    }
                });
            });

            const query = `INSERT INTO ${tableName} (${keys.join(", ")}) VALUES ${rowsPlaceholders}`;

            console.log(`Executing batch insert query: ${query}`);

            const result = await this.executeSQL(query, params);

            // Extract generated IDs if available
            if (result && result.generatedFields) {
                const ids = result.generatedFields.map((field: any) =>
                    field.longValue || field.stringValue || null
                );
                return ids.length > 0 ? ids : result;
            }

            return result;
        }
        // Handle single item insert (original functionality)
        else {
            const singleItem = item as Record<string, any>;

            // Process values to stringify JSON objects
            const processedItem: Record<string, any> = {};
            Object.keys(singleItem).forEach(key => {
                const value = singleItem[key];
                // Check if value is an object (but not null, Date, or Buffer) and stringify it
                if (value !== null && typeof value === 'object' && !(value instanceof Date) && !(value instanceof Buffer)) {
                    processedItem[key] = JSON.stringify(value);
                } else {
                    processedItem[key] = value;
                }
            });

            // Filter out null and undefined values
            const nonNullKeys = Object.keys(singleItem).filter(key =>
                processedItem[key] !== null && processedItem[key] !== undefined
            );

            // Create parameters only for non-null values
            const params = nonNullKeys.map((key, i) => ({
                name: `param${i}`,
                value: processedItem[key]
            }));

            // Create placeholders for SQL
            const valuePlaceholders = nonNullKeys.map((_, i) => `:param${i}`).join(", ");

            const result = await this.executeSQL(
                `INSERT INTO ${tableName} (${nonNullKeys.join(", ")}) VALUES (${valuePlaceholders})`,
                params
            );

            // Extract the generated ID similar to how dsqlUtilold.js returns it
            if (result && result.generatedFields && result.generatedFields.length > 0) {
                // Extract the first generated field (usually the ID)
                const id = result.generatedFields[0].longValue ||
                    result.generatedFields[0].stringValue ||
                    null;

                // Return in a format similar to dsqlUtilold.js for compatibility
                return [id];
            }

            return result;
        }
    }

    async update(tableName: string, condition: string, updates: Record<string, any>): Promise<any> {
        const setClause = Object.keys(updates).map((key, i) => `${key} = :param${i}`).join(", ");
        const params = Object.keys(updates).map((key, i) => ({ name: `param${i}`, value: updates[key] }));
        return await this.executeSQL(`UPDATE ${tableName} SET ${setClause} WHERE ${condition}`, params);
    }
    async update2(tableName: string, updateObject: Record<string, any>, where: Record<string, any>): Promise<any> {
        console.log(`update2() table: ${tableName}, updateObject: ${JSON.stringify(updateObject)}, where: ${JSON.stringify(where)}`);

        if (Object.keys(updateObject).length === 0 || Object.keys(where).length === 0) {
            throw new Error("update2: Update object and where condition cannot be empty.");
        }

        let queryStr = `UPDATE ${tableName} SET `;
        let params: { name: string; value: any }[] = [];

        // Construct SET clause - Handle null values appropriately
        let updateParamCounter = 0;
        queryStr += Object.keys(updateObject)
            .filter(key => updateObject[key] !== undefined) // Exclude keys with undefined values
            .map((key) => {
                // Handle null values directly in SQL
                if (updateObject[key] === null) {
                    return `${key} = NULL`;
                }
                // For non-null values, use a parameter
                return `${key} = :updateParam${updateParamCounter++}`;
            })
            .join(", ");

        // Add parameters for non-null values in SET clause
        let updateParamIndex = 0;
        Object.entries(updateObject)
            .filter(([key, value]) => value !== undefined && value !== null)
            .forEach(([key, value]) => {
                params.push({
                    name: `updateParam${updateParamIndex++}`,
                    value: value
                });
            });

        // Construct WHERE clause - Handle null values properly
        let whereParamCounter = 0;
        const whereClauses = Object.keys(where).map((key) => {
            // Handle null values with IS NULL
            if (where[key] === null) {
                return `${key} IS NULL`;
            }
            return `${key} = :whereParam${whereParamCounter++}`;
        });

        queryStr += ` WHERE ${whereClauses.join(" AND ")}`;

        // Add parameters for non-null values in WHERE clause
        let whereParamIndex = 0;
        Object.entries(where)
            .filter(([_, value]) => value !== null)
            .forEach(([key, value]) => {
                params.push({
                    name: `whereParam${whereParamIndex++}`,
                    value: value
                });
            });

        console.log(`Executing update2 query: ${queryStr}`, params);
        return await this.executeSQL(queryStr, params);
    }


    async delete(tableName: string, condition: string | Record<string, any>): Promise<any> {
        if (typeof condition === 'string') {
            return await this.executeSQL(`DELETE FROM ${tableName} WHERE ${condition}`);
        } else {
            // Filter out keys with undefined values
            const filteredCondition = Object.fromEntries(
                Object.entries(condition).filter(([_, value]) => value !== undefined)
            );

            let queryStr = `DELETE FROM ${tableName}`;
            let params: { name: string; value: any }[] = [];

            if (Object.keys(filteredCondition).length > 0) {
                // First, create the WHERE clauses with correct parameter indices
                let paramCounter = 0;
                const whereClauses = Object.keys(filteredCondition).map((key) => {
                    // Handle null values with IS NULL instead of = NULL
                    if (filteredCondition[key] === null) {
                        return `${key} IS NULL`;
                    }
                    // For non-null values, use a parameter with the current counter and increment
                    return `${key} = :param${paramCounter++}`;
                });

                queryStr += ` WHERE ` + whereClauses.join(" AND ");

                // Now create parameters with consecutive indices for non-null values only
                params = [];
                let paramIndex = 0;

                Object.entries(filteredCondition).forEach(([key, value]) => {
                    if (value !== null) {
                        params.push({
                            name: `param${paramIndex++}`,
                            value: value
                        });
                    }
                });
            }

            return await this.executeSQL(queryStr, params);
        }
    }

    async deleteMany(tableName: string, conditions: Record<string, any> = {}): Promise<any> {
        let queryStr = `DELETE FROM ${tableName}`;
        let params: { name: string; value: any }[] = [];

        if (Object.keys(conditions).length > 0) {
            // Filter out keys with undefined values
            const filteredConditions = Object.fromEntries(
                Object.entries(conditions).filter(([_, value]) => value !== undefined)
            );

            if (Object.keys(filteredConditions).length > 0) {
                // First, create the WHERE clauses with correct parameter indices
                let paramCounter = 0;
                const whereClauses = Object.keys(filteredConditions).map((key) => {
                    // Handle null values with IS NULL instead of = NULL
                    if (filteredConditions[key] === null) {
                        return `${key} IS NULL`;
                    }
                    // For non-null values, use a parameter with the current counter and increment
                    return `${key} = :param${paramCounter++}`;
                });

                queryStr += ` WHERE ` + whereClauses.join(" AND ");

                // Now create parameters with consecutive indices for non-null values only
                params = [];
                let paramIndex = 0;

                Object.entries(filteredConditions).forEach(([key, value]) => {
                    if (value !== null) {
                        params.push({
                            name: `param${paramIndex++}`,
                            value: value
                        });
                    }
                });
            }
        }

        return await this.executeSQL(queryStr, params);
    }

    async getOne(tableName: string, attributes: string[], where: Record<string, any>): Promise<any | null> {
        const selectClause = attributes.length > 0 ? attributes.join(", ") : "*";
        let queryStr = `SELECT ${selectClause} FROM ${tableName}`;
        // Filter out keys with undefined values
        const filteredWhere = Object.fromEntries(Object.entries(where).filter(([_, value]) => value !== undefined));
        let params: any[] | undefined = [];
        let paramIndex = 0;

        if (Object.keys(filteredWhere).length > 0) {
            const whereClauses = Object.keys(filteredWhere).map((key) => {
                const value = filteredWhere[key];
                if (Array.isArray(value)) {
                    // Handle IN conditions for arrays
                    const inParams = value.map((_, i) => `:param${paramIndex + i}`).join(', ');
                    const clause = `${key} IN (${inParams})`;
                    value.forEach((val, i) => {
                        params.push({
                            name: `param${paramIndex + i}`,
                            value: val
                        });
                    });
                    paramIndex += value.length;
                    return clause;
                } else if (value === null) {
                    // Handle NULL values with IS NULL
                    return `${key} IS NULL`;
                } else {
                    // Handle simple equality for non-null values
                    const clause = `${key} = :param${paramIndex}`;
                    params.push({
                        name: `param${paramIndex}`,
                        value: value,
                    });
                    paramIndex++;
                    return clause;
                }
            });
            queryStr += ` WHERE ` + whereClauses.join(" AND ");
        }

        queryStr += ` LIMIT 1`;
        const result = await this.executeSQL(queryStr, params, undefined, true);
        return result.length > 0 ? result[0] : null;
    }

    async getMany(
        tableName: string,
        attributes: string[],
        findOptions: { where?: Record<string, any>; order?: [string, "asc" | "desc"][]; offset?: number; limit?: number }
    ): Promise<any[]> {
        const selectClause = attributes.length > 0 ? attributes.join(", ") : "*";
        let queryStr = `SELECT ${selectClause} FROM ${tableName}`;
        let params = [];
        let paramIndex = 0;
        // WHERE conditions
        if (findOptions.where && Object.keys(findOptions.where).length > 0) {
            // Filter out keys with undefined values
            const filteredWhere = Object.fromEntries(Object.entries(findOptions.where).filter(([_, value]) => value !== undefined));
            if (Object.keys(filteredWhere).length > 0) {
                const whereClauses = Object.keys(filteredWhere).map((key) => {
                    const value = filteredWhere[key]; if (Array.isArray(value)) {
                        // Handle IN conditions for arrays
                        console.log(`IN condition for key: ${key}, values: ${value}`);
                        const inParams = value.map((_, i) => `:param${paramIndex + i}`).join(', ');
                        const clause = `${key} IN (${inParams})`;
                        value.forEach((val, i) => {
                            params.push({
                                name: `param${paramIndex + i}`,
                                value: val
                            });
                        });
                        paramIndex += value.length;
                        return clause;
                    } else if (value === null) {
                        // Handle NULL values with IS NULL
                        return `${key} IS NULL`;
                    } else {
                        // Handle simple equality for non-null values
                        const clause = `${key} = :param${paramIndex}`;
                        params.push({
                            name: `param${paramIndex}`,
                            value: value,
                        });
                        paramIndex++;
                        return clause;
                    }
                });
                queryStr += ` WHERE ` + whereClauses.join(" AND ");
            }
        }
        // ORDER BY clause
        if (findOptions.order) {
            const orderByClause = findOptions.order.map(([col, direction]) => `${col} ${direction}`).join(", ");
            queryStr += ` ORDER BY ${orderByClause}`;
        }
        // LIMIT and OFFSET
        if (findOptions.limit !== undefined) {
            queryStr += ` LIMIT :limit`;
            params.push({ name: "limit", value: findOptions.limit });
        }
        if (findOptions.offset !== undefined) {
            queryStr += ` OFFSET :offset`;
            params.push({ name: "offset", value: findOptions.offset });
        }
        console.log(queryStr, params);

        return await this.executeSQL(queryStr, params, undefined, true);
    }


    async raw(query: string, transactionId?: string, returnEmpty?: boolean): Promise<any[]> {
        return await this.executeSQL(query, [], transactionId, returnEmpty);
    }

    async upsert(tableName: string, upsertObject: Record<string, any>, duplicateWhere: Record<string, any>): Promise<any> {
        const exist = await this.getOne(tableName, [], duplicateWhere);
        return exist
            ? await this.update2(tableName, upsertObject, duplicateWhere)
            : await this.create(tableName, upsertObject);
    }
}

export { MySQLDataAPIUtil };
