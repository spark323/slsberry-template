import { createError } from "@middy/util";

import { ResultType } from "../../types/types.js";

// remove all undefined values from an object
import dotenv from 'dotenv';

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
  error.message = JSON.stringify({ message, code, result: ResultType.Error });
  error.expose = true;


  return error;
};
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
export const getEnv = (key: string, defaultValue?: string): string | undefined => {
  let stage = process.env.STAGE || process.env.stage || "dev";

  console.log("getting env stage:", stage)
  dotenv.config({
    path: `env/env.${stage}`,
    override: true  // This ensures dotenv values override existing environment variables
  });
  // Object.entries(process.env).forEach(([key, value]) => {
  //   console.log(`${key}=${value}`);
  // });
  const value = process.env[`${key}`] || defaultValue;
  console.log(`getEnv: ${key}=${value}`);
  return value;

}
export function querySchemaToParameters(querySchema: {
  properties: Record<
    string,
    {
      type: string;
      description: string;
      example?: any;
      enum?: readonly string[];
    }
  >,
  required: readonly string[];
  additionalProperties?: boolean;
}) {
  return Object.entries(querySchema.properties).map(([key, value]) => {
    const { type, description, enum: _enum } = value;
    return {
      name: key,
      in: "query",
      required: querySchema.required.includes(key),
      description,
      schema: { type, enum: _enum },
      example: value.example,
      enum: value.enum,
    };
  });
}