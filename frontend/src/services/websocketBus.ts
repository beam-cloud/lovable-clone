import { MessageBus } from "./messageBus";
import type { Message } from "../types/messages";
import { MessageType, createMessage } from "../types/messages";

export interface WebSocketBusConfig {
  url: string;
  token: string;
  messageBus: MessageBus;
  sessionId?: string;
}

export class WebSocketBus {
  private ws: WebSocket | null = null;
  private config: WebSocketBusConfig;
  private isReady = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  constructor(config: WebSocketBusConfig) {
    this.config = config;
  }

  private websocketUrl(): string {
    const url = new URL(this.config.url);
    url.searchParams.set("auth_token", this.config.token);
    return url.toString();
  }

  public async connect(): Promise<WebSocket> {
    const wsUrl = this.websocketUrl();
    this.ws = new WebSocket(wsUrl);

    this.ws.onmessage = (event: MessageEvent) => {
      try {
        const rawMessage = JSON.parse(event.data);
        console.log("Received WebSocket message:", rawMessage);

        const message = this.convertRawMessage(rawMessage);
        if (message) {
          // Handle ping messages automatically
          if (message.type === MessageType.PING) {
            this.sendMessage(createMessage(MessageType.PING, {}));
          }
          this.config.messageBus.emit(message);
        }
      } catch (error) {
        console.error("Failed to parse WebSocket message:", error);
        this.config.messageBus.sendError("Failed to parse message", {
          rawData: event.data,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    };

    this.ws.onopen = () => {
      console.log("WebSocket connected");
      this.isReady = true;
      this.reconnectAttempts = 0;
      this.config.messageBus.setConnected(true);

      const initData = this.config.sessionId
        ? { session_id: this.config.sessionId }
        : {};
      console.log(
        "Sending INIT message with session_id:",
        this.config.sessionId
      );
      this.sendMessage(createMessage(MessageType.INIT, initData));
    };

    this.ws.onclose = (event) => {
      console.log("WebSocket closed:", event.code, event.reason);
      this.isReady = false;
      this.config.messageBus.setConnected(false);

      if (
        event.code !== 1000 &&
        this.reconnectAttempts < this.maxReconnectAttempts
      ) {
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = (error) => {
      console.error("WebSocket error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "WebSocket connection error";
      this.config.messageBus.sendError(errorMessage, {
        originalError: error,
      });
    };

    // Wait for connection to be ready
    while (!this.isReady) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    if (!this.ws) {
      throw new Error("WebSocket connection failed");
    }

    return this.ws;
  }

  private scheduleReconnect(): void {
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    console.log(
      `Scheduling reconnect attempt ${this.reconnectAttempts} in ${delay}ms`
    );

    setTimeout(() => {
      if (!this.isReady) {
        this.connect().catch((error) => {
          console.error("Reconnect failed:", error);
        });
      }
    }, delay);
  }

  private convertRawMessage(rawMessage: any): Message | null {
    if (
      !rawMessage ||
      (typeof rawMessage === "object" && Object.keys(rawMessage).length === 0)
    ) {
      return null;
    }

    // Handle different message formats from the server
    if (rawMessage.type) {
      // Check if the raw type is a valid MessageType enum value
      if (Object.values(MessageType).includes(rawMessage.type)) {
        return createMessage(
          rawMessage.type as MessageType,
          {
            ...rawMessage.data,
            text: rawMessage.data?.text,
            error: rawMessage.error,
          },
          rawMessage.id,
          rawMessage.timestamp
        );
      }
    }

    // Handle nested data format
    if (rawMessage.data && rawMessage.data.type) {
      if (Object.values(MessageType).includes(rawMessage.data.type)) {
        return createMessage(
          rawMessage.data.type as MessageType,
          {
            ...rawMessage.data,
            text: rawMessage.data.text || rawMessage.text,
            error: rawMessage.data.error || rawMessage.error,
          },
          rawMessage.id,
          rawMessage.timestamp
        );
      }
    }

    return null;
  }

  public sendMessage(message: Message): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const wsMessage = {
        type: message.type,
        data: message.data,
        id: message.id,
        timestamp: message.timestamp,
      };

      const messageStr = JSON.stringify(wsMessage);
      console.log("Sending WebSocket message:", messageStr);
      this.ws.send(messageStr);
    } else {
      console.error("WebSocket is not connected");
      throw new Error("WebSocket is not connected");
    }
  }

  public disconnect(): void {
    if (this.ws) {
      this.ws.close(1000, "Client disconnect");
      this.ws = null;
      this.isReady = false;
    }
  }

  public getConnected(): boolean {
    return this.isReady && this.ws?.readyState === WebSocket.OPEN;
  }
}

export const createWebSocketBus = (
  url: string,
  token: string,
  messageBus: MessageBus,
  sessionId?: string
): WebSocketBus => {
  return new WebSocketBus({ url, token, messageBus, sessionId });
};
