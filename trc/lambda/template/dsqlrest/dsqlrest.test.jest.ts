import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
process.env.stage = "dev";

import { lambdaHandler as getHandler } from './get.js';
import { lambdaHandler as postHandler } from './post.js';


import setupTestEnvironment from '../../libs/utils/testSetup.js';
import { ApiKeyVerifiedContext } from '../../libs/middlewares/auth.guard.js';
import { nanoid } from 'nanoid';
import moment from 'moment';
import { jest } from '@jest/globals';
import {
  ResultType,

} from '../../types/types.js';
import { PostgreSQLDsqlUtil } from '../../libs/utils/dsqlUtill.js';
import atomicCounterUtil from '../../libs/aws/atomicCounterUtil.js';

// Setup test environment and get configuration and credentials
const { testConfig, credentials } = setupTestEnvironment('default_config.yml');

describe('Project Share Lambda Functions Tests', () => {
  const dsqlUtil = new PostgreSQLDsqlUtil(process.env.dsql_endpoint!, credentials, process.env.region!);
  process.env.stage = "dev";
  jest.setTimeout(300000);


  beforeAll(async () => {
    // Set test identifiers

    console.log('Test environment setup completed');
  });

  afterAll(async () => {
    // Clean up all test data

  });

  describe('POST /share - Create Project Share', () => {


    it('should return project information correctly', async () => {
      const event = {
        queryStringParameters: {
          project_id: testProjectId,
          include_inactive: 'false' as 'false',
          page: '1',
          limit: '20',
          sort_by: 'created_datetime' as 'created_datetime',
          sort_direction: 'desc' as 'desc'
        },
        v3TestProfile: credentials
      };

    });
  });
});
