from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import List, Dict, Any

class UserCreate(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    email: EmailStr

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class UploadedFileResponse(BaseModel):
    id: str
    original_filename: str
    upload_date: datetime

class TableDataResponse(BaseModel):
    data: List[Dict[str, Any]]
    total_count: int
    page: int
    page_size: int
    columns: List[str]

class ChartDataResponse(BaseModel):
    chart_type: str
    data: List[Dict[str, Any]]
    x_column: str
    y_column: str