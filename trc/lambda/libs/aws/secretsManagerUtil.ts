import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";

export async function getSecretObject(secretName?: string): Promise<{ [key: string]: any } | undefined> {
  if (!secretName) return undefined;

  try {
    const client = new SecretsManagerClient({ region: "ap-northeast-2" });
    const command = new GetSecretValueCommand({ SecretId: secretName });
    const res = await client.send(command);
    // const res = await client.getSecretValue({ SecretId: secretName }).promise();
    if (res.SecretString) {
      return JSON.parse(res.SecretString);
    } else if (res.SecretBinary) {
      // Handle binary secrets if needed
      return undefined;
    }
  } catch (error) {
    console.log("Error retrieving secret:", error);
    throw error;
  }
}
