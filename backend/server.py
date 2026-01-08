"""
RAG Document Q&A Backend Server with Authentication
FastAPI + LangChain + OpenAI + SQLite
Supports TXT, MD, PDF files and Web URLs
"""

import os
import sys
import logging
import sqlite3
from typing import Optional, List
from datetime import datetime, timedelta
from io import BytesIO
import hashlib
import secrets

# File processing imports
import PyPDF2
import requests
from bs4 import BeautifulSoup
from urllib.parse import urlparse

# FastAPI imports
from fastapi import FastAPI, UploadFile, File, HTTPException, Depends, Header, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
from dotenv import load_dotenv

# LangChain imports
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import Chroma
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnablePassthrough
from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain.schema import Document
from langchain_community.document_loaders import WebBaseLoader

# ============================================================================
# CONFIGURATION
# ============================================================================

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

load_dotenv()

app = FastAPI(
    title="RAG Document Q&A API with Auth",
    description="AI-powered document question answering system with user authentication (TXT, MD, PDF, Web URLs)",
    version="2.1"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================================
# DATABASE SETUP
# ============================================================================

DB_FILE = "rag_system.db"

def init_database():
    """Initialize SQLite database with tables"""
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    # Users table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    # Sessions table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            token TEXT UNIQUE NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            expires_at TIMESTAMP NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    """)
    
    # Documents table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS documents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            filename TEXT NOT NULL,
            file_size INTEGER,
            chunks INTEGER,
            word_count INTEGER,
            source_type TEXT DEFAULT 'file',
            uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    """)
    
    # Conversations table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS conversations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            document_id INTEGER NOT NULL,
            question TEXT NOT NULL,
            answer TEXT NOT NULL,
            rag_type TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id),
            FOREIGN KEY (document_id) REFERENCES documents (id)
        )
    """)
    
    conn.commit()
    conn.close()
    logger.info("✅ Database initialized")

def get_db():
    """Get database connection"""
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn

# ============================================================================
# AUTHENTICATION UTILITIES
# ============================================================================

def hash_password(password: str) -> str:
    """Hash password using SHA256"""
    return hashlib.sha256(password.encode()).hexdigest()

def generate_token() -> str:
    """Generate random session token"""
    return secrets.token_urlsafe(32)

