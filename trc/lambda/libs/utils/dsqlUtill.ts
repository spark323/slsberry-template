import knex, { Knex } from 'knex';
import { DsqlSigner } from "@aws-sdk/dsql-signer";
import { AwsCredentialIdentityProvider } from "@aws-sdk/types";

class PostgreSQLDsqlUtil {
    private db: Knex | null = null;
    private endpoint: string;
    private region: string;
    private credential?: AwsCredentialIdentityProvider;

    constructor(
        endpoint: string,
        credential?: AwsCredentialIdentityProvider,
        region: string = "ap-northeast-2"
    ) {
        this.endpoint = endpoint;
        this.credential = credential;
        this.region = region;
    }

    static async create(
        endpoint: string,
        credential?: AwsCredentialIdentityProvider,
        region: string = "ap-northeast-2"
    ): Promise<PostgreSQLDsqlUtil> {
        return new PostgreSQLDsqlUtil(endpoint, credential, region);
    }

    private async generateToken(): Promise<string> {
        console.log("Generating token for DSQL connection...");
        console.log(this.credential);
        let dsqlObject: any = {
            hostname: this.endpoint,
            region: this.region
        }
        if (this.credential) {
            dsqlObject = {
                ...dsqlObject,
                credentials: this.credential,
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

    private async getNewDBInstance(): Promise<Knex> {
        let newDB: Knex;
        const token = await this.generateToken();

        newDB = knex({
            client: 'pg',
            connection: {
                host: this.endpoint,
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
    private async safeQueryPromise(queryPromise: any): Promise<any> {
        console.log('query:', queryPromise.toString());
        try {
            return await queryPromise;
        } catch (error: any) {
            console.log('safeQueryPromise error', error);
            if (error.code === '28P01' || error.code === 'ECONNREFUSED' || error.code == '08006') { // PostgreSQL access denied errors
                this.db = await this.getNewDBInstance();
                const query = queryPromise.toString();
                const result = await this.db!.raw(query);
                return result.rows;
            } else {
                throw error;
            }
        }
    }

    async raw(query: string, transactionId?: string, returnEmpty?: boolean): Promise<any> {
        this.db = this.db || (await this.getNewDBInstance());
        console.log(`postgresql raw() : ${query}`);
        let queryPromise = this.db.raw(query);
        const result = await this.safeQueryPromise(queryPromise);
        console.log(`postgresql raw result: `, result);
        return result.rows || (returnEmpty ? [] : undefined);
    }

    async create(table: string, createObject: Record<string, any>): Promise<any> {
        this.db = this.db || (await this.getNewDBInstance());
        console.log(`postgresql create() table: ${table}, createObject: ${JSON.stringify(createObject)}`);
        let queryPromise = this.db.insert(createObject).into(table);
        const rows = await this.safeQueryPromise(queryPromise);
        console.log(`postgresql create() rows: ${JSON.stringify(rows)}`);
        return rows;
    }

    async getOne(
        table: string,
        attributes: Array<string>,
        where: { [key: string]: any }
    ): Promise<{ [key: string]: any }> {
        this.db = this.db || (await this.getNewDBInstance());
        console.log(`postgresql getOne() table: ${table}, attrs: ${attributes}, where: ${JSON.stringify(where)}`);
        let queryPromise = this.db
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
        const rows = await this.safeQueryPromise(queryPromise);
        console.log(`postgresql getOne result: `, rows[0]);
        return rows[0] || undefined;
    }

    async getMany(
        table: string,
        attributes: Array<string>,
        findOptions: { [key: string]: any }
    ): Promise<Array<{ [key: string]: any }>> {
        this.db = this.db || (await this.getNewDBInstance());
        if (findOptions.offset === undefined && findOptions.limit === undefined && findOptions.order === undefined && findOptions.where == undefined) {
            // offset, limit, order를 입력하지 않고 where만 들어가 있는 경우 처리
            findOptions.where = JSON.parse(JSON.stringify(findOptions));
            findOptions.offset = 0;
            findOptions.limit = 100;
        }
        console.log(`postgresql getMany() table: ${table}, attrs: ${attributes}, findOptions: ${JSON.stringify(findOptions)}`);

        let queryPromise = this.db.select(...attributes).from(table);
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

        const rows = await this.safeQueryPromise(queryPromise);
        //console.log(`postgresql getMany() rows: ${JSON.stringify(rows)}`);
        return rows;
    }

    async getCount(table: string, where: { [key: string]: any }): Promise<number> {
        this.db = this.db || (await this.getNewDBInstance());
        console.log(`postgresql getCount() table: ${table}, where: ${JSON.stringify(where)}`);

        let queryPromise = this.db
            .count('*', { as: 'cnt' })
            .from(table)
            .where((builder: any) => {
                for (const filter of Object.entries(where)) {
                    builder = Array.isArray(filter[1])
                        ? builder.whereIn(filter[0], filter[1])
                        : builder.where(filter[0], filter[1]);
                }
            });
        const countRow = await this.safeQueryPromise(queryPromise);
        console.log(`postgresql getCount() countRow: ${JSON.stringify(countRow)}`);
        let count = typeof countRow[0].cnt === 'number' ? countRow[0].cnt : parseInt(countRow[0].cnt);
        if (isNaN(count)) {
            throw new Error('getCount: count is not a number');
        }
        return count;
    }

    async update2(
        table: string,
        updateObject: { [key: string]: any },
        where: { [key: string]: any }
    ): Promise<{ [key: string]: any }> {
        this.db = this.db || (await this.getNewDBInstance());
        console.log(
            `postgresql update() table: ${table}, attrs: ${JSON.stringify(updateObject)}, where: ${JSON.stringify(where)}`
        );
        let queryPromise = this.db.from(table).where((builder: any) => {
            for (const filter of Object.entries(where)) {
                builder = Array.isArray(filter[1]) ? builder.whereIn(filter[0], filter[1]) : builder.where(filter[0], filter[1]);
            }
        });
        for (const attr of Object.entries(updateObject)) {
            queryPromise = queryPromise.update(attr[0], attr[1]);
        }
        const rows = await this.safeQueryPromise(queryPromise);
        console.log(`postgresql update() rows: ${JSON.stringify(rows)}`);
        return rows;
    }

    async upsert(
        table: string,
        upsertObject: { [key: string]: any },
        duplicateWhere: { [key: string]: any }
    ): Promise<{ [key: string]: any } | number> {
        this.db = this.db || (await this.getNewDBInstance());
        console.log(
            `postgresql upsert() table: ${table}, upsertObject: ${JSON.stringify(upsertObject)}, duplicateWhere: ${duplicateWhere}`
        );

        let rows: any, exist: any;
        try {
            exist = await this.getOne(table, [], duplicateWhere);
            if (exist) {
                rows = await this.update2(table, upsertObject, duplicateWhere);
            } else {
                rows = await this.create(table, upsertObject);
            }
        } catch (err) {
            console.log('postgresql get & update error', err);
            rows = await this.create(table, upsertObject);
        }
        console.log(`postgresql upsert() rows - ${exist ? 'update' : 'insert'} : ${JSON.stringify(rows)}`);
        return rows;
    }

    async deleteOne(table: string, where: { [key: string]: any }): Promise<number> {
        this.db = this.db || (await this.getNewDBInstance());
        console.log(`postgresql deleteOne() table: ${table}, where: ${JSON.stringify(where)}`);

        let queryPromise = this.db
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
        const rows = await this.safeQueryPromise(queryPromise);
        console.log(`postgresql deleteOne() rows: ${JSON.stringify(rows)}`);

        return rows;
    }

    async deleteMany(table: string, where: { [key: string]: any }): Promise<number> {
        this.db = this.db || (await this.getNewDBInstance());
        console.log(`postgresql deleteMany() table: ${table},where: ${JSON.stringify(where)}`);

        let queryPromise = this.db
            .from(table)
            .where((builder: any) => {
                for (const filter of Object.entries(where)) {
                    builder = Array.isArray(filter[1])
                        ? builder.whereIn(filter[0], filter[1])
                        : builder.where(filter[0], filter[1]);
                }
            })
            .del();
        const rows = await this.safeQueryPromise(queryPromise);
        console.log(`postgresql deleteMany() rows: ${JSON.stringify(rows)}`);

        return rows;
    }

    async getSearch(table: string, attributes: Array<string>, findOptions: { [key: string]: any }): Promise<Array<{ [key: string]: any }>> {
        this.db = this.db || (await this.getNewDBInstance());
        console.log(`postgresql getSearch() table: ${table}, attrs: ${attributes}, findOptions: ${JSON.stringify(findOptions)}`);

        let queryPromise = this.db.select(...attributes).from(table);
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
        const rows = await this.safeQueryPromise(queryPromise);

        return rows;
    }

    async getSearchCount(table: string, findOptions: { [key: string]: any }): Promise<number> {
        this.db = this.db || (await this.getNewDBInstance());
        console.log(`postgresql getSearchCount() table: ${table}, findOptions: ${JSON.stringify(findOptions)}`);

        let queryPromise = this.db.count('*', { as: 'cnt' }).from(table);
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
        const countRow = await this.safeQueryPromise(queryPromise);
        console.log(`postgresql getSearchCount() countRow: ${JSON.stringify(countRow)}`);
        let count = typeof countRow[0].cnt === 'number' ? countRow[0].cnt : parseInt(countRow[0].cnt);
        if (isNaN(count)) {
            throw new Error('getSearchCount: count is not a number');
        }
        return count;
    }

    async innerJoin(
        table1: string,
        table2: string,
        key1: string,
        key2: string,
        attributes: Array<string>,
        findOptions: { [key: string]: any }
    ): Promise<Array<{ [key: string]: any }>> {
        this.db = this.db || (await this.getNewDBInstance());
        console.log(
            `postgresql innerJoin() table: ${table1} & ${table2}, key: ${key1} & ${key2}, attrs: ${attributes}, findOptions: ${JSON.stringify(
                findOptions
            )}`
        );

        let queryPromise = this.db
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
        const rows = await this.safeQueryPromise(queryPromise);
        return rows;
    }

    // parameter로 전달받은 table에서 where 조건에 해당하는 row들의 column value를 db의 현재 timestamp 값으로 업데이트한다.
    async updateTimestamp(table: string, column: string, where: { [key: string]: any }): Promise<any> {
        this.db = this.db || (await this.getNewDBInstance());
        console.log('[updateTimestamp parameters]', JSON.stringify({ table, column, where }));
        let queryPromise = this.db.from(table).where((builder: any) => {
            for (const filter of Object.entries(where)) {
                builder = Array.isArray(filter[1]) ? builder.whereIn(filter[0], filter[1]) : builder.where(filter[0], filter[1]);
            }
        });
        queryPromise.update(column, this.db.fn.now());
        const rows = await this.safeQueryPromise(queryPromise);

        return rows;
    }
}

export { PostgreSQLDsqlUtil };
