import { jsonSafeParse, normalizeHttpResponse } from "@middy/util";


interface Options {
  name?: string;
  path?: string;
  logger?: (error: any) => void;
  fallbackMessage?: string;
}

interface Request {
  event?: any;
  context?: any;
  response?: any;
  error?: any;
}

const defaults: Options = {
  logger: console.error,
  fallbackMessage: undefined,
};

export const globalErrorHandler = (opts: Options = {}): { onError: (request: Request) => Promise<void> } => {
  const options: Options = { ...defaults, ...opts };

  const globalErrorHandlerOnError = async (request: Request): Promise<void> => {
    const originalErrorStack = structuredClone(request?.error?.stack);

    if (request.response !== undefined) return;
    if (typeof options.logger === "function") {
      options.logger(request.error);
    }

    // Set default expose value, only passes in when there is an override
    if (request.error.statusCode && request.error.expose === undefined) {
      request.error.expose = request.error.statusCode < 500;
    }

    // Non-http error OR expose set to false
    if (!request.error.expose || !request.error.statusCode) {
      request.error = {
        statusCode: 500,
        message: options.fallbackMessage,
        expose: true,
      };
    }

    if (request.error.expose) {
      normalizeHttpResponse(request);
      const { statusCode, message, headers } = request.error;

      request.response = {
        ...request.response,
        statusCode,
        headers: {
          ...request.response.headers,
          ...headers,
        },
      };

      if (message) {
        const headerContentType = typeof jsonSafeParse(message) === "string" ? "text/plain" : "application/json";
        request.response.body = message;
        request.response.headers["Content-Type"] = headerContentType;
      }
    }

    if (request.error.statusCode === 500) {
      const apiName = "apiname";
      const logGroupPrefix = `https://ap-northeast-2.console.aws.amazon.com/cloudwatch/home?region=ap-northeast-2#logsV2:log-groups/log-group`;
      const logGroupName = `//aws/lambda/recon-core-operative-v2_${process.env.stage}_${process.env.version || 1}_${apiName}`;

      try {
        console.log(request.error);
      } catch (error) {
        console.error("Error while sending slack message", error);
      }
    }
  };

  return {
    onError: globalErrorHandlerOnError,
  };
};