def verify_token(token: str = Header(None)) -> dict:
    """Verify session token and return user info"""
    if not token:
        raise HTTPException(status_code=401, detail="Token không được cung cấp")
    
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT u.id, u.username, u.email, s.expires_at
        FROM sessions s
        JOIN users u ON s.user_id = u.id
        WHERE s.token = ? AND s.expires_at > ?
    """, (token, datetime.now()))
    
    result = cursor.fetchone()
    conn.close()
    
    if not result:
        raise HTTPException(status_code=401, detail="Token không hợp lệ hoặc đã hết hạn")
    
    return {
        "user_id": result[0],
        "username": result[1],
        "email": result[2]
    }

# ============================================================================
# PYDANTIC MODELS
# ============================================================================

class RegisterRequest(BaseModel):
    username: str
    email: EmailStr
    password: str

class LoginRequest(BaseModel):
    username: str
    password: str

class AuthResponse(BaseModel):
    token: str
    username: str
    email: str
    message: str

class QuestionRequest(BaseModel):
    question: str
    rag_type: str = "basic"

class AnswerResponse(BaseModel):
    answer: str
    sources: Optional[List[str]] = None

class StatusResponse(BaseModel):
    status: str
    message: str
    document_count: int = 0
    chunk_count: int = 0
    source_name: Optional[str] = None
    source_type: Optional[str] = None

class HistoryItem(BaseModel):
    id: int
    question: str
    answer: str
    rag_type: str
    created_at: str
    document_name: str
    source_type: str

# ============================================================================
# USER SESSION MANAGEMENT
# ============================================================================

class UserSession:
    """Store user-specific RAG system state"""
    def __init__(self, user_id: int):
        self.user_id = user_id
        self.vectorstore = None
        self.retriever = None
        self.llm = ChatOpenAI(model_name="gpt-3.5-turbo", temperature=0)
        self.documents = []
        self.source_name = None
        self.source_type = None
        self.document_id = None
        
    def clear(self):
        """Clear current vectorstore"""
        self.vectorstore = None
        self.retriever = None
        self.documents = []
        self.source_name = None
        self.source_type = None
        self.document_id = None

# Store user sessions in memory
user_sessions = {}

def get_user_session(user_info: dict) -> UserSession:
    """Get or create user session"""
    user_id = user_info["user_id"]
    if user_id not in user_sessions:
        user_sessions[user_id] = UserSession(user_id)
    return user_sessions[user_id]

# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================

def format_docs(docs):
    """Format documents for context"""
    return "\n\n".join(doc.page_content for doc in docs)

def extract_text_from_file(file_content: bytes, filename: str) -> str:
    """Extract text from uploaded file (TXT, MD, PDF)"""
    try:
        # Handle PDF files
        if filename.lower().endswith('.pdf'):
            pdf_file = BytesIO(file_content)
            pdf_reader = PyPDF2.PdfReader(pdf_file)
            text = ""
            for page in pdf_reader.pages:
                text += page.extract_text() or ""
            logger.info(f"Extracted {len(text)} chars from PDF")
            return text
        
        # Handle text files (TXT, MD)
        try:
            return file_content.decode('utf-8')
        except UnicodeDecodeError:
            try:
                return file_content.decode('latin-1')
            except Exception as e:
                logger.error(f"Failed to decode file: {e}")
                raise HTTPException(
                    status_code=400, 
                    detail="Cannot decode text file. Please check file encoding."
                )
                
    except Exception as e:
        logger.error(f"Failed to extract text from {filename}: {e}")
        raise HTTPException(
            status_code=400, 
            detail=f"Cannot process {filename}. Supported: TXT, MD, PDF"
        )

async def extract_text_from_url(url: str) -> tuple[str, str]:
    """Extract text content from web URL"""
    try:
        # Validate URL
        parsed = urlparse(url)
        if not parsed.scheme or not parsed.netloc:
            raise ValueError("Invalid URL format")
        
        logger.info(f"Fetching content from: {url}")
        
        # Use LangChain WebBaseLoader for robust web scraping
        loader = WebBaseLoader(url)
        docs = loader.load()
        
        if not docs:
            raise ValueError("No content found on webpage")
        
        content = docs[0].page_content
        title = docs[0].metadata.get('title', parsed.netloc)
        
        logger.info(f"Extracted {len(content)} chars from {title}")
        return content, title
        
    except Exception as e:
        logger.error(f"Failed to fetch URL {url}: {e}")
        raise HTTPException(
            status_code=400, 
            detail=f"Cannot fetch webpage: {str(e)}"
        )

# ============================================================================
# RAG IMPLEMENTATIONS
# ============================================================================

class BasicRAG:
    @staticmethod
    def build_chain(retriever, llm):
        template = """Bạn là trợ lý AI thông minh. Hãy trả lời câu hỏi dựa trên ngữ cảnh sau:

NGỮ CẢNH:
{context}

CÂU HỎI: {question}

Hãy trả lời chính xác, chi tiết bằng tiếng Việt. Nếu không tìm thấy thông tin trong ngữ cảnh, hãy nói rõ."""
        
        prompt = ChatPromptTemplate.from_template(template)
        chain = (
            {"context": retriever | format_docs, "question": RunnablePassthrough()}
            | prompt
            | llm
            | StrOutputParser()
        )
        return chain

class MultiQueryRAG:
    @staticmethod
    def build_chain(retriever, llm):
        multi_query_template = """Bạn là AI assistant. Hãy tạo 3 câu hỏi khác nhau 
từ câu hỏi gốc để tìm kiếm tài liệu tốt hơn. Mỗi câu hỏi trên một dòng.

