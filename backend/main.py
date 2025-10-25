import os
import io
import uuid
import json
import numpy as np
from datetime import datetime
from typing import List, Optional, Dict, Any

import pandas as pd
from fastapi import FastAPI, UploadFile, File, HTTPException, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv()

from schemas import UploadedFileResponse, TableDataResponse, ChartDataResponse

app = FastAPI(
    title="Sparelens Dashboard Backend", 
    description="API for uploading, viewing, and visualizing data from CSV/Excel files ." 
)

origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
    "http://localhost:5173"
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MONGODB_URL = os.getenv("MONGODB_URL")
client = AsyncIOMotorClient(MONGODB_URL)
db = client.data_dashboard
uploaded_files_collection = db.uploaded_files
row_data_collection = db.row_data

@app.on_event("startup")
async def startup():
    await db.command("ping")
    print("MongoDB connected.")
    await uploaded_files_collection.create_index("user_email")
    await uploaded_files_collection.create_index([("upload_date", -1)])
    await row_data_collection.create_index("uploadedFileId")

@app.on_event("shutdown")
async def shutdown():
    client.close()
    print("MongoDB disconnected.")

async def parse_and_save_data(file_content: bytes, file_id: str, user_email: str):
    try:
        try:
            df = pd.read_csv(io.BytesIO(file_content))
        except:
            df = pd.read_excel(io.BytesIO(file_content))

        if df.empty:
            raise ValueError("Uploaded file is empty.")

        rows = []
        for _, row in df.iterrows():
            row_dict = row.to_dict()
            serializable_row = {}
            for k, v in row_dict.items():
                if pd.isna(v) or v is None or (isinstance(v, float) and np.isnan(v)):
                    serializable_row[k] = None
                elif isinstance(v, (str, int, float, bool)):
                    serializable_row[k] = v
                elif isinstance(v, datetime):
                    serializable_row[k] = v.isoformat()
                elif isinstance(v, (list, dict)):
                    try:
                        json.dumps(v)
                        serializable_row[k] = v
                    except:
                        serializable_row[k] = str(v)
                else:
                    serializable_row[k] = str(v)

            rows.append({
                "uploadedFileId": file_id,
                "data": serializable_row
            })

        if rows:
            await row_data_collection.insert_many(rows)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"Parse/save error: {e}")
        raise HTTPException(status_code=500, detail="Error processing file data.")

@app.post("/uploadfile/", status_code=200)
async def upload_file(
    file: UploadFile = File(...),
    user_email: Optional[str] = Header(None, description="Optional user email for file ownership")
):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided.")

    file_id = str(uuid.uuid4())
    file_extension = file.filename.split('.')[-1] if '.' in file.filename else ''
    filename_on_disk = f"{file_id}.{file_extension}"

    try:
        file_content = await file.read()
        file_size = len(file_content)

        file_doc = {
            "_id": file_id,
            "filename": filename_on_disk,
            "original_filename": file.filename,
            "file_path": filename_on_disk,
            "file_size": file_size,
            "mime_type": file.content_type or "application/octet-stream",
            "upload_date": datetime.now(),
            "user_email": user_email or "anonymous" 
        }
        await uploaded_files_collection.insert_one(file_doc)

        await parse_and_save_data(file_content, file_id, user_email or "anonymous")

        return {"message": f"File '{file.filename}' uploaded successfully. ID: {file_id}"}

    except HTTPException:
        raise
    except Exception as e:
        try:
            await row_data_collection.delete_many({"uploadedFileId": file_id})
            await uploaded_files_collection.delete_one({"_id": file_id})
        except Exception as cleanup_e:
            print(f"Cleanup error: {cleanup_e}")
        print(f"Upload failed: {e}")
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

