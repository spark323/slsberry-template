/*
version:25-02-18
@author: chris
*/

import { MySQLDataAPIUtil } from "./dataAPIUtil.js";

interface RequestParams {
    draw?: number;
    start?: number;
    length?: number;
    search?: { value: string };
    order?: { column: number; dir: "asc" | "desc" }[];
    columns: { data: string; orderable: string; searchable: boolean }[];
}

interface ColumnDefinition {
    db: string;
    dt: number;
    searchable: boolean;
    projection?: boolean;
}

export default class NodeTable {
    private request: RequestParams;
    private db: MySQLDataAPIUtil;
    private table: string;
    private primaryKey: string;
    private columns: ColumnDefinition[];
    private filterExpression: string;

    constructor(request: any, db: MySQLDataAPIUtil, table: string, primaryKey: string, columns: ColumnDefinition[], filterExpression = "") {
        this.request = request as RequestParams;
        this.db = db;
        this.table = table;
        this.primaryKey = primaryKey;
        this.columns = columns;
        this.filterExpression = filterExpression ? `(${filterExpression})` : "";
    }

    private limit(): string {
        if (this.request.start !== undefined && this.request.length !== undefined) {
            return ` LIMIT ${this.request.start}, ${this.request.length}`;
        }
        return "";
    }

    private order(): string {
        if (!this.request.order || this.request.order.length === 0) return "";

        let orderBy: string[] = [];
        let dtColumns = NodeTable.pluck2(this.columns);

        this.request.order.forEach(({ column, dir }) => {
            let requestColumn = this.request.columns[column];
            let columnIdx = dtColumns[requestColumn.data];
            let columnDef = this.columns[columnIdx];

            if (requestColumn.orderable === "true") {
                orderBy.push(`${columnDef.db} ${dir.toUpperCase()}`);
            }
        });

        return orderBy.length > 0 ? ` ORDER BY ${orderBy.join(", ")}` : "";
    }

    private filter(): string {
        let globalSearch: string[] = [];

        if (this.request.search && this.request.search.value.trim().length > 1) {
            const searchStr = `%${this.request.search.value}%`;
            this.columns.forEach((col) => {
                if (col.searchable) {
                    globalSearch.push(`${col.db} LIKE '${searchStr}'`);
                }
            });
        }

        let where = "";
        if (globalSearch.length > 0) where += `(${globalSearch.join(" OR ")})`;

        if (this.filterExpression) {
            where = where ? `${this.filterExpression} AND ${where}` : this.filterExpression;
        }

        return where ? ` WHERE ${where}` : "";
    }

    private async buildQuery(): Promise<any[]> {
        const attributes = NodeTable.pluck(this.columns, "db");
        const where = this.filter();
        const order = this.order();
        const limit = this.limit();
        const query = `SELECT ${attributes.join(", ")} FROM ${this.table} ${where} ${order} ${limit}`;
        return await this.db.raw(query);
    }

    async outputAsync() {
        const results = await this.buildQuery();
        const where = this.filter();

        const filteredCountQuery = `SELECT COUNT(${this.primaryKey}) AS filtered FROM ${this.table} ${where}`;
        const totalCountQuery = `SELECT COUNT(${this.primaryKey}) AS total FROM ${this.table}`;

        const filteredRecords = await this.db.raw(filteredCountQuery);
        const totalRecords = await this.db.raw(totalCountQuery);

        return {
            draw: this.request.draw ?? 0,
            recordsTotal: totalRecords.length > 0 ? totalRecords[0].total : 0,
            recordsFiltered: filteredRecords.length > 0 ? filteredRecords[0].filtered : 0,
            data: NodeTable.mapData(this.columns, results),
        };
    }

    static mapData(columns: ColumnDefinition[], data: any[]) {
        return data.map((row) => {
            let mappedRow: Record<string, any> = {};
            columns.forEach((col) => {
                mappedRow[col.db] = row[col.db];
            });
            return mappedRow;
        });
    }

    static pluck(dataArray: ColumnDefinition[], prop: keyof ColumnDefinition) {
        return dataArray.filter((col) => col.projection).map((col) => col[prop]);
    }

    static pluck2(dataArray: ColumnDefinition[]) {
        let out: Record<string, number> = {};
        dataArray.forEach((col, index) => {
            out[col.db] = col.dt;
        });
        return out;
    }
}
