import {
  ComputerIcon,
  ExternalLink,
  Heart,
  Loader2,
  PhoneIcon,
  Play,
  RotateCcw,
  TabletIcon,
} from "lucide-react";
import { MessageType, Sender } from "../../types/messages";
import { useCallback, useEffect, useRef, useState } from "react";

import { BEAM_CONFIG } from "../../config/beam";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Message } from "../../types/messages";
import styled from "styled-components";
import { useLocation, useSearchParams } from "react-router-dom";
import { useMessageBus } from "../../hooks/useMessageBus";

const DEVICE_SPECS = {
  mobile: { width: 390, height: 844 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: "100%", height: "100%" },
};

const Create = () => {
  const [inputValue, setInputValue] = useState("");
  const [sidebarWidth, setSidebarWidth] = useState(400);
  const [isResizing, setIsResizing] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [iframeUrl, setIframeUrl] = useState("");
  const [iframeError, setIframeError] = useState(false);
  const [iframeReady, setIframeReady] = useState(false);
  const [isUpdateInProgress, setIsUpdateInProgress] = useState(false);
  const [initCompleted, setInitCompleted] = useState(false);
  const [sandboxExists, setSandboxExists] = useState(false);
  const chatHistoryRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const hasConnectedRef = useRef(false);
  const processedMessageIds = useRef<Set<string>>(new Set());
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const sessionId =
    searchParams.get("session_id") || location.state?.session_id;
  const initialPromptSent = useRef(false);
  const [selectedDevice, setSelectedDevice] = useState<
    "mobile" | "tablet" | "desktop"
  >("desktop");

  // Debug log for session_id
  useEffect(() => {
    if (sessionId) {
      console.log("Session ID initialized:", sessionId);
    }
  }, [sessionId]);

  const refreshIframe = useCallback(() => {
    if (iframeRef.current && iframeUrl && iframeUrl !== "/") {
      setIframeReady(false);
      setIframeError(false);

      // First refresh
      const currentSrc = iframeRef.current.src;
      iframeRef.current.src = "";

      setTimeout(() => {
        if (iframeRef.current) {
          iframeRef.current.src = currentSrc;

          // Second refresh after a longer delay
          setTimeout(() => {
            if (iframeRef.current) {
              iframeRef.current.src = "";

              setTimeout(() => {
                if (iframeRef.current) {
                  iframeRef.current.src = currentSrc;
                }
              }, 200);
            }
          }, 500);
        }
      }, 300);
    }
  }, [iframeUrl]);

  // Message handlers for different message types
  const messageHandlers = {
    [MessageType.INIT]: (message: Message) => {
      const id = message.id;
      if (id) {
        if (processedMessageIds.current.has(id)) {
          console.log("Skipping duplicate INIT message:", id);
          return;
        }
        processedMessageIds.current.add(id);
        console.log("Processing INIT message:", id);
      }

      if (typeof message.data.url === "string" && message.data.sandbox_id) {
        setIframeUrl(message.data.url);
        setIframeError(false);
      }

      // Check if sandbox already exists
      if (message.data.exists === true) {
        setSandboxExists(true);
        console.log("Sandbox already exists, skipping initial prompt");
      }

      setMessages((prev) => {
        if (id) {
          const existingIndex = prev.findIndex((msg) => msg.id === id);
          if (existingIndex !== -1) {
            // Update in place
            return prev.map((msg, idx) =>
              idx === existingIndex
                ? {
                    ...msg,
                    timestamp: message.timestamp || msg.timestamp,
                    data: {
                      ...msg.data,
                      text: "Workspace loaded! You can now make edits here.",
                      sender: Sender.ASSISTANT,
                    },
                  }
                : msg
            );
          }
        }
        // Insert new
        return [
          ...prev,
          {
            ...message,
            timestamp: message.timestamp || Date.now(),
            data: {
              ...message.data,
              text: "Workspace loaded! You can now make edits here.",
              sender: Sender.ASSISTANT,
            },
          },
        ];
      });
      setInitCompleted(true);
    },

    [MessageType.ERROR]: (message: Message) => {
      setMessages((prev) => [
        ...prev,
        {
          ...message,
          timestamp: message.timestamp || Date.now(),
          data: {
            ...message.data,
            sender: Sender.ASSISTANT,
          },
        },
      ]);
    },

    [MessageType.AGENT_PARTIAL]: (message: Message) => {
      const text = message.data.text;
      const id = message.id;

      if (!id) {
        console.warn("AGENT_PARTIAL message missing id, ignoring:", message);
        return;
      }

      if (text && text.trim()) {
        setMessages((prev) => {
          const existingIndex = prev.findIndex((msg) => msg.id === id);
          if (existingIndex !== -1) {
            return prev.map((msg, idx) =>
              idx === existingIndex
                ? {
                    ...msg,
                    timestamp: message.timestamp || msg.timestamp,
                    data: {
                      ...msg.data,
                      text: text.replace(/\\/g, ""),
                      sender: Sender.ASSISTANT,
                      isStreaming: true,
                    },
                  }
                : msg
            );
          }
          // Insert new
          return [
            ...prev,
            {
              ...message,
              timestamp: message.timestamp || Date.now(),
              data: {
                ...message.data,
                text: text.replace(/\\/g, ""),
                isStreaming: true,
                sender: Sender.ASSISTANT,
              },
            },
          ];
        });
      }
    },

    [MessageType.AGENT_FINAL]: (message: Message) => {
      const text = message.data.text;
      const id = message.id;
      if (!id) {
        console.warn("AGENT_FINAL message missing id, ignoring:", message);
        return;
      }
      if (text && text.trim()) {
        setMessages((prev) => {
          const existingIndex = prev.findIndex((msg) => msg.id === id);
          if (existingIndex !== -1) {
            return prev.map((msg, idx) =>
              idx === existingIndex
                ? {
                    ...msg,
                    timestamp: message.timestamp || msg.timestamp,
                    data: {
                      ...msg.data,
                      text: text.replace(/\\/g, ""),
                      isStreaming: false,
                      sender: Sender.ASSISTANT,
                    },
                  }
                : msg
            );
          }
          // Insert new
          return [
            ...prev,
            {
              ...message,
              timestamp: message.timestamp || Date.now(),
              data: {
                ...message.data,
                text: text.replace(/\\/g, ""),
                isStreaming: false,
                sender: Sender.ASSISTANT,
              },
            },
          ];
        });
      }
    },

    [MessageType.UPDATE_IN_PROGRESS]: (message: Message) => {
      setIsUpdateInProgress(true);

      const id = message.id;

      setMessages((prev) => {
        if (id) {
          const existingIndex = prev.findIndex((msg) => msg.id === id);
          if (existingIndex !== -1) {
            return prev.map((msg, idx) =>
              idx === existingIndex
                ? {
                    ...msg,
                    timestamp: message.timestamp || msg.timestamp,
                    data: {
                      ...msg.data,
                      text: "Ok - I'll make those changes!",
                      sender: Sender.ASSISTANT,
                    },
                  }
                : msg
            );
          }
        }

        return [
          ...prev,
          {
            ...message,
            timestamp: message.timestamp || Date.now(),
            data: {
              ...message.data,
              text: "Ok - I'll make those changes!",
              sender: Sender.ASSISTANT,
            },
          },
        ];
      });
    },

    [MessageType.UPDATE_FILE]: (message: Message) => {
      const id = message.id;
      if (!id) {
        console.warn("UPDATE_FILE message missing id, ignoring:", message);
        return;
      }
      setMessages((prev) => {
        const existingIndex = prev.findIndex((msg) => msg.id === id);
        if (existingIndex !== -1) {
          return prev.map((msg, idx) =>
            idx === existingIndex
              ? {
                  ...msg,
                  timestamp: message.timestamp || msg.timestamp,
                  data: {
                    ...msg.data,
                    text: message.data.text,
                    sender: Sender.ASSISTANT,
                    isStreaming: true,
                  },
                }
              : msg
          );
        }
        // Insert new
        return [
          ...prev,
          {
            ...message,
            timestamp: message.timestamp || Date.now(),
            data: {
              ...message.data,
              text: message.data.text,
              sender: Sender.ASSISTANT,
              isStreaming: true,
            },
          },
        ];
      });
    },

    [MessageType.UPDATE_COMPLETED]: (message: Message) => {
      setIsUpdateInProgress(false);
      const id = message.id;
      setMessages((prev) => {
        // Remove all UPDATE_FILE messages
        const filtered = prev.filter(
          (msg) => msg.type !== MessageType.UPDATE_FILE
        );

        if (id) {
          const existingIndex = filtered.findIndex((msg) => msg.id === id);
          if (existingIndex !== -1) {
            return filtered.map((msg, idx) =>
              idx === existingIndex
                ? {
                    ...msg,
                    timestamp: message.timestamp || msg.timestamp || Date.now(),
                    data: {
                      ...msg.data,
                      text: "Update completed!",
                      sender: Sender.ASSISTANT,
                    },
                  }
                : msg
            );
          }
        }
        // Insert new
        return [
          ...filtered,
          {
            ...message,
            timestamp: message.timestamp || Date.now(),
            data: {
              ...message.data,
              text: "Update completed!",
              sender: Sender.ASSISTANT,
            },
          },
        ];
      });
      refreshIframe();
    },
  };

  const { isConnected, error, connect, send } = useMessageBus({
    wsUrl: BEAM_CONFIG.WS_URL,
    token: BEAM_CONFIG.TOKEN,
    sessionId: sessionId,
    handlers: messageHandlers,
    onConnect: () => {
      console.log("Connected to Beam Cloud");
    },
    onDisconnect: () => {
      hasConnectedRef.current = false;
    },
    onError: (errorMsg) => {
      console.error("Connection error:", errorMsg);

      let errorString = "Unknown connection error";
      if (typeof errorMsg === "string") {
        errorString = errorMsg;
      } else if (errorMsg && typeof errorMsg === "object") {
        const errorObj = errorMsg as { message?: unknown };
        if (errorObj.message) {
          errorString = String(errorObj.message);
        }
      }

      console.error("Processed error:", errorString);
    },
  });

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (chatHistoryRef.current) {
      chatHistoryRef.current.scrollTop = chatHistoryRef.current.scrollHeight;
    }
  }, [messages]);

  // Handle resizing
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizing) {
        const newWidth = e.clientX;
        setSidebarWidth(Math.max(300, Math.min(800, newWidth)));
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing]);

  const handleSendMessage = () => {
    if (inputValue.trim()) {
      send(MessageType.USER, { text: inputValue });
      setInputValue("");
      setMessages((prev) => [
        ...prev,
        {
          type: MessageType.USER,
          timestamp: Date.now(),
          data: {
            text: inputValue,
            sender: Sender.USER,
          },
          session_id: sessionId,
        },
      ]);
    }
  };

  useEffect(() => {
    if (iframeUrl && isConnected) {
      setIframeError(false);
    }
  }, [iframeUrl, isConnected]);

  const handleIframeLoad = () => {
    console.log("Iframe loaded successfully:", iframeUrl);
    setIframeError(false);
    setIframeReady(true);
  };

  const handleIframeError = () => {
    console.error("Iframe failed to load:", iframeUrl);
    setIframeError(true);
  };

  // Auto-connect when sessionId is available
  useEffect(() => {
    if (!isConnected && !hasConnectedRef.current && sessionId) {
      console.log("Connecting to Workspace with sessionId:", sessionId);
      hasConnectedRef.current = true;
      connect();
    }
  }, [isConnected, sessionId]); // Removed 'connect' from dependencies to prevent reconnection loops

  // Clear processed message IDs when connection is lost
  useEffect(() => {
    if (!isConnected) {
      processedMessageIds.current.clear();
    }
  }, [isConnected]);

  useEffect(() => {
    setIframeReady(false);
  }, [iframeUrl]);

  useEffect(() => {
    if (
      initCompleted &&
      !sandboxExists &&
      location.state &&
      location.state.initialPrompt &&
      !initialPromptSent.current
    ) {
      // Send as user message (so it appears in chat)
      send(MessageType.USER, { text: location.state.initialPrompt });
      setMessages((prev) => [
        ...prev,
        {
          type: MessageType.USER,
          timestamp: Date.now(),
          data: {
            text: location.state.initialPrompt,
            sender: Sender.USER,
          },
          session_id: sessionId,
        },
      ]);
      initialPromptSent.current = true;
    }
  }, [
    initCompleted,
    sandboxExists,
    location.state,
    send,
    setMessages,
    sessionId,
  ]);

  const LoadingState = () => (
    <IframeErrorContainer>
      <SpinningIcon>
        <Loader2 size={64} />
      </SpinningIcon>
      <AnimatedText style={{ marginTop: "24px" }}>
        Connecting to Workspace...
      </AnimatedText>
      <p style={{ marginTop: "12px", textAlign: "center" }}>
        Please wait while we setup your workspace and load the website.
      </p>
    </IframeErrorContainer>
  );

  const UpdateInProgressState = () => (
    <IframeErrorContainer>
      <SpinningIcon>
        <Loader2 size={64} />
      </SpinningIcon>
      <AnimatedText style={{ marginTop: "24px" }}>
        Updating Workspace...
      </AnimatedText>
      <p style={{ marginTop: "12px", textAlign: "center" }}>
        Please wait while we apply your changes to the website.
      </p>
    </IframeErrorContainer>
  );

  return (
    <PageContainer>
      <Sidebar style={{ width: `${sidebarWidth}px` }}>
        <BeamHeader>
          <div>Beam</div>
        </BeamHeader>

        <ChatHistory ref={chatHistoryRef}>
          {messages
            .filter(
              (msg) =>
                msg.data.text &&
                typeof msg.data.text === "string" &&
                msg.data.text.trim()
            )
            .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
            .map((msg, index) => (
              <MessageContainer
                key={msg.id || `msg-${index}-${msg.timestamp || Date.now()}`}
                isUser={msg.data.sender === Sender.USER}
              >
                <MessageBubble
                  isUser={msg.data.sender === Sender.USER}
                  className="border w-full bg-muted-foreground/10 rounded-md text-sm text-muted-foreground"
                >
                  <p
                    style={{
                      whiteSpace: "pre-wrap",
                      color:
                        msg.data.sender === Sender.USER ? "white" : "gray12",
                    }}
                  >
                    {String(msg.data.text || "")}
                  </p>
                  {msg.data.isStreaming && (
                    <TypingIndicator>
                      <TypingDot />
                      <TypingDot />
                      <TypingDot />
                    </TypingIndicator>
                  )}
                </MessageBubble>
              </MessageContainer>
            ))}
        </ChatHistory>

        <ChatInputContainer>
          <Input
            placeholder="Ask Beam..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
            disabled={!isConnected || !iframeReady}
          />
          <Button
            onClick={handleSendMessage}
            disabled={!isConnected || !iframeReady || !inputValue.trim()}
          >
            Send
          </Button>
        </ChatInputContainer>
      </Sidebar>

      <ResizeHandle onMouseDown={() => setIsResizing(true)} />

      <MainContent hasIframe={!!iframeUrl} className="bg-card">
        {isConnected ? (
          <IframeContainer>
            <UrlBarContainer>
              <IconButton
                style={{ cursor: iframeUrl ? "pointer" : "not-allowed" }}
                onClick={iframeUrl ? refreshIframe : undefined}
                title="Refresh"
              >
                <RotateCcw size={16} />
              </IconButton>
              <UrlInput value={iframeUrl || ""} readOnly />
              <a
                href={iframeUrl || undefined}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "flex",
                  alignItems: "center",
                  pointerEvents: iframeUrl ? "auto" : "none",
                }}
                tabIndex={iframeUrl ? 0 : -1}
              >
                <ExternalLink size={16} />
              </a>
            </UrlBarContainer>
            <IframeArea>
              {iframeError ? (
                <IframeErrorContainer>
                  <Heart size={64} />
                  <ErrorTitle style={{ marginTop: "24px" }}>
                    Failed to load website
                  </ErrorTitle>
                  <ErrorText style={{ marginTop: "12px", textAlign: "center" }}>
                    {iframeUrl} took too long to load or failed to respond.
                  </ErrorText>
                  <ErrorText style={{ marginTop: "8px", textAlign: "center" }}>
                    This could be due to network issues or the website being
                    temporarily unavailable.
                  </ErrorText>
                </IframeErrorContainer>
              ) : !iframeUrl ? (
                <IframeOverlay>
                  <LoadingState />
                </IframeOverlay>
              ) : !iframeReady || isUpdateInProgress || !initCompleted ? (
                <>
                  <IframeResponsiveWrapper>
                    <WebsiteIframe
                      ref={iframeRef}
                      src={iframeUrl}
                      sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
                      allow="fullscreen"
                      referrerPolicy="no-referrer"
                      loading="lazy"
                      isResizing={isResizing}
                      onLoad={handleIframeLoad}
                      onError={handleIframeError}
                      style={{
                        visibility:
                          iframeReady && !isUpdateInProgress
                            ? "visible"
                            : "hidden",
                        width:
                          typeof DEVICE_SPECS[selectedDevice].width === "number"
                            ? `${DEVICE_SPECS[selectedDevice].width}px`
                            : DEVICE_SPECS[selectedDevice].width,
                        height:
                          typeof DEVICE_SPECS[selectedDevice].height ===
                          "number"
                            ? `${DEVICE_SPECS[selectedDevice].height}px`
                            : DEVICE_SPECS[selectedDevice].height,
                        margin:
                          selectedDevice === "desktop" ? "0" : "24px auto",
                        display: "block",
                        borderRadius: selectedDevice === "desktop" ? 0 : 16,
                        boxShadow:
                          selectedDevice === "desktop"
                            ? "none"
                            : "0 2px 16px rgba(0,0,0,0.12)",
                        background: "#fff",
                        boxSizing: "border-box",
                      }}
                    />
                  </IframeResponsiveWrapper>
                  <IframeOverlay>
                    {isUpdateInProgress || (!iframeReady && !initCompleted) ? (
                      <UpdateInProgressState />
                    ) : (
                      <LoadingState />
                    )}
                  </IframeOverlay>
                </>
              ) : (
                <IframeResponsiveWrapper>
                  <WebsiteIframe
                    ref={iframeRef}
                    src={iframeUrl}
                    sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
                    allow="fullscreen"
                    referrerPolicy="no-referrer"
                    loading="lazy"
                    isResizing={isResizing}
                    onLoad={handleIframeLoad}
                    onError={handleIframeError}
                    style={{
                      visibility:
                        iframeReady && !isUpdateInProgress
                          ? "visible"
                          : "hidden",
                      width:
                        typeof DEVICE_SPECS[selectedDevice].width === "number"
                          ? `${DEVICE_SPECS[selectedDevice].width}px`
                          : DEVICE_SPECS[selectedDevice].width,
                      height:
                        typeof DEVICE_SPECS[selectedDevice].height === "number"
                          ? `${DEVICE_SPECS[selectedDevice].height}px`
                          : DEVICE_SPECS[selectedDevice].height,
                      margin: selectedDevice === "desktop" ? "0" : "24px auto",
                      display: "block",
                      borderRadius: selectedDevice === "desktop" ? 0 : 16,
                      boxShadow:
                        selectedDevice === "desktop"
                          ? "none"
                          : "0 2px 16px rgba(0,0,0,0.12)",
                      background: "#fff",
                      boxSizing: "border-box",
                    }}
                  />
                </IframeResponsiveWrapper>
              )}
            </IframeArea>
            <BottomBar>
              <ToggleGroup>
                <ToggleButton
                  active={true}
                  disabled={
                    !iframeUrl ||
                    !iframeReady ||
                    isUpdateInProgress ||
                    !initCompleted
                  }
                >
                  Preview
                </ToggleButton>
                <ToggleButton
                  active={false}
                  disabled={
                    !iframeUrl ||
                    !iframeReady ||
                    isUpdateInProgress ||
                    !initCompleted
                  }
                >
                  Code
                </ToggleButton>
              </ToggleGroup>
              <DeviceGroup>
                <DeviceButton
                  active={selectedDevice === "mobile"}
                  disabled={
                    !iframeUrl ||
                    !iframeReady ||
                    isUpdateInProgress ||
                    !initCompleted
                  }
                  onClick={() => setSelectedDevice("mobile")}
                >
                  <PhoneIcon />
                </DeviceButton>
                <DeviceButton
                  active={selectedDevice === "tablet"}
                  disabled={
                    !iframeUrl ||
                    !iframeReady ||
                    isUpdateInProgress ||
                    !initCompleted
                  }
                  onClick={() => setSelectedDevice("tablet")}
                >
                  <TabletIcon />
                </DeviceButton>
                <DeviceButton
                  active={selectedDevice === "desktop"}
                  disabled={
                    !iframeUrl ||
                    !iframeReady ||
                    isUpdateInProgress ||
                    !initCompleted
                  }
                  onClick={() => setSelectedDevice("desktop")}
                >
                  <ComputerIcon />
                </DeviceButton>
              </DeviceGroup>
              <DeployButton
                disabled={
                  !iframeUrl ||
                  !iframeReady ||
                  isUpdateInProgress ||
                  !initCompleted
                }
              >
                Deploy
              </DeployButton>
            </BottomBar>
          </IframeContainer>
        ) : (
          <>
            <Heart size={64} />
            <ConnectTitle
              style={{ marginTop: "24px" }}
              className="text-muted-foreground"
            >
              Connect to start building
            </ConnectTitle>

            {error && (
              <ErrorMessage className="text-destructive">
                <ErrorText>Error: {error}</ErrorText>
              </ErrorMessage>
            )}

            <Checklist>
              <ChecklistItem>
                <Play size={16} />
                <ChecklistText>Connect to Workspace</ChecklistText>
              </ChecklistItem>
              <ChecklistItem>
                <Play size={16} />
                <ChecklistText>Chat with AI in the sidebar</ChecklistText>
              </ChecklistItem>
              <ChecklistItem>
                <Play size={16} />
                <ChecklistText>
                  Select specific elements to modify
                </ChecklistText>
              </ChecklistItem>
            </Checklist>
          </>
        )}
      </MainContent>
    </PageContainer>
  );
};

