from pydantic import BaseModel, Field
from enum import Enum
from langchain_openai import ChatOpenAI
from langchain_ollama import ChatOllama
from langgraph.graph import StateGraph, END
from typing import Optional

class ComplaintCategory(str, Enum):
    """Allowed complaint categories"""
    ACADEMIC = "academic"
    FACILITIES = "facilities"
    HOSTEL = "hostel"
    TRANSPORT = "transport"
    FOOD = "food"
    OTHER = "other"

class RelatedDepartments(str, Enum):
    """Allowed departments related to the complaint"""
    ACADEMIC = "academic"
    ADMINISTRATION = "administration"
    HOSTEL = "hostel"
    TECHNICAL = "technical"
    CANTEEN = "canteen"
    SECURITY = "security"
    MANAGEMENT = "management"
    EMERGENCY = "emergency"
    HOUSEKEEPING = "housekeeping"
    OTHER = "other"

class AcademicDepartments(str, Enum):
    """Allowed Departments related to the complaint"""
    AL = "additional_languages"
    ANI = "animation"
    CTV = "cinema_and_television"
    DG = "design"
    EC = "economics"
    EN = "english"
    JN = "journalism"
    SW = "social_work"
    SOC = "sociology"
    AQUA = "aquaculture"
    BOT = "botany"
    EVS = "environmental_studies"
    CHE = "chemistry"
    CS = "computer_science"
    MAT = "mathematics"
    PHY = "physics"
    PSY = "psychology"
    ZOO = "zoology"
    COM = "commerce"
    MAN = "management"
    PE = "physical_education"

class PriorityLevel(str, Enum):
    """Allowed priority levels for complaints"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"

class ResponseSchema(BaseModel):
    """Structured response format"""
    title: str = Field(description="The possible title of the complaint")
    desc: str = Field(description="The original complaint as itself")
    category: ComplaintCategory = Field(description="Category of the complaint")
    department: RelatedDepartments = Field(description="Department related to the complaint")
    academic_department: Optional[AcademicDepartments] = Field(
        default=None, description="Specific academic department related to the complaint"
    )
    comments: str = Field(description="Comments to the complaint reviewer")
    priority: PriorityLevel = Field(description="Priority level of the complaint")

model = ChatOpenAI(model="gpt-4o-mini")
structured_model = model.with_structured_output(ResponseSchema)

class AgentState(BaseModel):
    input: str
    output: Optional[ResponseSchema] = None

def process_input(state: AgentState) -> dict:
    response = structured_model.invoke(f"Process this complaint: {state.input}")
    return {"output": response}

workflow = StateGraph(AgentState)
workflow.add_node("process", process_input)
workflow.set_entry_point("process")
workflow.add_edge("process", END)

graph = workflow.compile()

def input_processor(input_text) -> ResponseSchema:
    """Process input and return the ResponseSchema object directly"""
    response = graph.invoke({"input": input_text})
    return response["output"]