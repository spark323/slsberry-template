// import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";
// import mysql, { Connection } from "mysql2/promise";
// import { AwsCredentialIdentityProvider } from "@smithy/types";
// // Global Connection Management
// let globalConnection: { db: Connection | null; createdAt: number } = { db: null, createdAt: 0 };
// const CONNECTION_TIMEOUT = 10 * 60 * 1000; // 10 minutes

// // Clear the global connection
// function clearConnection(): void {
//   if (globalConnection.db) {
//     globalConnection.db.end();
//     globalConnection.db = null;
//   }
// }

// // Get or create a new MySQL connection
// async function getConnection(crednetials?: AwsCredentialIdentityProvider): Promise<Connection> {
//   const now = Date.now();
//   if (globalConnection.db && now - globalConnection.createdAt < CONNECTION_TIMEOUT) {
//     return globalConnection.db;
//   }

//   clearConnection();

//   const secretsClient = new SecretsManagerClient({
//     credentials: crednetials,
//     region: process.env.region,
//   });
//   const secretId = process.env.RDS_SECRET_ID || "";
//   const command = new GetSecretValueCommand({ SecretId: secretId });

//   const { SecretString } = await secretsClient.send(command);
//   if (!SecretString) throw new Error("SecretString is empty");

//   const secret = JSON.parse(SecretString);
//   const { username, password, host, port } = secret;

//   const dbInfo = {
//     host: process.env.RDS_DB_HOST,
//     user: username,
//     password: password,
//     port: 3306,
//     database: process.env.RDS_DB_NAME || "",
//   };

//   const connection = await mysql.createConnection(dbInfo);
//   globalConnection = { db: connection, createdAt: now };
//   return connection;
// }

// // Query Utilities
// async function queryDirect(query: string, crednetials?: AwsCredentialIdentityProvider): Promise<any> {
//   const connection = await getConnection(crednetials);
//   try {
//     console.log(query);
//     const [rows] = await connection.query(query);
//     return rows;
//   } catch (e) {
//     throw e;
//   }
// }

// async function query(query: string, crednetials?: AwsCredentialIdentityProvider): Promise<{ records: any }> {
//   const connection = await getConnection(crednetials);
//   try {
//     console.log(query);
//     const [rows] = await connection.query(query);
//     return { records: rows };
//   } catch (e) {
//     throw e;
//   }
// }

// // SELECT
// async function select(
//   tableName: string,
//   _condition: string,
//   projection: string = "*",
//   crednetials?: AwsCredentialIdentityProvider,
// ): Promise<{ records: any }> {
//   const queryStr = `SELECT ${projection} FROM ${tableName} WHERE ${_condition}`;
//   console.log(queryStr);
//   return await query(queryStr);
// }

// // UPDATE
// async function update(
//   tableName: string,
//   condition: string,
//   keys: string[],
//   keyvalues: any[],
//   crednetials?: AwsCredentialIdentityProvider,
// ): Promise<{ records: any }> {
//   let values = "SET ";
//   keys.forEach((key, i) => {
//     if (key.startsWith("+")) values += `${key.substring(1)} = ${key.substring(1)} + ?, `;
//     else if (key.startsWith("-")) values += `${key.substring(1)} = ${key.substring(1)} - ?, `;
//     else if (key.startsWith("*")) values += `${key.substring(1)} = NOW(), `;
//     else values += `${key} = ?, `;
//   });

//   values = values.slice(0, -2);
//   const queryStr = `UPDATE ${tableName} ${values} WHERE ${condition}`;
//   console.log(queryStr, keyvalues);

//   const connection = await getConnection(crednetials);
//   try {
//     const [rows] = await connection.query(queryStr, keyvalues);
//     return { records: rows };
//   } catch (e) {
//     throw e;
//   }
// }

// // DELETE
// async function doDelete(
//   tableName: string,
//   _condition: string,
//   crednetials?: AwsCredentialIdentityProvider,
// ): Promise<{ records: any }> {
//   const queryStr = `DELETE FROM ${tableName} WHERE ${_condition}`;
//   console.log(queryStr);
//   return await query(queryStr);
// }

// // INSERT
// async function put(
//   tableName: string,
//   item: Record<string, any>,
//   crednetials?: AwsCredentialIdentityProvider,
// ): Promise<{ records: any }> {
//   const keys = Object.keys(item).join(", ");
//   const values = Object.keys(item)
//     .map(() => "?")
//     .join(", ");
//   const queryStr = `INSERT INTO ${tableName} (${keys}) VALUES (${values})`;
//   const params = Object.values(item);

//   console.log(queryStr, params);
//   const connection = await getConnection(crednetials);
//   try {
//     const [rows] = await connection.query(queryStr, params);
//     return { records: rows };
//   } catch (e) {
//     throw e;
//   }
// }

// // Module Exports
// export default { put, doDelete, update, select, query, queryDirect };
