"""CSV + Excel exports for the teacher (written to reports/output/).

Same sheets and columns as the MATLAB version (writetable):
  class report  Students / Topics / Code Lab
  live quiz     Leaderboard / Questions / Answers
"""

from __future__ import annotations

import csv
import re
from pathlib import Path
from typing import Any, Sequence

from openpyxl import Workbook

from ..utils import round_to, stamp

LETTERS = "ABCDEF"
Table = tuple[list[str], list[list[Any]]]          # (header, rows)


def _cell(v: Any) -> Any:
    """Missing numbers ([] / None) stay empty cells."""
    return "" if v is None or v == [] else v


class ExportService:
    def __init__(self, folder: Path):
        self.folder = folder

    # ------------------------------------------------------------ writing
    def _write(self, base: str, sheets: Sequence[tuple[str, Table]]) -> dict:
        self.folder.mkdir(parents=True, exist_ok=True)
        header, rows = sheets[0][1]
        with open(self.folder / f"{base}.csv", "w", newline="", encoding="utf-8-sig") as fh:
            w = csv.writer(fh)
            w.writerow(header)
            w.writerows([[_cell(v) for v in r] for r in rows])
        book = Workbook()
        book.remove(book.active)
        for title, (header, rows) in sheets:
            sheet = book.create_sheet(title)
            sheet.append(header)
            for r in rows:
                sheet.append([_cell(v) for v in r])
        book.save(self.folder / f"{base}.xlsx")
        return {"csv": f"{base}.csv", "xlsx": f"{base}.xlsx"}

    # ------------------------------------------------------------ class report
    def class_report(self, report: dict) -> dict:
        cats = report["categories"]
        students = [
            [s["name"], s["roll"], s["level"], s["xp"], s["badges"], s["quizzes"], s["questions"],
             round_to(s["accuracy"], 1), s["dailyStreak"], len(s["experimentsDone"]),
             f'{s["assignedDone"]}/{s["assignedTotal"]}', s["codeSolved"], s["codeAttempts"], s["lastQuiz"],
             s["lastActive"], *[round_to(a, 1) for a in s["topicAccuracy"]]]
            for s in report["students"]]
        topics = sorted(report["topics"], key=lambda t: (t["accuracy"] is None, t["accuracy"] or 0))
        code = report["codeTasks"]
        return self._write("ImageLab_class_report_" + stamp(), [
            ("Students", (["Name", "Roll", "Level", "XP", "Badges", "Quizzes", "Questions", "Accuracy (%)",
                           "Daily streak", "Experiments done", "Assigned done", "Code tasks solved", "Code runs",
                           "Last quiz", "Last active", *[f"{c} (%)" for c in cats]], students)),
            ("Topics", (["Topic", "Answers", "Correct", "Class accuracy (%)", "Students below 60%"],
                        [[t["category"], t["answered"], t["correct"], round_to(t["accuracy"], 1), t["struggling"]]
                         for t in topics])),
            ("Code Lab", (["Code Lab task", "Level", "Status", "Due", "Solved by", "Tried by"],
                          [[t["title"], t["level"], t["status"], t["due"], t["solvedBy"], t["triedBy"]]
                           for t in code])),
        ])

    # ------------------------------------------------------------ live quiz
    def live_result(self, r: dict) -> dict:
        board, questions = r["leaderboard"], r["questions"]
        answers_header = ["Name", "Roll"]
        for k in range(1, len(questions) + 1):
            answers_header += [f"Q{k} answer", f"Q{k} time (s)", f"Q{k} points"]
        answers = []
        for b in board:
            row = [b["name"], b["roll"]]
            for k in range(len(questions)):
                choice = b["choices"][k]
                row += [LETTERS[choice - 1] if choice > 0 else "-", b["times"][k], b["points"][k]]
            answers.append(row)
        base = "ImageLab_live_quiz_" + re.sub(r"^LQ", "", r["id"])
        return self._write(base, [
            ("Leaderboard", (["Rank", "Name", "Roll", "Points", "Correct", "Answered", "Average answer time (s)",
                              "Total time (s)"],
                             [[b["rank"], b["name"], b["roll"], b["score"], b["correct"], b["answered"], b["avgTime"],
                               b["totalTime"]] for b in board])),
            ("Questions", (["Question", "Text", "Topic", "Correct answer", "Time limit (s)", "Answered", "Correct (%)",
                            "Average answer time (s)"],
                           [[q["index"], q["question"], q["category"],
                             f'{LETTERS[q["answer"] - 1]}: {q["options"][q["answer"] - 1]}', q["timeLimit"],
                             q["answered"], q["correctPct"], q["avgTime"]] for q in questions])),
            ("Answers", (answers_header, answers)),
        ])