export default Create;

const PageContainer = styled.div`
  display: flex;
  flex-direction: row;
  width: 100%;
  height: 100%;
`;

const Sidebar = styled.div`
  padding: 24px;
  display: flex;
  flex-direction: column;
  color: white;
  gap: 24px;
`;

const MainContent = styled.div<{ hasIframe: boolean }>`
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  align-items: ${({ hasIframe }) => (hasIframe ? "stretch" : "center")};
  justify-content: ${({ hasIframe }) => (hasIframe ? "stretch" : "center")};
  gap: ${({ hasIframe }) => (hasIframe ? "0" : "24px")};
`;

const Checklist = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-top: 48px;
`;

const ChecklistItem = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 12px;
`;

const BeamHeader = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 12px;
`;

const ChatHistory = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow-y: auto;
  flex-grow: 1;
`;

const MessageContainer = styled.div<{ isUser: boolean }>`
  display: flex;
  flex-direction: row;
  justify-content: ${({ isUser }) => (isUser ? "flex-end" : "flex-start")};
`;

const MessageBubble = styled.div<{ isUser: boolean }>`
  padding: 12px;
  border-radius: 8px;
  max-width: 70%;
`;

const ChatInputContainer = styled.div`
  margin-top: auto;
  display: flex;
  flex-direction: row;
  gap: 8px;
`;

