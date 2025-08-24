export enum MessageType {
  INIT = "init",
  LOAD_CODE = "load_code",
  ERROR = "error",
  PING = "ping",
  AGENT_FINAL = "agent_final",
  AGENT_PARTIAL = "agent_partial",
  USER = "user",
  UPDATE_IN_PROGRESS = "update_in_progress",
  UPDATE_FILE = "update_file",
  UPDATE_COMPLETED = "update_completed",
}

export enum Sender {
  ASSISTANT = "assistant",
  USER = "user",
}

export interface Message {
  type: MessageType;
  data: Record<string, any>;
  id?: string;
  timestamp?: number;
  session_id?: string;
}

export const createMessage = (
  type: MessageType,
  data: Record<string, any> = {},
  id?: string,
  timestamp?: number,
  session_id?: string
): Message => ({
  type,
  data,
  id,
  timestamp: timestamp || Date.now(),
  session_id,
});