Câu hỏi gốc: {question}"""
        
        multi_query_prompt = ChatPromptTemplate.from_template(multi_query_template)
        generate_queries = (
            multi_query_prompt 
            | llm
            | StrOutputParser() 
            | (lambda x: [q.strip() for q in x.split("\n") if q.strip()])
        )
        
        def get_unique_docs(doc_lists):
            unique = {}
            for docs in doc_lists:
                for doc in docs:
                    unique[doc.page_content] = doc
            return list(unique.values())
        
        def retrieve_all(queries):
            all_docs = []
            for q in queries:
                try:
                    docs = retriever.get_relevant_documents(q)
                    all_docs.append(docs)
                except Exception as e:
                    logger.warning(f"Query failed: {e}")
            return all_docs
        
        template = """Trả lời câu hỏi dựa trên ngữ cảnh:

{context}

Câu hỏi: {question}
Trả lời:"""
        
        prompt = ChatPromptTemplate.from_template(template)
        
        def full_chain(question):
            queries = generate_queries.invoke({"question": question})
            logger.info(f"Generated queries: {queries}")
            doc_lists = retrieve_all(queries)
            unique_docs = get_unique_docs(doc_lists)
            context = format_docs(unique_docs)
            answer = (prompt | llm | StrOutputParser()).invoke({
                "context": context,
                "question": question
            })
            return answer
        
        return full_chain

class HyDERAG:
    @staticmethod
    def build_chain(retriever, llm):
        hyde_template = """Hãy viết một đoạn văn giả định trả lời câu hỏi sau:

Câu hỏi: {question}
Đoạn văn:"""
        
        hyde_prompt = ChatPromptTemplate.from_template(hyde_template)
        
        template = """Dựa trên ngữ cảnh sau, trả lời câu hỏi:

{context}