const ErrorMessage = styled.div`
  border: 1px solid #f87171;
  border-radius: 6px;
  padding: 12px;
  margin-top: 16px;
`;

const TypingIndicator = styled.div`
  display: flex;
  gap: 4px;
  margin-top: 8px;
  justify-content: flex-start;
`;

const TypingDot = styled.div`
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: #9ca3af;
  animation: typing 1.4s infinite ease-in-out;

  &:nth-child(1) {
    animation-delay: -0.32s;
  }

  &:nth-child(2) {
    animation-delay: -0.16s;
  }

  @keyframes typing {
    0%,
    80%,
    100% {
      transform: scale(0.8);
      opacity: 0.5;
    }
    40% {
      transform: scale(1);
      opacity: 1;
    }
  }
`;

const ResizeHandle = styled.div`
  width: 4px;
  cursor: col-resize;
  transition: background-color 0.2s ease;

  &:hover {
    background-color: #9ca3af;
  }

  &:active {
    background-color: #3b82f6;
  }
`;

const IframeContainer = styled.div`
  position: relative;
  width: 100%;
  height: 100%;
  overflow: auto;
`;

const IframeArea = styled.div`
  position: relative;
  width: 100%;
  height: calc(100% - 56px - 40px); /* subtract bottom bar and url bar height */
  min-height: 0;
  padding: 0;
  margin: 0;
  box-sizing: border-box;
`;

