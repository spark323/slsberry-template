import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
process.env.stage = "dev";

import { lambdaHandler as getHandler } from './get.js';
import { lambdaHandler as postHandler } from './post.js';

import setupTestEnvironment from '../libs/utils/testSetup.js';

import { nanoid } from 'nanoid';
import moment from 'moment';
import { jest } from '@jest/globals';
import {
    ResultType,

} from '../types/types.js';
import { PostgreSQLDsqlUtil } from '../libs/utils/dsqlUtill.js';
import atomicCounterUtil from '../libs/aws/atomicCounterUtil.js';

// Setup test environment and get configuration and credentials
const { testConfig, credentials } = setupTestEnvironment('default_config.yml');

describe('DSQL REST Template Tests', () => {
    const dsqlUtil = new PostgreSQLDsqlUtil(process.env.dsql_endpoint!, credentials, process.env.region!);
    process.env.stage = "dev";
    jest.setTimeout(300000);

    let testIdx: string;

    beforeAll(async () => {
        console.log('Test environment setup completed');
    });

    afterAll(async () => {
        // Clean up test data if needed
    });

    describe('POST /contents - Create Content', () => {
        it('should create content successfully', async () => {
            const event = {
                body: {
                    contents: 'This is test content'
                },
                v3TestProfile: credentials
            };

            const result = await postHandler(event);

            expect(result.statusCode).toBe(201);
            const body = JSON.parse(result.body);
            expect(body.result).toBe(ResultType.Success);
        });
    });

    describe('GET /contents - Retrieve Content', () => {
        it('should retrieve content by idx', async () => {
            // First create a content item to test retrieval
            const createEvent = {
                body: {
                    contents: 'Test content for retrieval'
                },
                v3TestProfile: credentials
            };

            const createResult = await postHandler(createEvent);
            expect(createResult.statusCode).toBe(201);

            // Use increment counter to get a valid idx
            const idx = await atomicCounterUtil.incrementCounter("contents", 0, credentials);

            const getEvent = {
                queryStringParameters: {
                    idx: idx.toString()
                },
                v3TestProfile: credentials
            };

            const result = await getHandler(getEvent);

            expect(result.statusCode).toBe(201);
            const body = JSON.parse(result.body);
            expect(body.result).toBe(ResultType.Success);
            expect(body.contents).toBeDefined();
        });
    });
});