Câu hỏi: {question}
Trả lời:"""
        
        prompt = ChatPromptTemplate.from_template(template)
        
        def full_chain(question):
            hypothetical = (hyde_prompt | llm | StrOutputParser()).invoke({
                "question": question
            })
            logger.info(f"Hypothetical doc: {hypothetical[:100]}...")
            docs = retriever.get_relevant_documents(hypothetical)
            context = format_docs(docs)
            answer = (prompt | llm | StrOutputParser()).invoke({
                "context": context,
                "question": question
            })
            return answer
        
        return full_chain

# ============================================================================
# AUTHENTICATION ENDPOINTS
# ============================================================================

@app.get("/")
async def root():
    """Health check"""
    return {
        "message": "RAG Document Q&A API with Authentication (TXT, MD, PDF, Web URLs)",
        "version": "2.1",
        "status": "running"
    }

@app.post("/auth/register", response_model=AuthResponse)
async def register(request: RegisterRequest):
    """Register new user"""
    conn = get_db()
    cursor = conn.cursor()
    
    try:
        # Check if username or email exists
        cursor.execute("SELECT id FROM users WHERE username = ? OR email = ?", 
                      (request.username, request.email))
        if cursor.fetchone():
            raise HTTPException(status_code=400, detail="Username hoặc email đã tồn tại")
        
        # Create user
        password_hash = hash_password(request.password)
        cursor.execute("""
            INSERT INTO users (username, email, password_hash)
            VALUES (?, ?, ?)
        """, (request.username, request.email, password_hash))
        
        user_id = cursor.lastrowid
        
        # Create session
        token = generate_token()
        expires_at = datetime.now() + timedelta(days=7)
        
        cursor.execute("""
            INSERT INTO sessions (user_id, token, expires_at)
            VALUES (?, ?, ?)
        """, (user_id, token, expires_at))
        
        conn.commit()
        
        logger.info(f"✅ User registered: {request.username}")
        
        return AuthResponse(
            token=token,
            username=request.username,
            email=request.email,
            message="Đăng ký thành công!"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Registration failed: {e}")
        raise HTTPException(status_code=500, detail="Đăng ký thất bại")
    finally:
        conn.close()

@app.post("/auth/login", response_model=AuthResponse)
async def login(request: LoginRequest):
    """Login user"""
    conn = get_db()
    cursor = conn.cursor()
    
    try:
        password_hash = hash_password(request.password)
        
        cursor.execute("""
            SELECT id, username, email FROM users
            WHERE username = ? AND password_hash = ?
        """, (request.username, password_hash))
        
        user = cursor.fetchone()
        
        if not user:
            raise HTTPException(status_code=401, detail="Tên đăng nhập hoặc mật khẩu không đúng")
        
        # Create session
        token = generate_token()
        expires_at = datetime.now() + timedelta(days=7)
        
        cursor.execute("""
            INSERT INTO sessions (user_id, token, expires_at)
            VALUES (?, ?, ?)
        """, (user[0], token, expires_at))
        
        conn.commit()
        
        logger.info(f"✅ User logged in: {request.username}")
        
        return AuthResponse(
            token=token,
            username=user[1],
            email=user[2],
            message="Đăng nhập thành công!"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Login failed: {e}")
        raise HTTPException(status_code=500, detail="Đăng nhập thất bại")
    finally:
        conn.close()

@app.post("/auth/logout")
async def logout(user_info: dict = Depends(verify_token), token: str = Header(None)):
    """Logout user"""
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("DELETE FROM sessions WHERE token = ?", (token,))
    conn.commit()
    conn.close()
    
    return {"message": "Đăng xuất thành công"}

@app.get("/auth/me")
async def get_current_user(user_info: dict = Depends(verify_token)):
    """Get current user info"""
    return user_info

# ============================================================================
# DOCUMENT ENDPOINTS (Protected)
# ============================================================================

@app.get("/status", response_model=StatusResponse)
async def get_status(user_info: dict = Depends(verify_token)):
    """Get system status"""
    session = get_user_session(user_info)
    
    if session.vectorstore is None:
        return StatusResponse(
            status="no_document",
            message="No document uploaded. Please upload a document or URL first.",
            document_count=0,
            chunk_count=0
        )
    
    chunk_count = session.vectorstore._collection.count() if session.vectorstore else 0
    
    return StatusResponse(
        status="ready",
        message="System ready to answer questions",
        document_count=len(session.documents),
        chunk_count=chunk_count,
        source_name=session.source_name,
        source_type=session.source_type
    )

@app.post("/upload")
async def upload_document(
    file: UploadFile = File(None),
    url: str = Form(None),
    user_info: dict = Depends(verify_token)
):
    """Upload and process document (file or URL)"""
    session = get_user_session(user_info)
    
    try:
        text = ""
        source_name = ""
        source_type = "file"
        
        # Process uploaded file
        if file and file.filename:
            logger.info(f"User {user_info['username']} uploading file: {file.filename}")
            
            if not file.filename:
                raise HTTPException(status_code=400, detail="No filename provided")
            
            content = await file.read()
            
            if len(content) == 0:
                raise HTTPException(status_code=400, detail="Empty file")
            
            text = extract_text_from_file(content, file.filename)
            source_name = file.filename
            source_type = "file"
            
        # Process URL
        elif url:
            logger.info(f"User {user_info['username']} uploading URL: {url}")
            text, source_name = await extract_text_from_url(url)
            source_type = "url"
            
        else:
            raise HTTPException(status_code=400, detail="Provide either file or URL")
        
        # Validate content length
        if not text or len(text) < 50:
            raise HTTPException(
                status_code=400, 
                detail="Content too short (less than 50 characters)."
            )
        
        logger.info(f"Processing {len(text)} characters from {source_name}")
        
        # Create document
        doc = Document(
            page_content=text, 
            metadata={"source": source_name, "type": source_type}
        )
        session.documents = [doc]
        session.source_name = source_name
        session.source_type = source_type
        
        # Split into chunks
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=200,
            length_function=len,
        )
        splits = text_splitter.split_documents([doc])
        
        logger.info(f"Created {len(splits)} chunks from {source_name}")
        
        # Create vectorstore
        session.vectorstore = Chroma.from_documents(
            documents=splits,
            embedding=OpenAIEmbeddings()
        )
        
        session.retriever = session.vectorstore.as_retriever(
            search_kwargs={"k": 4}
        )
        
        # Save to database
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO documents (user_id, filename, file_size, chunks, word_count, source_type)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (user_info["user_id"], source_name, len(text.encode()), len(splits), len(text.split()), source_type))
        
        session.document_id = cursor.lastrowid
        conn.commit()
        conn.close()
        
        logger.info("✅ Document/URL processed and indexed successfully")
        
        return {
            "status": "success",
            "message": f"Successfully processed '{source_name}'",
            "source": source_name,
            "source_type": source_type,
            "content_length": len(text),
            "chunks": len(splits),
            "word_count": len(text.split())
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Upload failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Processing failed: {str(e)}")

@app.post("/ask", response_model=AnswerResponse)
async def ask_question(
    request: QuestionRequest,
    user_info: dict = Depends(verify_token)
):
    """Ask question about document"""
    session = get_user_session(user_info)
    
    if session.retriever is None:
        raise HTTPException(
            status_code=400, 
            detail="No document uploaded. Please upload a document or URL first."
        )
    
    try:
        question = request.question.strip()
        rag_type = request.rag_type
        
        logger.info(f"User {user_info['username']} asking: {question} | RAG Type: {rag_type}")
        
        if rag_type == "multi_query":
            chain = MultiQueryRAG.build_chain(session.retriever, session.llm)
            answer = chain(question)
        elif rag_type == "hyde":
            chain = HyDERAG.build_chain(session.retriever, session.llm)
            answer = chain(question)
        else:
            chain = BasicRAG.build_chain(session.retriever, session.llm)
            answer = chain.invoke(question)
        
        relevant_docs = session.retriever.get_relevant_documents(question)
        sources = [doc.page_content[:200] + "..." for doc in relevant_docs[:3]]
        
        # Save to database
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO conversations (user_id, document_id, question, answer, rag_type)
            VALUES (?, ?, ?, ?, ?)
        """, (user_info["user_id"], session.document_id, question, answer, rag_type))
        conn.commit()
        conn.close()
        
        logger.info(f"✅ Answer generated and saved")
        
        return AnswerResponse(
            answer=answer,
            sources=sources
        )
        
    except Exception as e:
        logger.error(f"Question failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Question failed: {str(e)}")

