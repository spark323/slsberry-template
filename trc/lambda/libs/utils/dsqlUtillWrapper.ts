import knex, { Knex } from 'knex';
import { DsqlSigner } from "@aws-sdk/dsql-signer";
import { AwsCredentialIdentityProvider } from "@aws-sdk/types";


let db: Knex | null = null;
async function generateToken(credential?: AwsCredentialIdentityProvider) {
  console.log("Generating token for DSQL connection...");
  console.log(credential);
  let dsqlObject: any = {
    hostname: process.env.dsql_endpoint,
    region: process.env.region
  }
  if (credential) {
    dsqlObject = {
      ...dsqlObject,
      credentials: credential,
    }
  }
  const signer = new DsqlSigner(dsqlObject);
  try {
    // Use `getDbConnectAuthToken` if you are _not_ logging in as the `admin` user
    const token = await signer.getDbConnectAdminAuthToken();
    console.log(token);
    return token;
  } catch (error) {
    console.log("Failed to generate token: ", error);
    throw error;
  }
}
async function getNewDBInstance(credential?: AwsCredentialIdentityProvider): Promise<Knex> {
  let newDB: Knex;

  const token = await generateToken(credential);


  newDB = knex({
    client: 'pg',
    connection: {
      host: process.env.dsql_endpoint,
      user: 'admin',
      password: token,
      port: 5432,
      database: 'postgres',
      ssl: { rejectUnauthorized: false },
    }
  });

  return newDB;
}

// Password rotation 시 자동으로 새 DB 연결을 받아와서 재시도
async function safeQueryPromise(queryPromise: any, credential?: AwsCredentialIdentityProvider): Promise<any> {

  console.log('query:', queryPromise.toString());
  try {
    return await queryPromise;
  } catch (error: any) {
    console.log('safeQueryPromise error', error);
    if (error.code === '28P01' || error.code === 'ECONNREFUSED' || error.code == '08006') { // PostgreSQL access denied errors
      db = await getNewDBInstance(credential);
      const query = queryPromise.toString();
      const result = await db!.raw(query);
      return result.rows;
    } else {
      throw error;
    }
  }
}

async function raw(query: string, transactionId?: string, returnEmpty?: boolean, credential?: AwsCredentialIdentityProvider): Promise<any> {
  db = db || (await getNewDBInstance(credential));
  console.log(`postgresql raw() : ${query}`);
  let queryPromise = db.raw(query);
  const result = await safeQueryPromise(queryPromise, credential);
  console.log(`postgresql raw result: `, result);
  return result.rows || (returnEmpty ? [] : undefined);
}

async function create(table: string, createObject: Record<string, any>, credential?: AwsCredentialIdentityProvider): Promise<any> {
  db = db || (await getNewDBInstance(credential));
  console.log(`postgresql create() table: ${table}, createObject: ${JSON.stringify(createObject)}`);
  let queryPromise = db.insert(createObject).into(table);
  const rows = await safeQueryPromise(queryPromise, credential);
  console.log(`postgresql create() rows: ${JSON.stringify(rows)}`);
  return rows;
}

async function getOne(
  table: string,
  attributes: Array<string>,
  where: { [key: string]: any },
  credential?: AwsCredentialIdentityProvider
): Promise<{ [key: string]: any }> {
  db = db || (await getNewDBInstance(credential));
  console.log(`postgresql getOne() table: ${table}, attrs: ${attributes}, where: ${JSON.stringify(where)}`);
  let queryPromise = db
    .select(...attributes)
    .from(table)
    .limit(1)
    .where((builder: any) => {
      for (const filter of Object.entries(where)) {
        builder = Array.isArray(filter[1])
          ? builder.whereIn(filter[0], filter[1])
          : builder.where(filter[0], filter[1]);
      }
    });
  const rows = await safeQueryPromise(queryPromise, credential);
  console.log(`postgresql getOne result: `, rows[0]);
  return rows[0] || undefined;
}