const IframeResponsiveWrapper = styled.div`
  width: 100%;
  height: 100%;
  overflow: auto;
  display: flex;
  align-items: center;
  justify-content: center;

  & > iframe {
    max-width: 100%;
    max-height: 100%;
  }
`;

const WebsiteIframe = styled.iframe<{ isResizing: boolean }>`
  width: 100%;
  height: 100%;
  border: none;
  pointer-events: ${({ isResizing }) => (isResizing ? "none" : "auto")};
  display: block;
  box-sizing: border-box;
`;

const IframeErrorContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 24px;
`;

const IframeOverlay = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 2;
`;

const SpinningIcon = styled.div`
  animation: spin 1s linear infinite;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #9ca3af;

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
`;

const IconButton = styled.button`
  background: none;
  border: none;
  color: #374151;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
  border-radius: 4px;
  cursor: pointer;

  &:hover {
    background-color: #f8f9fa;
  }
`;

const AnimatedText = styled.div`
  font-size: 18px;
  font-weight: 500;
  color: #374151;
  animation: pulse 1.5s infinite;

  @keyframes pulse {
    0% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
    100% {
      opacity: 1;
    }
  }
`;

const ErrorTitle = styled.div`
  font-size: 18px;
  font-weight: 500;
  color: #374151;
`;