@app.get("/history")
async def get_history(user_info: dict = Depends(verify_token)):
    """Get conversation history"""
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT c.id, c.question, c.answer, c.rag_type, c.created_at, d.filename, d.source_type
        FROM conversations c
        JOIN documents d ON c.document_id = d.id
        WHERE c.user_id = ?
        ORDER BY c.created_at DESC
        LIMIT 50
    """, (user_info["user_id"],))
    
    results = cursor.fetchall()
    conn.close()
    
    history = []
    for row in results:
        history.append({
            "id": row[0],
            "question": row[1],
            "answer": row[2],
            "rag_type": row[3],
            "created_at": row[4],
            "document_name": row[5],
            "source_type": row[6]
        })
    
    return {"history": history}

@app.delete("/clear")
async def clear_system(user_info: dict = Depends(verify_token)):
    """Clear current document"""
    session = get_user_session(user_info)
    session.clear()
    return {
        "status": "success", 
        "message": "System cleared. Ready to upload new document or URL."
    }

# ============================================================================
# STARTUP & SHUTDOWN
# ============================================================================

@app.on_event("startup")
async def startup_event():
    """Startup event"""
    logger.info("="*60)
    logger.info("RAG Document Q&A Backend Server Starting...")
    logger.info("="*60)
    
    init_database()
    
    if not os.getenv("OPENAI_API_KEY"):
        logger.error("❌ OPENAI_API_KEY not found!")
    else:
        logger.info("✅ OpenAI API key found")
    
    logger.info("✅ Server started successfully")
    logger.info("📍 API docs: http://localhost:8000/docs")
    logger.info("✅ Supported formats: TXT, MD, PDF, Web URLs")
    logger.info("="*60)

@app.on_event("shutdown")
async def shutdown_event():
    """Shutdown event"""
    logger.info("Shutting down server...")
    user_sessions.clear()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")
