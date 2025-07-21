import { describe, it, expect } from '@jest/globals';


import dsqlUtil from '../libs/utils/dsqlUtillWrapper.js';
import setupTestEnvironment from '../libs/utils/testSetup.js';
import { ApiKeyVerifiedContext } from '../libs/middlewares/auth.guard.js';
import { jest } from '@jest/globals';

// Setup test environment and get configuration and credentials
const { testConfig, credentials } = setupTestEnvironment('default_config.yml');
import { lambdaHandler as putHandler } from '../template/rest/post.js';
describe('File Delete Handler Tests', () => {
  jest.setTimeout(300000000);
  it('should delete file and update project main_file_id to null', async () => {


    const event = {
      body: {
        contents: "test-project",
      },
      v3TestProfile: credentials
    };

    // Call the create project lambda handler
    const response = await putHandler(event);


  });


});