async function getMany(
  table: string,
  attributes: Array<string>,
  findOptions: { [key: string]: any },
  credential?: AwsCredentialIdentityProvider
): Promise<Array<{ [key: string]: any }>> {
  db = db || (await getNewDBInstance(credential));
  if (findOptions.offset === undefined && findOptions.limit === undefined && findOptions.order === undefined && findOptions.where == undefined) {
    // offset, limit, order를 입력하지 않고 where만 들어가 있는 경우 처리
    findOptions.where = JSON.parse(JSON.stringify(findOptions));
    findOptions.offset = 0;
    findOptions.limit = 100;
  }
  console.log(`postgresql getMany() table: ${table}, attrs: ${attributes}, findOptions: ${JSON.stringify(findOptions)}`);

  let queryPromise = db.select(...attributes).from(table);
  findOptions.order && queryPromise.orderBy(findOptions.order[0][0], findOptions.order[0][1]);
  findOptions.offset && queryPromise.offset(findOptions.offset);
  findOptions.limit && queryPromise.limit(findOptions.limit);
  findOptions.where &&
    queryPromise.where((builder: any) => {
      for (const filter of Object.entries(findOptions.where)) {
        builder = Array.isArray(filter[1])
          ? builder.whereIn(filter[0], filter[1])
          : builder.where(filter[0], filter[1]);
      }
    });

  const rows = await safeQueryPromise(queryPromise, credential);
  //console.log(`postgresql getMany() rows: ${JSON.stringify(rows)}`);
  return rows;
}

async function getCount(table: string, where: { [key: string]: any }, credential?: AwsCredentialIdentityProvider): Promise<number> {
  db = db || (await getNewDBInstance(credential));
  console.log(`postgresql getCount() table: ${table}, where: ${JSON.stringify(where)}`);

  let queryPromise = db
    .count('*', { as: 'cnt' })
    .from(table)
    .where((builder: any) => {
      for (const filter of Object.entries(where)) {
        builder = Array.isArray(filter[1])
          ? builder.whereIn(filter[0], filter[1])
          : builder.where(filter[0], filter[1]);
      }
    });
  const countRow = await safeQueryPromise(queryPromise, credential);
  console.log(`postgresql getCount() countRow: ${JSON.stringify(countRow)}`);
  let count = typeof countRow[0].cnt === 'number' ? countRow[0].cnt : parseInt(countRow[0].cnt);
  if (isNaN(count)) {
    throw new Error('getCount: count is not a number');
  }
  return count;
}

async function update2(
  table: string,
  updateObject: { [key: string]: any },
  where: { [key: string]: any },
  credential?: AwsCredentialIdentityProvider
): Promise<{ [key: string]: any }> {
  db = db || (await getNewDBInstance(credential));
  console.log(
    `postgresql update() table: ${table}, attrs: ${JSON.stringify(updateObject)}, where: ${JSON.stringify(where)}`
  );
  let queryPromise = db.from(table).where((builder: any) => {
    for (const filter of Object.entries(where)) {
      builder = Array.isArray(filter[1]) ? builder.whereIn(filter[0], filter[1]) : builder.where(filter[0], filter[1]);
    }
  });
  for (const attr of Object.entries(updateObject)) {
    queryPromise = queryPromise.update(attr[0], attr[1]);
  }
  const rows = await safeQueryPromise(queryPromise, credential);
  console.log(`postgresql update() rows: ${JSON.stringify(rows)}`);
  return rows;
}

async function upsert(
  table: string,
  upsertObject: { [key: string]: any },
  duplicateWhere: { [key: string]: any },
  credential?: AwsCredentialIdentityProvider
): Promise<{ [key: string]: any } | number> {
  db = db || (await getNewDBInstance(credential));
  console.log(
    `postgresql upsert() table: ${table}, upsertObject: ${JSON.stringify(upsertObject)}, duplicateWhere: ${duplicateWhere}`
  );

  let rows: any, exist: any;
  try {
    exist = await getOne(table, [], duplicateWhere, credential);
    if (exist) {
      rows = await update2(table, upsertObject, duplicateWhere, credential);
    } else {
      rows = await create(table, upsertObject, credential);
    }
  } catch (err) {
    console.log('postgresql get & update error', err);
    rows = await create(table, upsertObject, credential);
  }
  console.log(`postgresql upsert() rows - ${exist ? 'update' : 'insert'} : ${JSON.stringify(rows)}`);
  return rows;
}