const ErrorText = styled.div`
  font-size: 14px;
`;

const ConnectTitle = styled.div`
  font-size: 18px;
  font-weight: 500;
`;

const ChecklistText = styled.div`
  font-size: 14px;
  color: #6b7280;
`;

const UrlBarContainer = styled.div`
  display: flex;
  align-items: center;
  background: #e9ecef;
  border-bottom: 1px solid #e5e7eb;
  padding: 6px 12px;
  gap: 8px;
`;

const UrlInput = styled.input`
  flex: 1;
  background: #f1f3f5;
  border: none;
  color: #374151;
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 14px;
  outline: none;
`;

const BottomBar = styled.div`
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #e9ecef;
  border-top: 1px solid #e5e7eb;
  padding: 0 24px;
  height: 56px;
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 3;
`;

const ToggleGroup = styled.div`
  display: flex;
  gap: 8px;
`;

const ToggleButton = styled.button<{ active?: boolean }>`
  background: ${({ active }) => (active ? "#f8f9fa" : "#e9ecef")};
  color: ${({ active, disabled }) =>
    disabled ? "#9ca3af" : active ? "#1f2937" : "#6b7280"};
  border: 1px solid #d1d5db;
  border-radius: 6px;
  padding: 6px 18px;
  font-size: 15px;
  font-weight: 500;
  cursor: ${({ disabled }) => (disabled ? "not-allowed" : "pointer")};
  transition: background 0.15s, color 0.15s;
  &:hover:not(:disabled) {
    background: #e5e7eb;
  }
`;

const DeviceGroup = styled.div`
  display: flex;
  gap: 8px;
`;

const DeviceButton = styled.button<{ active?: boolean }>`
  background: ${({ active }) => (active ? "#3b82f6" : "#e9ecef")};
  color: ${({ active, disabled }) =>
    disabled ? "#9ca3af" : active ? "white" : "#6b7280"};
  border: 1px solid #d1d5db;
  border-radius: 6px;
  padding: 6px 14px;
  font-size: 14px;
  font-weight: 500;
  cursor: ${({ disabled }) => (disabled ? "not-allowed" : "pointer")};
  transition: background 0.15s, color 0.15s;
  &:hover:not(:disabled) {
    background: #1d4ed8;
    color: white;
  }
`;

const DeployButton = styled.button`
  background: #7c3aed;
  color: white;
  border: none;
  border-radius: 6px;
  padding: 8px 28px;
  font-size: 15px;
  font-weight: 600;
  cursor: ${({ disabled }) => (disabled ? "not-allowed" : "pointer")};
  transition: background 0.15s;
  opacity: ${({ disabled }) => (disabled ? 0.6 : 1)};
  &:hover:not(:disabled) {
    background: #6d28d9;
  }
`;
