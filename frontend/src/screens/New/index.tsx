import React, { useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import styled from "styled-components";
import { useNavigate } from "react-router-dom";

// Generate UUID v4
const generateUUID = (): string => {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

const NewScreen: React.FC = () => {
  const [input, setInput] = useState("");
  const navigate = useNavigate();

  const handleStartBuilding = () => {
    if (input.trim()) {
      const sessionId = generateUUID();
      navigate(`/create?session_id=${sessionId}`, {
        state: { initialPrompt: input, session_id: sessionId },
      });
    }
  };

  return (
    <Outer className="flex flex-row items-center flex-1">
      <CenterColumn className="flex flex-col gap-16 flex-1">
        <LogoTitleGroup className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold">What do you want build?</h1>
          <p className="text-lg font-normal">
            Build a website with Beam Sandboxes.
          </p>
        </LogoTitleGroup>
        <PromptCard>
          <TextareaWrapper>
            <PaperclipIcon />
            <Textarea
              rows={3}
              placeholder="What do you want to build?"
              value={input}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                setInput(e.target.value)
              }
              onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleStartBuilding();
                }
              }}
            />
            <RunButton>
              <Button onClick={handleStartBuilding}>Start Building</Button>
            </RunButton>
          </TextareaWrapper>
        </PromptCard>
      </CenterColumn>
    </Outer>
  );
};

export default NewScreen;

const Outer = styled.div`
  min-height: 100vh;
  width: 100vw;
  display: flex;
  flex-direction: row;
  align-items: center;
`;

const CenterColumn = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100vw;
  max-width: 100vw;
`;

const LogoTitleGroup = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 0px;
`;

const PromptCard = styled.div`
  border-radius: 22px;
  padding: 0px 0px 0px 0px;
  height: 150px;
  width: 100%;
  max-width: 600px;
  margin-bottom: 28px;
  display: flex;
  flex-direction: column;
  align-items: stretch;
`;

const TextareaWrapper = styled.div`
  position: relative;
  width: 100%;
  min-height: 90px;
  display: flex;
  align-items: stretch;
`;

const PaperclipIcon = styled.div`
  position: absolute;
  left: 14px;
  bottom: 16px;
  z-index: 2;
  font-size: 20px;
`;

const RunButton = styled.div`
  position: absolute;
  right: 16px;
  bottom: 16px;
  z-index: 2;
`;