async function deleteOne(table: string, where: { [key: string]: any }, credential?: AwsCredentialIdentityProvider): Promise<number> {
  db = db || (await getNewDBInstance(credential));
  console.log(`postgresql deleteOne() table: ${table}, where: ${JSON.stringify(where)}`);

  let queryPromise = db
    .from(table)
    .where((builder: any) => {
      for (const filter of Object.entries(where)) {
        builder = Array.isArray(filter[1])
          ? builder.whereIn(filter[0], filter[1])
          : builder.where(filter[0], filter[1]);
      }
    })
    .limit(1)
    .del();
  const rows = await safeQueryPromise(queryPromise, credential);
  console.log(`postgresql deleteOne() rows: ${JSON.stringify(rows)}`);

  return rows;
}

async function deleteMany(table: string, where: { [key: string]: any }, credential?: AwsCredentialIdentityProvider): Promise<number> {
  db = db || (await getNewDBInstance(credential));
  console.log(`postgresql deleteMany() table: ${table},where: ${JSON.stringify(where)}`);

  let queryPromise = db
    .from(table)
    .where((builder: any) => {
      for (const filter of Object.entries(where)) {
        builder = Array.isArray(filter[1])
          ? builder.whereIn(filter[0], filter[1])
          : builder.where(filter[0], filter[1]);
      }
    })
    .del();
  const rows = await safeQueryPromise(queryPromise, credential);
  console.log(`postgresql deleteMany() rows: ${JSON.stringify(rows)}`);

  return rows;
}

async function getSearch(table: string, attributes: Array<string>, findOptions: { [key: string]: any }, credential?: AwsCredentialIdentityProvider): Promise<Array<{ [key: string]: any }>> {
  db = db || (await getNewDBInstance(credential));
  console.log(`postgresql getSearch() table: ${table}, attrs: ${attributes}, findOptions: ${JSON.stringify(findOptions)}`);

  let queryPromise = db.select(...attributes).from(table);
  findOptions.order && queryPromise.orderBy(findOptions.order[0][0], findOptions.order[0][1]);
  findOptions.offset && queryPromise.offset(findOptions.offset);
  findOptions.limit && queryPromise.limit(findOptions.limit);
  for (let whereLike of findOptions.whereLikes) {
    const builderFunction = (builder: any) => {
      for (const [key, value] of Object.entries(whereLike)) {
        builder = builder.orWhereILike(key, value);
      }
    };
    findOptions.searchOption?.toLowerCase() === 'or'
      ? queryPromise.orWhere(builderFunction)
      : queryPromise.andWhere(builderFunction);
  }
  findOptions.where &&
    queryPromise.andWhere((builder: any) => {
      for (const filter of Object.entries(findOptions.where)) {
        builder = Array.isArray(filter[1])
          ? builder.whereIn(filter[0], filter[1])
          : builder.where(filter[0], filter[1]);
      }
    });
  if (findOptions.whereRaw) {
    console.log('[findOptions.whereRaw]', findOptions.whereRaw);
    queryPromise.whereRaw(findOptions.whereRaw);
  }
  if (findOptions.notNull) {
    for (const column of findOptions.notNull) {
      queryPromise.whereNotNull(column);
    }
  }
  const rows = await safeQueryPromise(queryPromise, credential);

  return rows;
}

