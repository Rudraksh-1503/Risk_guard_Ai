"""PDF and CSV report generation."""
import io
import csv
import json
from pathlib import Path
from typing import Dict, Any
from datetime import datetime

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, PageBreak
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT

from app.services.analysis_service import load_dataframe
from app.core.config import settings

REPORTS_DIR = settings.UPLOAD_DIR / "reports"
REPORTS_DIR.mkdir(exist_ok=True)


def generate_pdf_report(dataset_meta: Dict, analysis: Dict, model_metrics: Dict = None) -> str:
    filename = f"report_{dataset_meta['id']}_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}.pdf"
    filepath = REPORTS_DIR / filename

    doc = SimpleDocTemplate(str(filepath), pagesize=A4,
                            rightMargin=2*cm, leftMargin=2*cm,
                            topMargin=2*cm, bottomMargin=2*cm)
    styles = getSampleStyleSheet()
    h1 = ParagraphStyle("H1", parent=styles["Heading1"], fontSize=18, textColor=colors.HexColor("#1e3a5f"))
    h2 = ParagraphStyle("H2", parent=styles["Heading2"], fontSize=13, textColor=colors.HexColor("#2563eb"))
    normal = styles["Normal"]
    story = []

    # Title
    story.append(Paragraph("Risk Guard AI — Dataset Analysis Report", h1))
    story.append(Spacer(1, 0.3*cm))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#2563eb")))
    story.append(Spacer(1, 0.4*cm))

    story.append(Paragraph(f"<b>Dataset:</b> {dataset_meta.get('name','N/A')}", normal))
    story.append(Paragraph(f"<b>Upload Date:</b> {dataset_meta.get('upload_date','N/A')}", normal))
    story.append(Paragraph(f"<b>Detected Category:</b> {analysis.get('detected_category','N/A')}", normal))
    story.append(Spacer(1, 0.4*cm))

    # Overview
    story.append(Paragraph("1. Dataset Overview", h2))
    overview = analysis.get("overview", {})
    ov_data = [
        ["Metric", "Value"],
        ["Total Rows", f"{overview.get('total_rows',0):,}"],
        ["Total Columns", overview.get('total_columns', 0)],
        ["Numerical Columns", overview.get('numerical_columns', 0)],
        ["Categorical Columns", overview.get('categorical_columns', 0)],
        ["Missing Values", f"{overview.get('missing_values_total',0):,}"],
        ["Duplicate Rows", overview.get('duplicate_rows', 0)],
        ["Quality Score", f"{overview.get('quality_score', 0):.1f}%"],
        ["Memory Usage", f"{overview.get('memory_usage_mb', 0):.3f} MB"],
    ]
    t = Table(ov_data, colWidths=[8*cm, 8*cm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,0), colors.HexColor("#2563eb")),
        ("TEXTCOLOR", (0,0), (-1,0), colors.white),
        ("FONTNAME", (0,0), (-1,0), "Helvetica-Bold"),
        ("ROWBACKGROUNDS", (0,1), (-1,-1), [colors.whitesmoke, colors.white]),
        ("GRID", (0,0), (-1,-1), 0.5, colors.grey),
        ("FONTSIZE", (0,0), (-1,-1), 9),
    ]))
    story.append(t)
    story.append(Spacer(1, 0.4*cm))

    # Columns
    story.append(Paragraph("2. Column Summary", h2))
    col_data = [["Column", "Type", "Category", "Missing", "Unique"]]
    for col in analysis.get("columns", []):
        col_data.append([
            col["name"][:30],
            col["dtype"],
            col["category"],
            f"{col['null_count']} ({col['null_percentage']}%)",
            col["unique_count"],
        ])
    tc = Table(col_data, colWidths=[5*cm, 3*cm, 3*cm, 3.5*cm, 2.5*cm])
    tc.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,0), colors.HexColor("#1e3a5f")),
        ("TEXTCOLOR", (0,0), (-1,0), colors.white),
        ("FONTNAME", (0,0), (-1,0), "Helvetica-Bold"),
        ("ROWBACKGROUNDS", (0,1), (-1,-1), [colors.whitesmoke, colors.white]),
        ("GRID", (0,0), (-1,-1), 0.5, colors.grey),
        ("FONTSIZE", (0,0), (-1,-1), 8),
    ]))
    story.append(tc)
    story.append(Spacer(1, 0.4*cm))

    # Data quality issues
    story.append(Paragraph("3. Data Quality Issues", h2))
    issues = analysis.get("quality_issues", [])
    if issues:
        for issue in issues[:20]:
            sev_color = {"high": "#ef4444", "medium": "#f59e0b", "low": "#22c55e"}.get(issue.get("severity","low"), "#6b7280")
            story.append(Paragraph(
                f'<font color="{sev_color}"><b>[{issue.get("severity","").upper()}]</b></font> {issue.get("message","")}',
                normal
            ))
    else:
        story.append(Paragraph("No data quality issues detected.", normal))
    story.append(Spacer(1, 0.4*cm))

    # Insights
    story.append(Paragraph("4. AI-Generated Insights", h2))
    for ins in analysis.get("insights", []):
        story.append(Paragraph(f"• {ins}", normal))
    story.append(Spacer(1, 0.4*cm))

    # ML Recommendations
    story.append(Paragraph("5. ML Task Recommendations", h2))
    for task in analysis.get("ml_recommendations", []):
        story.append(Paragraph(f"<b>{task['task']}</b> ({task['type']})", normal))
        story.append(Paragraph(f"Target: {task['target_column']} | Algorithms: {', '.join(task['algorithms'])}", normal))
        story.append(Spacer(1, 0.2*cm))

    # Model metrics
    if model_metrics:
        story.append(PageBreak())
        story.append(Paragraph("6. Model Training Results", h2))
        m = model_metrics.get("metrics", {})
        m_data = [["Metric", "Value"]]
        for k, v in m.items():
            if k != "actual_vs_predicted" and k != "confusion_matrix":
                m_data.append([k.replace("_", " ").title(), str(v)])
        tm = Table(m_data, colWidths=[8*cm, 8*cm])
        tm.setStyle(TableStyle([
            ("BACKGROUND", (0,0), (-1,0), colors.HexColor("#2563eb")),
            ("TEXTCOLOR", (0,0), (-1,0), colors.white),
            ("GRID", (0,0), (-1,-1), 0.5, colors.grey),
            ("FONTSIZE", (0,0), (-1,-1), 9),
        ]))
        story.append(tm)

    story.append(Spacer(1, 0.5*cm))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.grey))
    story.append(Paragraph(f"Generated by Risk Guard AI on {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}", normal))

    doc.build(story)
    return str(filepath)


def export_cleaned_csv(file_path: str, dataset_id: int) -> str:
    df = load_dataframe(file_path)
    df_clean = df.drop_duplicates()
    out = REPORTS_DIR / f"cleaned_{dataset_id}.csv"
    df_clean.to_csv(str(out), index=False)
    return str(out)
