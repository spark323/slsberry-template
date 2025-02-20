import {
    RDSDataClient,
    ExecuteStatementCommand,
} from "@aws-sdk/client-rds-data";
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";
import { AwsCredentialIdentityProvider } from "@smithy/types";

class MySQLDataAPIUtil {
    private rdsClient: RDSDataClient;
    private secretsClient: SecretsManagerClient;
    private dbCredentials: any;
    private region: string;
    private database: string;
    private rdsArn: string;
    private secretArn: string;

    private constructor(
        rdsClient: RDSDataClient,
        secretsClient: SecretsManagerClient,
        region: string,
        rdsArn: string,
        secretArn: string,
        database: string,
        dbCredentials: any
    ) {
        this.rdsClient = rdsClient;
        this.secretsClient = secretsClient;
        this.region = region;
        this.rdsArn = rdsArn;
        this.secretArn = secretArn;
        this.database = database;
        this.dbCredentials = dbCredentials;
    }

    static async create(
        awsCredentials: AwsCredentialIdentityProvider | undefined,
        region: string,
        rdsArn: string,
        secretArn: string,
        database: string
    ): Promise<MySQLDataAPIUtil> {
        const rdsClient = new RDSDataClient({ credentials: awsCredentials, region });
        const secretsClient = new SecretsManagerClient({ credentials: awsCredentials, region });
        const dbCredentials = await MySQLDataAPIUtil.loadDBCredentials(secretsClient, secretArn);
        return new MySQLDataAPIUtil(rdsClient, secretsClient, region, rdsArn, secretArn, database, dbCredentials);
    }

    private static async loadDBCredentials(secretsClient: SecretsManagerClient, secretArn: string): Promise<any> {
        const command = new GetSecretValueCommand({ SecretId: secretArn });
        const { SecretString } = await secretsClient.send(command);
        if (!SecretString) throw new Error("SecretString is empty");
        return JSON.parse(SecretString);
    }

    private async executeSQL(sql: string, parameters: any[] = [], transactionId?: string, returnEmpty?: boolean): Promise<any> {
        console.log("Executing SQL (Parameterized):", sql);

        const sqlParams = parameters.map((param) => ({
            name: param.name,
            value:
                typeof param.value === "number"
                    ? { longValue: param.value }
                    : typeof param.value === "boolean"
                        ? { booleanValue: param.value }
                        : param.value instanceof Buffer
                            ? { blobValue: param.value }
                            : { stringValue: String(param.value) },
        }));

        // Generate and log raw SQL with actual values (for debugging)
        let rawSql = sql;
        parameters.forEach((param) => {
            const value = typeof param.value === "string" ? `'${param.value}'` : param.value;
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
        if (!response.records || response.records.length === 0) return (returnEmpty) ? [] : response;

        return response.records.map((row) => {
            const formattedRow: Record<string, any> = {};
            row.forEach((col, index) => {
                const columnName = response.columnMetadata?.[index]?.label || `col${index}`;
                formattedRow[columnName] =
                    col.stringValue ?? col.longValue ?? col.doubleValue ?? col.booleanValue ?? col.blobValue ?? null;
            });
            return formattedRow;
        });
    }


    async select(tableName: string, condition: string, projection: string = "*"): Promise<any> {
        return await this.executeSQL(`SELECT ${projection} FROM ${tableName} WHERE ${condition}`);
    }

    async create(tableName: string, item: Record<string, any>): Promise<any> {
        const keys = Object.keys(item).join(", ");
        const values = Object.values(item).map((_, i) => `:param${i}`).join(", ");
        const params = Object.keys(item).map((key, i) => ({ name: `param${i}`, value: item[key] }));
        return await this.executeSQL(`INSERT INTO ${tableName} (${keys}) VALUES (${values})`, params);
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

        // Construct SET clause
        queryStr += Object.keys(updateObject)
            .map((key, i) => `${key} = :updateParam${i}`)
            .join(", ");

        Object.keys(updateObject).forEach((key, i) => {
            params.push({ name: `updateParam${i}`, value: updateObject[key] });
        });

        // Construct WHERE clause
        const whereClause = Object.keys(where)
            .map((key, i) => `${key} = :whereParam${i}`)
            .join(" AND ");

        queryStr += ` WHERE ${whereClause}`;

        Object.keys(where).forEach((key, i) => {
            params.push({ name: `whereParam${i}`, value: where[key] });
        });

        console.log(`Executing update2 query: ${queryStr}`, params);
        return await this.executeSQL(queryStr, params);
    }


    async deleteMany(tableName: string, conditions: Record<string, any> = {}): Promise<any> {
        let queryStr = `DELETE FROM ${tableName}`;
        let params: { name: string; value: any }[] = [];

        if (Object.keys(conditions).length > 0) {
            const whereClause = Object.keys(conditions)
                .map((key, i) => `${key} = :param${i}`)
                .join(" AND ");
            queryStr += ` WHERE ${whereClause}`;
            params = Object.keys(conditions).map((key, i) => ({ name: `param${i}`, value: conditions[key] }));
        }

        return await this.executeSQL(queryStr, params);
    }

    async getOne(tableName: string, attributes: string[], where: Record<string, any>): Promise<any | null> {
        const selectClause = attributes.length > 0 ? attributes.join(", ") : "*";
        let queryStr = `SELECT ${selectClause} FROM ${tableName} WHERE `;
        const whereClause = Object.keys(where)
            .map((key, i) => `${key} = :param${i}`)
            .join(" AND ");
        queryStr += `${whereClause} LIMIT 1`;
        const params = Object.keys(where).map((key, i) => ({ name: `param${i}`, value: where[key] }));
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
        let params: { name: string; value: any }[] = [];

        // WHERE conditions
        if (findOptions.where && Object.keys(findOptions.where).length > 0) {
            const whereClauses = Object.keys(findOptions.where).map((key, i) => `${key} = :param${i}`);
            queryStr += ` WHERE ` + whereClauses.join(" AND ");

            params = Object.keys(findOptions.where).map((key, i) => ({
                name: `param${i}`,
                value: findOptions.where![key],
            }));
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


    async raw(query: string): Promise<any[]> {
        return await this.executeSQL(query);
    }

    async upsert(tableName: string, upsertObject: Record<string, any>, duplicateWhere: Record<string, any>): Promise<any> {
        const exist = await this.getOne(tableName, [], duplicateWhere);
        return exist
            ? await this.update(tableName, Object.keys(duplicateWhere).map((key) => `${key} = '${duplicateWhere[key]}'`).join(" AND "), upsertObject)
            : await this.create(tableName, upsertObject);
    }
}

export { MySQLDataAPIUtil };