async function getSearchCount(table: string, findOptions: { [key: string]: any }, credential?: AwsCredentialIdentityProvider): Promise<number> {
  db = db || (await getNewDBInstance(credential));
  console.log(`postgresql getSearchCount() table: ${table}, findOptions: ${JSON.stringify(findOptions)}`);

  let queryPromise = db.count('*', { as: 'cnt' }).from(table);
  for (let whereLike of findOptions.whereLikes) {
    const builderFunction = (builder: any) => {
      for (const [key, value] of Object.entries(whereLike)) {
        builder = builder.orWhereILike(key, value);
      }
    };
    findOptions.searchOption?.toLowerCase() === 'or'
      ? queryPromise.orWhere(builderFunction)
      : queryPromise.andWhere(builderFunction);
  }
  findOptions.where &&
    queryPromise.andWhere((builder: any) => {
      for (const filter of Object.entries(findOptions.where)) {
        builder = Array.isArray(filter[1])
          ? builder.whereIn(filter[0], filter[1])
          : builder.where(filter[0], filter[1]);
      }
    });
  if (findOptions.whereRaw) {
    console.log('[findOptions.whereRaw]', findOptions.whereRaw);
    queryPromise.whereRaw(findOptions.whereRaw);
  }
  if (findOptions.notNull) {
    for (const column of findOptions.notNull) {
      queryPromise.whereNotNull(column);
    }
  }
  const countRow = await safeQueryPromise(queryPromise, credential);
  console.log(`postgresql getSearchCount() countRow: ${JSON.stringify(countRow)}`);
  let count = typeof countRow[0].cnt === 'number' ? countRow[0].cnt : parseInt(countRow[0].cnt);
  if (isNaN(count)) {
    throw new Error('getSearchCount: count is not a number');
  }
  return count;
}

async function innerJoin(
  table1: string,
  table2: string,
  key1: string,
  key2: string,
  attributes: Array<string>,
  findOptions: { [key: string]: any },
  credential?: AwsCredentialIdentityProvider
): Promise<Array<{ [key: string]: any }>> {
  db = db || (await getNewDBInstance(credential));
  console.log(
    `postgresql innerJoin() table: ${table1} & ${table2}, key: ${key1} & ${key2}, attrs: ${attributes}, findOptions: ${JSON.stringify(
      findOptions
    )}`
  );

  let queryPromise = db
    .select(...attributes)
    .from(table1)
    .innerJoin(table2, key1, key2);
  findOptions.order && queryPromise.orderBy(findOptions.order[0][0], findOptions.order[0][1]);
  findOptions.offset && queryPromise.offset(findOptions.offset);
  findOptions.limit && queryPromise.limit(findOptions.limit);
  queryPromise.where((builder: any) => {
    for (const filter of Object.entries(findOptions.where)) {
      builder = Array.isArray(filter[1]) ? builder.whereIn(filter[0], filter[1]) : builder.where(filter[0], filter[1]);
    }
  });
  const rows = await safeQueryPromise(queryPromise, credential);
  return rows;
}

// parameter로 전달받은 table에서 where 조건에 해당하는 row들의 column value를 db의 현재 timestamp 값으로 업데이트한다.
async function updateTimestamp(table: string, column: string, where: { [key: string]: any }, credential?: AwsCredentialIdentityProvider): Promise<any> {
  db = db || (await getNewDBInstance(credential));
  console.log('[updateTimestamp parameters]', JSON.stringify({ table, column, where })); let queryPromise = db.from(table).where((builder: any) => {
    for (const filter of Object.entries(where)) {
      builder = Array.isArray(filter[1]) ? builder.whereIn(filter[0], filter[1]) : builder.where(filter[0], filter[1]);
    }
  });
  queryPromise.update(column, db.fn.now());
  const rows = await safeQueryPromise(queryPromise, credential);

  return rows;
}

async function batchCreate(table: string, createObjects: Record<string, any>[], credential?: AwsCredentialIdentityProvider): Promise<any> {
  db = db || (await getNewDBInstance(credential));
  console.log(`postgresql batchCreate() table: ${table}, count: ${createObjects.length}`);

  if (createObjects.length === 0) {
    return [];
  }

  let queryPromise = db.batchInsert(table, createObjects);
  const rows = await safeQueryPromise(queryPromise, credential);
  console.log(`postgresql batchCreate() inserted ${createObjects.length} rows`);
  return rows;
}

export default {
  raw,
  getOne,
  getMany,
  getCount,
  update2,
  create,
  upsert,
  deleteOne,
  deleteMany,
  getSearch,
  getSearchCount,
  innerJoin,
  updateTimestamp,
  batchCreate,
};