@app.get("/files/", response_model=List[UploadedFileResponse])
async def get_files(
    user_email: Optional[str] = Header(None, description="Optional user email to filter files")
):
    query_filter = {}
    if user_email:
        query_filter["user_email"] = user_email
    else:
        pass 


    files_cursor = uploaded_files_collection.find(
        query_filter, 
        projection={"original_filename": 1, "upload_date": 1, "_id": 1}
    ).sort("upload_date", -1)
    files = await files_cursor.to_list(length=None)
    return [
        UploadedFileResponse(
            id=f["_id"],
            original_filename=f["original_filename"],
            upload_date=f["upload_date"]
        ) for f in files
    ]

@app.get("/data/{file_id}", response_model=TableDataResponse)
async def get_data(
    file_id: str,
    page: int = 1,
    page_size: int = 10,
    sort_by: Optional[str] = None,
    sort_order: Optional[str] = "asc",
    search_query: Optional[str] = None,
    user_email: Optional[str] = Header(None, description="Optional user email to verify file ownership")
):
    find_query = {"_id": file_id}
    if user_email:
        find_query["user_email"] = user_email
    file_doc = await uploaded_files_collection.find_one(find_query)
    if not file_doc:
        raise HTTPException(404, "File not found.")

    pipeline = [{"$match": {"uploadedFileId": file_id}}]
    if search_query:
        pipeline += [
            {"$addFields": {"data_array": {"$objectToArray": "$data"}}},
            {"$match": {"data_array.v": {"$regex": search_query, "$options": "i"}}},
            {"$project": {"data": 1}}
        ]

    sort_dir = -1 if sort_order == "desc" else 1
    if sort_by:
        pipeline += [{"$sort": {f"data.{sort_by}": sort_dir}}]
    else:
        pipeline += [{"$sort": {"_id": 1}}]

    skip_count = (page - 1) * page_size
    pipeline += [
        {"$skip": skip_count},
        {"$limit": page_size},
        {"$project": {"data": 1, "_id": 0}}
    ]

    data_cursor = row_data_collection.aggregate(pipeline)
    data_list = await data_cursor.to_list(length=None)
    data = [row["data"] for row in data_list]

    total_count = await row_data_collection.count_documents({"uploadedFileId": file_id})
    if search_query:
        count_pipeline = [
            {"$match": {"uploadedFileId": file_id}},
            {"$addFields": {"data_array": {"$objectToArray": "$data"}}},
            {"$match": {"data_array.v": {"$regex": search_query, "$options": "i"}}},
            {"$count": "total"}
        ]
        count_res = await row_data_collection.aggregate(count_pipeline).to_list(None)
        total_count = count_res[0]["total"] if count_res else 0

    columns = list(data[0].keys()) if data else []

    return TableDataResponse(
        data=data,
        total_count=total_count,
        page=page,
        page_size=page_size,
        columns=columns
    )

@app.get("/charts/{file_id}", response_model=ChartDataResponse)
async def get_chart(
    file_id: str,
    chart_type: str,
    x_column: str,
    y_column: str,
    user_email: Optional[str] = Header(None, description="Optional user email to verify file ownership")
):
    find_query = {"_id": file_id}
    if user_email:
        find_query["user_email"] = user_email
    file_doc = await uploaded_files_collection.find_one(find_query)
    if not file_doc:
        raise HTTPException(404, "File not found.")

    pipeline = [
        {"$match": {"uploadedFileId": file_id}},
        {"$group": {
            "_id": f"$data.{x_column}",
            f"{y_column}": {"$sum": {"$toDouble": f"$data.{y_column}"}},
        }},
        {"$project": {
            f"{x_column}": "$_id",
            f"{y_column}": 1,
            "_id": 0
        }},
        {"$match": {f"{y_column}": {"$ne": None}}}
    ]

    chart_cursor = row_data_collection.aggregate(pipeline)
    chart_data = await chart_cursor.to_list(length=None)

    if not chart_data:
        raise HTTPException(400, "No valid numeric data in Y column.")

    return ChartDataResponse(
        chart_type=chart_type,
        data=chart_data,
        x_column=x_column,
        y_column=y_column
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)