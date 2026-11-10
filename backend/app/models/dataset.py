from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Text, JSON, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from app.core.database import Base

class Dataset(Base):
    __tablename__ = "datasets"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    original_filename = Column(String(255), nullable=False)
    stored_filename = Column(String(255), nullable=False, unique=True)
    file_path = Column(String(500), nullable=False)
    file_size = Column(Integer, nullable=False)
    file_type = Column(String(10), nullable=False)
    row_count = Column(Integer, nullable=True)
    column_count = Column(Integer, nullable=True)
    detected_category = Column(String(100), nullable=True)
    category_confidence = Column(Float, nullable=True)
    user_category = Column(String(100), nullable=True)
    upload_date = Column(DateTime, default=datetime.utcnow)
    is_analyzed = Column(Boolean, default=False)
    status = Column(String(50), default="uploaded")

    columns = relationship("DatasetColumn", back_populates="dataset", cascade="all, delete-orphan")
    analysis = relationship("DatasetAnalysis", back_populates="dataset", uselist=False, cascade="all, delete-orphan")
    models = relationship("ModelTrainingHistory", back_populates="dataset", cascade="all, delete-orphan")
    reports = relationship("AnalysisReport", back_populates="dataset", cascade="all, delete-orphan")


class DatasetColumn(Base):
    __tablename__ = "dataset_columns"

    id = Column(Integer, primary_key=True, index=True)
    dataset_id = Column(Integer, ForeignKey("datasets.id"), nullable=False)
    column_name = Column(String(255), nullable=False)
    data_type = Column(String(50), nullable=False)
    column_category = Column(String(50), nullable=False)  # numerical, categorical, date, text
    null_count = Column(Integer, default=0)
    null_percentage = Column(Float, default=0.0)
    unique_count = Column(Integer, default=0)
    stats = Column(JSON, nullable=True)

    dataset = relationship("Dataset", back_populates="columns")


class DatasetAnalysis(Base):
    __tablename__ = "dataset_analysis"

    id = Column(Integer, primary_key=True, index=True)
    dataset_id = Column(Integer, ForeignKey("datasets.id"), nullable=False, unique=True)
    total_rows = Column(Integer)
    total_columns = Column(Integer)
    numerical_columns = Column(Integer)
    categorical_columns = Column(Integer)
    date_columns = Column(Integer)
    missing_values_total = Column(Integer)
    duplicate_rows = Column(Integer)
    quality_score = Column(Float)
    memory_usage_mb = Column(Float)
    statistical_summary = Column(JSON)
    data_quality_issues = Column(JSON)
    insights = Column(JSON)
    recommended_ml_tasks = Column(JSON)
    analysis_date = Column(DateTime, default=datetime.utcnow)

    dataset = relationship("Dataset", back_populates="analysis")


class ModelTrainingHistory(Base):
    __tablename__ = "model_training_history"

    id = Column(Integer, primary_key=True, index=True)
    dataset_id = Column(Integer, ForeignKey("datasets.id"), nullable=False)
    model_name = Column(String(255), nullable=False)
    task_type = Column(String(50), nullable=False)  # regression, classification
    target_column = Column(String(255), nullable=False)
    feature_columns = Column(JSON)
    algorithm = Column(String(100))
    hyperparameters = Column(JSON)
    metrics = Column(JSON)
    model_path = Column(String(500), nullable=True)
    training_date = Column(DateTime, default=datetime.utcnow)
    status = Column(String(50), default="training")

    dataset = relationship("Dataset", back_populates="models")


class AnalysisReport(Base):
    __tablename__ = "analysis_reports"

    id = Column(Integer, primary_key=True, index=True)
    dataset_id = Column(Integer, ForeignKey("datasets.id"), nullable=False)
    report_path = Column(String(500), nullable=True)
    report_format = Column(String(20))
    created_date = Column(DateTime, default=datetime.utcnow)

    dataset = relationship("Dataset", back_populates="reports")
