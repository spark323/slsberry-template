import { createError } from "@middy/util";

// remove all undefined values from an object
export function removeUndefined<T extends object>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;
}

export const createJsonError = ({
  statusCode,
  code,
  message,
  ...opts
}: {
  statusCode: number;
  code: string;
  message: string;
  [key: string]: any;
}) => {
  const error = createError(statusCode, message, opts);

  error.statusCode = statusCode;
  error.code = code;
  error.message = JSON.stringify({ message, code });
  error.expose = true;

  return error;
};

export const ShouldNotExist = async <T>(
  target: T | undefined | Promise<T | undefined>,
  variables: Record<string, any> = {},
): Promise<void> => {
  const value = await target;

  // todo: if value is array, check if it's empty or only contains sub elements in varaibles

  if (value) {
    const message = `${formatVariables(variables)} already exists`;
    throw createJsonError({
      statusCode: 400,
      code: "Duplicated",
      message,
    });
  }
};

export const ShouldExist = async <T>(
  target: T | undefined | Promise<T | undefined>,
  variables: Record<string, any> = {},
): Promise<T> => {
  const value = await target;

  // if value is undefined or empty array, throw not found error
  if (!value || (Array.isArray(value) && value.length === 0)) {
    const message = `${formatVariables(variables)} not found`;
    throw createJsonError({
      statusCode: 404,
      code: "NotFound",
      message,
    });
  }
  return value;
};

export const CouldExist = async <T>(
  condition: boolean,
  target: T | undefined | Promise<T | undefined>,
  variables: Record<string, any> = {},
): Promise<T | undefined> => {
  if (condition) {
    return await ShouldExist(target, variables);
  }
};


const formatVariables = (variables: Record<string, any>) => {
  return Object.entries(variables)
    .map(([key, value]) => `$${key}=${value}`)
    .join(", ");
};

export function querySchemaToParameters(querySchema: {
  properties: Record<
    string,
    {
      type: string;
      description: string;
      example?: any;
      enum?: readonly string[];
    }
  >;
}) {
  return Object.entries(querySchema.properties).map(([key, value]) => {
    const { type, description, enum: _enum } = value;
    return {
      name: key,
      in: "query",
      required: false,
      description,
      schema: { type, enum: _enum },
      example: value.example,
      enum: value.enum,
    };
  });
}

export function pathSchemaToParameters(pathSchema: {
  properties: Record<string, { type: string; description: string; example?: any }>;
}) {
  return Object.entries(pathSchema.properties).map(([key, value]) => {
    const { type, description } = value;
    return {
      name: key,
      in: "path",
      required: true,
      description,
      schema: { type },
      example: value.example,
    };
  });
}

export function convertKeysWithDotToNestedObjects(target: Record<string, any>) {
  const result: Record<string, any> = {};
  const keysWithDot = Object.keys(target).filter((key) => key.includes("."));

  for (const key in target) {
    if (!keysWithDot.includes(key)) {
      result[key] = target[key];
    }

    if (keysWithDot.includes(key)) {
      const keyParts = key.split(".");
      let currentItem = result;
      for (let i = 0; i < keyParts.length - 1; i++) {
        const currentKey = keyParts[i];
        if (!currentItem[currentKey]) {
          currentItem[currentKey] = {};
        }
        currentItem = currentItem[currentKey];
      }
      const lastKey = keyParts[keyParts.length - 1];
      currentItem[lastKey] = target[key];
    }
  }

  return result;
}

export function extractRegionFromBucket(bucket: string) {
  const regex = /^recon-core-operative\.([a-zA-Z0-9-]+)\.amazonaws\.com\//;
  const match = bucket.match(regex);

  if (match && match[1]) {
    return match[1];
  } else {
    return "ap-northeast-2";
  }
}

export function camelToSnake(obj: any): any {
  if (typeof obj !== "object" || obj === null) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => camelToSnake(item));
  }

  return Object.keys(obj).reduce((acc: any, key: string) => {
    const value = obj[key];
    const snakeKey = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
    acc[snakeKey] = camelToSnake(value);
    return acc;
  }, {});
}

export function combineArray<T>(arr: T[], targetFieldName: string, resultFieldName: string) {
  // 그룹 이름을 저장할 객체
  const groupNamesMap: any = {};

  // 배열을 순회하면서 그룹 이름을 매핑합니다.
  arr.forEach((item: any) => {
    const { idx, id, [targetFieldName]: group_name } = item;
    if (!groupNamesMap[id]) {
      groupNamesMap[id] = { idx, id, [resultFieldName]: [] };
    }
    groupNamesMap[id][resultFieldName].push(group_name);
  });

  return Object.values(groupNamesMap);
}
