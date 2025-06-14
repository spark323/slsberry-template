import { Context } from "aws-lambda";


export enum ResultType {
  Success = "success",
  Error = "error",
}
export enum WebsocketMessageResultType {
  Success = "success",
  Error = "error",

}


export type MessageData = {
  partition_key: string;
  room_id: string;
  user_id: string;
  content: string;
  formattedTime: string;
  timestamp: number;
  type: string;
};


