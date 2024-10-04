import { jest } from '@jest/globals';
import tester from 'slsberry-tester';
const { modArr, authorizer } = await tester.readMods("test_configs/test_config.yml")
describe('REST', () => {
  jest.setTimeout(300000);
  //jest.useFakeTimers();
  tester.test("test_configs/test_config.yml", modArr, authorizer)
});
