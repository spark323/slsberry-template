````markdown
## Aurora DSQL – Extended SQL‑Generation Rules

### 1. General scope  
* **Single database** – Aurora DSQL exposes only the built‑in `postgres` database; `CREATE DATABASE`, `DROP DATABASE`, and related commands are disallowed. :contentReference[oaicite:0]{index=0}  
* **No user schemas for non‑admins** – Non‑admin roles can’t run `CREATE SCHEMA` or create objects in the `public` schema. Generate objects into an existing, admin‑provisioned schema only. :contentReference[oaicite:1]{index=1}  

### 2. Supported data types  
Limit columns to the numeric, character, date/time, `boolean`, `bytea`, and `uuid` types listed in the docs; exotic or extension‑based types aren’t available. :contentReference[oaicite:2]{index=2}  

### 3. Table design  
* **Primary keys** – Use `uuid` (supplied by the application) or another primitive type with a `DEFAULT` expression. Avoid `SERIAL`, `BIGSERIAL`, or `GENERATED … IDENTITY` because sequences are not supported. :contentReference[oaicite:3]{index=3}  
* **Constraints** – Allowed: `NOT NULL`, `CHECK`, `UNIQUE`, `PRIMARY KEY`. **Disallowed**: `FOREIGN KEY`, `EXCLUSION`, and any partitioning clauses. :contentReference[oaicite:4]{index=4}  
* **Generated columns** – `GENERATED ALWAYS AS ( … ) STORED` is permitted for computed columns. :contentReference[oaicite:5]{index=5}  

### 4. Indexing  
* Create indexes **after** the base table with the asynchronous form  
  ```sql
  CREATE [UNIQUE] INDEX ASYNC idx_name ON table_name (column_list);
````



### 6. Unsupported objects & commands

Avoid generating any SQL that uses: temporary tables, triggers, sequences, partitions, tablespaces, stored procedures or functions, extensions, `ALTER SYSTEM`, `TRUNCATE`, `SAVEPOINT`, `VACUUM`, or `GRANT … ON DATABASE`. ([AWS Documentation][2])



### 8. Checklist for every generated script

1. Uses only supported data types.
2. No foreign keys, sequences, triggers, or unsupported commands.
3. All indexes are created with `INDEX ASYNC` (no order specifiers).
4. Transactions that perform DML stay within the 3 000‑row limit.
5. Scripts assume they’re running in the `postgres` database under an admin‑capable role.


### 9. util
1. Reference dsqlUtill.ts and dsqlUtillWrapper.ts for DB Operations.