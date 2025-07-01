import { MySQLDataAPIUtil } from "./dataAPIUtil.js";
import { AwsCredentialIdentityProvider } from "@smithy/types";
let mysqlUtil: MySQLDataAPIUtil | null = null;

// Define the type for the exported object
export type mysqlUtil = {
    getOne: (tableName: string, attributes: string[], where: Record<string, any>, credential?: AwsCredentialIdentityProvider) => Promise<any | null>;
    getMany: (
        tableName: string,
        attributes: string[],
        findOptions: { where?: Record<string, any>; order?: [string, "asc" | "desc"][]; offset?: number; limit?: number },
        credential?: AwsCredentialIdentityProvider
    ) => Promise<any[]>;
    select: (tableName: string, condition: string, projection?: string, credential?: AwsCredentialIdentityProvider) => Promise<any>;
    create: (tableName: string, item: Record<string, any>, credential?: AwsCredentialIdentityProvider) => Promise<any>;
    update: (tableName: string, condition: string, updates: Record<string, any>, credential?: AwsCredentialIdentityProvider) => Promise<any>;
    update2: (tableName: string, updateObject: Record<string, any>, where: Record<string, any>, credential?: AwsCredentialIdentityProvider) => Promise<any>;
    delete: (tableName: string, condition: string | Record<string, any>, credential?: AwsCredentialIdentityProvider) => Promise<any>;
    deleteMany: (tableName: string, conditions?: Record<string, any>, credential?: AwsCredentialIdentityProvider) => Promise<any>;
    raw: (query: string, transactionId?: string, returnEmpty?: boolean, credential?: AwsCredentialIdentityProvider) => Promise<any[]>;
    upsert: (tableName: string, upsertObject: Record<string, any>, duplicateWhere: Record<string, any>, credential?: AwsCredentialIdentityProvider) => Promise<any>;
};

async function getNewDBInstance(credential?: AwsCredentialIdentityProvider): Promise<MySQLDataAPIUtil> {
    return await MySQLDataAPIUtil.create(
        credential,
        "ap-northeast-2",
        process.env.RDSARN!,
        process.env.RDS_SECRET_ARN!,
        `qnect_${process.env.stage}`,
    );
}

async function getOne(tableName: string, attributes: string[], where: Record<string, any>, credential?: AwsCredentialIdentityProvider): Promise<any | null> {
    mysqlUtil = mysqlUtil || await getNewDBInstance(credential)
    return await mysqlUtil.getOne(tableName, attributes, where);
}

async function getMany(
    tableName: string,
    attributes: string[],
    findOptions: { where?: Record<string, any>; order?: [string, "asc" | "desc"][]; offset?: number; limit?: number },
    credential?: AwsCredentialIdentityProvider
): Promise<any[]> {
    mysqlUtil = mysqlUtil || await getNewDBInstance(credential);
    return await mysqlUtil.getMany(tableName, attributes, findOptions);
}

async function select(tableName: string, condition: string, projection: string = "*", credential?: AwsCredentialIdentityProvider): Promise<any> {
    mysqlUtil = mysqlUtil || await getNewDBInstance(credential);
    return await mysqlUtil.select(tableName, condition, projection);
}

async function create(tableName: string, item: Record<string, any>, credential?: AwsCredentialIdentityProvider): Promise<any> {
    console.log("Creating");
    mysqlUtil = mysqlUtil || await getNewDBInstance(credential);
    return await mysqlUtil.create(tableName, item);
}

async function update(tableName: string, condition: string, updates: Record<string, any>, credential?: AwsCredentialIdentityProvider): Promise<any> {
    mysqlUtil = mysqlUtil || await getNewDBInstance(credential);
    return await mysqlUtil.update(tableName, condition, updates);
}

async function update2(tableName: string, updateObject: Record<string, any>, where: Record<string, any>, credential?: AwsCredentialIdentityProvider): Promise<any> {
    mysqlUtil = mysqlUtil || await getNewDBInstance(credential);
    return await mysqlUtil.update2(tableName, updateObject, where);
}

async function delete_(tableName: string, condition: string | Record<string, any>, credential?: AwsCredentialIdentityProvider): Promise<any> {
    mysqlUtil = mysqlUtil || await getNewDBInstance(credential);
    return await mysqlUtil.delete(tableName, condition);
}

async function deleteMany(tableName: string, conditions: Record<string, any> = {}, credential?: AwsCredentialIdentityProvider): Promise<any> {
    mysqlUtil = mysqlUtil || await getNewDBInstance(credential);
    return await mysqlUtil.deleteMany(tableName, conditions);
}

async function raw(query: string, transactionId?: string, returnEmpty?: boolean, credential?: AwsCredentialIdentityProvider): Promise<any[]> {
    mysqlUtil = mysqlUtil || await getNewDBInstance(credential);
    return await mysqlUtil.raw(query, transactionId, returnEmpty);
}

async function upsert(tableName: string, upsertObject: Record<string, any>, duplicateWhere: Record<string, any>, credential?: AwsCredentialIdentityProvider): Promise<any> {
    mysqlUtil = mysqlUtil || await getNewDBInstance(credential);
    return await mysqlUtil.upsert(tableName, upsertObject, duplicateWhere);
}

export default {
    getOne,
    getMany,
    select,
    create,
    update,
    update2,
    delete: delete_,  // Renamed to avoid collision with reserved keyword
    deleteMany,
    raw,
    upsert,
} as mysqlUtil;