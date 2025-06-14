import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { fromIni } from '@aws-sdk/credential-provider-ini';
import { AwsCredentialIdentityProvider } from '@aws-sdk/types';

/**
 * Interface for test configuration loaded from YAML
 */
export interface TestConfig {
    aws_profile: string;
    app: string;
    region: string;
    useAWSSDKV3: boolean;
    env: Record<string, string | number>;
    claimsProfiles: Record<string, {
        client_id: string;
        user_email?: string;
        provider: "cognito" | "api-key"
    }>;
}

/**
 * Loads test configuration from the specified YAML file
 * @param configPath Optional path to the config file, defaults to 'test_configs/test_config.yml'
 * @returns The loaded test configuration
 */
export function loadTestConfig(configPath: string = 'test_config.yml'): TestConfig {
    const testConfigPath = path.resolve(process.cwd(), 'test_configs', configPath);
    return yaml.load(fs.readFileSync(testConfigPath, 'utf8')) as TestConfig;
}

/**
 * Sets up test environment by loading the config and setting environment variables
 * @param configPath Optional path to the config file
 * @returns The loaded test configuration and AWS credentials
 */
export function setupTestEnvironment(configPath: string = 'test_config.yml'): {
    testConfig: TestConfig;
    credentials: AwsCredentialIdentityProvider;
} {
    // Load configuration from YAML file
    const testConfig = loadTestConfig(configPath);

    // Set AWS profile and region as environment variables
    process.env.AWS_PROFILE = testConfig.aws_profile;
    process.env.AWS_REGION = testConfig.region;

    // Set all environment variables from the env section
    Object.entries(testConfig.env).forEach(([key, value]) => {
        process.env[key] = String(value);
    });

    // Create AWS credentials using the profile from the config
    const credentials = fromIni({ profile: testConfig.aws_profile });

    return { testConfig, credentials };
}

export default setupTestEnvironment;