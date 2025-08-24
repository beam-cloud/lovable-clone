import json
import time
import uuid
from dataclasses import dataclass
from enum import Enum

from beam import Image, PythonVersion, realtime

from baml_client.sync_client import BamlSyncClient, b
from baml_client.types import Message as ConvoMessage

from .tools import create_app_environment, edit_code, load_code


class MessageType(Enum):
    INIT = "init"
    USER = "user"
    AGENT_PARTIAL = "agent_partial"
    AGENT_FINAL = "agent_final"
    LOAD_CODE = "load_code"
    EDIT_CODE = "edit_code"
    UPDATE_IN_PROGRESS = "update_in_progress"
    UPDATE_FILE = "update_file"
    UPDATE_COMPLETED = "update_completed"


@dataclass
class Message:
    id: str
    timestamp: int
    type: MessageType
    data: dict
    session_id: str

    @classmethod
    def new(
        cls,
        type: MessageType,
        data: dict,
        id: str | None = None,
        session_id: str | None = None,
    ) -> "Message":
        return cls(
            type=type,
            data=data,
            id=id or str(uuid.uuid4()),
            timestamp=time.time_ns() // 1_000_000,
            session_id=session_id or str(uuid.uuid4()),
        )

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "type": self.type.value,
            "data": self.data,
            "timestamp": self.timestamp,
            "session_id": self.session_id,
        }


class Agent:
    def __init__(self):
        self.model_client: BamlSyncClient = b
        self.session_data: dict = {}  # map of session -> session_data
        self.history: list[dict] = []

    async def init(self, session_id: str) -> bool:
        exists = await self.create_app_environment(session_id)
        return exists

    async def create_app_environment(self, session_id: str):
        if session_id not in self.session_data:
            self.session_data[session_id] = create_app_environment()
            return False

        return True

    async def load_code(self, *, session_id: str):
        sandbox_id = self.session_data[session_id]["sandbox_id"]
        return load_code(sandbox_id)

    async def edit_code(self, *, session_id: str, code_map: dict):
        sandbox_id = self.session_data[session_id]["sandbox_id"]
        return edit_code(sandbox_id, code_map)

    async def add_to_history(self, user_feedback: str, agent_plan: str):
        self.history.append(
            {
                "role": "user",
                "content": user_feedback,
            }
        )

        self.history.append(
            {
                "role": "assistant",
                "content": agent_plan,
            }
        )

    def get_history(self):
        return [
            ConvoMessage(role=msg["role"], content=msg["content"])
            for msg in self.history
        ]

    async def send_feedback(self, *, session_id: str, feedback: str):
        yield Message.new(MessageType.UPDATE_IN_PROGRESS, {}).to_dict()

        code_map, package_json = await self.load_code(session_id=session_id)

        code_files = []
        for path, content in code_map.items():
            code_files.append({"path": path, "content": str(content)})

        history = self.get_history()
        stream = self.model_client.stream.EditCode(
            history, feedback, code_files, package_json
        )
        sent_plan = False

        new_code_map = {}
        plan_msg_id = str(uuid.uuid4())
        file_msg_id = str(uuid.uuid4())

        for partial in stream:
            if partial.plan.state != "Complete" and not sent_plan:
                yield Message.new(
                    MessageType.AGENT_PARTIAL,
                    {"text": partial.plan.value},
                    id=plan_msg_id,
                    session_id=session_id,
                ).to_dict()

            if partial.plan.state == "Complete" and not sent_plan:
                yield Message.new(
                    MessageType.AGENT_FINAL,
                    {"text": partial.plan.value},
                    id=plan_msg_id,
                    session_id=session_id,
                ).to_dict()

                await self.add_to_history(feedback, partial.plan.value)

                sent_plan = True

            for file in partial.files:
                if file.path not in new_code_map:
                    yield Message.new(
                        MessageType.UPDATE_FILE,
                        {"text": f"Working on {file.path}"},
                        id=file_msg_id,
                        session_id=session_id,
                    ).to_dict()

                    new_code_map[file.path] = file.content

        await self.edit_code(session_id=session_id, code_map=new_code_map)

        yield Message.new(
            MessageType.UPDATE_COMPLETED, {}, session_id=session_id
        ).to_dict()


async def _load_agent():
    agent = Agent()
    print("Loaded agent")
    return agent


@realtime(
    cpu=1.0,
    memory=1024,
    on_start=_load_agent,
    image=Image(
        python_packages="requirements.txt", python_version=PythonVersion.Python312
    ),
    secrets=["OPENAI_API_KEY"],
    concurrent_requests=1000,
    keep_warm_seconds=300,
)
async def handler(event, context):
    agent: Agent = context.on_start_value
    msg = json.loads(event)

    match msg.get("type"):
        case MessageType.USER.value:
            session_id = msg["data"]["session_id"]

            return agent.send_feedback(
                session_id=session_id,
                feedback=msg["data"]["text"],
            )
        case MessageType.INIT.value:
            session_id = msg["data"]["session_id"]
            exists = await agent.init(session_id=session_id)

            data = agent.session_data[session_id]
            data["exists"] = exists

            return Message.new(
                MessageType.INIT,
                session_id=session_id,
                data=data,
            ).to_dict()

        case MessageType.LOAD_CODE.value:
            session_id = msg["data"]["session_id"]

            code_map = await agent.load_code(
                session_id=session_id,
            )

            return Message.new(MessageType.LOAD_CODE, code_map).to_dict()
        case _:
            return {}
