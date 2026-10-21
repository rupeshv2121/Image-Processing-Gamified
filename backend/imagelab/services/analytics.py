"""Class views for the teacher (port of classAnalytics.m).

report       roster + topic heatmap + experiment / Code Lab completion (also exported)
overview     report + dashboard KPIs, students who need attention, activity feed
submissions  Code Lab matrix: every student x every task
student      everything about one student
submission   one student's code for one task

Everything is built from ONE pass over the students with three queries
(roster, all progress, all submissions) - fast for hundreds of students.
"""

from __future__ import annotations

from dataclasses import dataclass

from ..utils import days_since, matlab_round, now_text, plural, today_text
from .catalog import MatlabCatalog
from .classroom import ClassroomService
from .content import Content
from .exports import ExportService
from .profiles import ProfileService, stats_row
from .progress import ProgressService, default_progress, peek, summarise
from .records import SubmissionService, empty_submission


@dataclass
class Student:
    profile: dict          # roster entry with stats (stats_row)
    p: dict                # stored progress
    subs: dict             # task id -> submission summary


def solved(subs: dict) -> list[str]:
    return [t for t, e in subs.items() if e["passed"]]


def last_active(p: dict, subs: dict) -> str:
    """Latest of the last progress change and the latest Code Lab run."""
    return max([p["lastActive"]] + [e["lastRun"] for e in subs.values()], default="")


class AnalyticsService:
    def __init__(self, profiles: ProfileService, progress: ProgressService, submissions: SubmissionService,
                 classroom: ClassroomService, catalog: MatlabCatalog, content: Content, exports: ExportService):
        self.profiles, self.progress, self.submissions = profiles, progress, submissions
        self.classroom, self.catalog, self.content, self.exports = classroom, catalog, content, exports

    def _collect(self) -> list[Student]:
        docs = self.progress.load_all()
        subs = self.submissions.summaries()
        out = []
        for pr in self.profiles.roster():
            p = docs.get(pr["id"]) or default_progress()
            out.append(Student(stats_row(pr, peek(p)), p, subs.get(pr["id"], {})))
        return out

    # ------------------------------------------------------------ report
    def report(self, students: list[Student] | None = None) -> dict:
        students = self._collect() if students is None else students
        cats = self.content.categories
        experiments = self.classroom.experiment_states()
        code = self.classroom.code_task_states()
        exp_assigned = [e["number"] for e in experiments if e["status"] == "assigned"]
        code_assigned = [t["id"] for t in code if t["status"] == "assigned"]
        answered = [0] * len(cats)
        correct = [0] * len(cats)
        struggling = [0] * len(cats)
        exp_done = {e["number"]: 0 for e in experiments}
        code_done = {t["id"]: 0 for t in code}
        code_tried = {t["id"]: 0 for t in code}
        rows = []
        for st in students:
            pr, p = st.profile, st.p
            stats = {c["name"]: c for c in p["categoryStats"]}
            acc = []
            for i, c in enumerate(cats):
                s = stats.get(c)
                if s and s["answered"] > 0:
                    a, r = s["answered"], s["correct"]
                    acc.append(100 * r / a)
                    answered[i] += a
                    correct[i] += r
                    if a >= 2 and acc[-1] < 60:
                        struggling[i] += 1
                else:
                    acc.append(None)
            done = p["experimentsCompleted"]
            for n in exp_done:
                exp_done[n] += n in done
            ok = solved(st.subs)
            for t in code_done:
                code_done[t] += t in ok
                code_tried[t] += t in st.subs
            rows.append({
                "id": pr["id"], "name": pr["name"], "roll": pr["roll"], "level": pr["level"], "xp": pr["xp"],
                "badges": pr["badges"], "quizzes": pr["quizzes"], "accuracy": pr["accuracy"],
                "questions": p["questionsAnswered"], "dailyStreak": pr["dailyStreak"],
                "experimentsDone": sorted(done), "assignedDone": sum(1 for n in exp_assigned if n in done),
                "assignedTotal": len(exp_assigned), "codeSolved": len(ok),
                "codeAssignedDone": sum(1 for t in code_assigned if t in ok), "codeAssignedTotal": len(code_assigned),
                "codeAttempts": sum(e["attempts"] for e in st.subs.values()), "topicAccuracy": acc,
                "lastQuiz": p["quizHistory"][-1]["date"] if p["quizHistory"] else "",
                "lastActive": last_active(p, st.subs)})
        topics = [{"category": c, "answered": answered[i], "correct": correct[i],
                   "accuracy": 100 * correct[i] / answered[i] if answered[i] else None, "struggling": struggling[i]}
                  for i, c in enumerate(cats)]
        tasks = {t["id"]: t for t in self.catalog.code_tasks()}
        return {
            "students": rows, "categories": cats, "topics": topics,
            "weakest": sorted((t for t in topics if t["answered"] > 0), key=lambda t: t["accuracy"]),
            "experiments": [{**e, "completedBy": exp_done[e["number"]]} for e in experiments],
            "codeTasks": [{**t, "solvedBy": code_done[t["id"]], "triedBy": code_tried[t["id"]],
                           "level": tasks[t["id"]]["level"], "unit": tasks[t["id"]]["unit"],
                           "topic": tasks[t["id"]]["topic"]} for t in code],
            "studentCount": len(students), "generated": now_text()}

    # ------------------------------------------------------------ dashboard
    def overview(self) -> dict:
        students = self._collect()
        out = self.report(students)
        out["dashboard"] = self._dashboard(students)
        return out

    def _dashboard(self, students: list[Student]) -> dict:
        today = today_text()
        experiments = self.classroom.experiment_states()
        code = self.classroom.code_task_states()
        titles = {t["id"]: t["title"] for t in self.catalog.code_tasks()}
        overdue = lambda items: [x for x in items if x["status"] == "assigned" and x["due"] and x["due"] < today]  # noqa: E731
        exp_over, code_over = overdue(experiments), overdue(code)
        exp_assigned = [e["number"] for e in experiments if e["status"] == "assigned"]
        code_assigned = [t["id"] for t in code if t["status"] == "assigned"]
        active7 = solved_total = done_assigned = 0
        attention, feed = [], []
        for st in students:
            pr, p = st.profile, st.p
            ok = solved(st.subs)
            solved_total += len(ok)
            done_assigned += sum(1 for n in exp_assigned if n in p["experimentsCompleted"]) \
                + sum(1 for t in code_assigned if t in ok)
            la = last_active(p, st.subs)
            days = days_since(la)
            active7 += days <= 7
            issues = []
            n_over = sum(1 for e in exp_over if e["number"] not in p["experimentsCompleted"]) \
                + sum(1 for t in code_over if t["id"] not in ok)
            if n_over:
                issues.append(f"{n_over} overdue assignment{plural(n_over)}")
            if not la:
                issues.append("Has not started yet")
            elif days > 7:
                issues.append(f"Inactive for {int(days)} days")
            if p["questionsAnswered"] >= 10 and pr["accuracy"] < 60:
                issues.append(f"Quiz accuracy {matlab_round(pr['accuracy'])}%")
            for task, e in st.subs.items():
                if not e["passed"] and e["attempts"] >= 5:
                    issues.append(f'Stuck on "{titles.get(task, task)}" ({e["attempts"]} attempts)')
            if issues:
                attention.append({"id": pr["id"], "name": pr["name"], "issues": issues, "score": len(issues)})
            feed += [{**ev, "studentId": pr["id"], "student": pr["name"]} for ev in p["events"][-10:]]
        attention.sort(key=lambda a: -a["score"])
        feed.sort(key=lambda e: e["time"], reverse=True)
        n = len(students)
        total_assigned = (len(exp_assigned) + len(code_assigned)) * n
        return {"activeThisWeek": active7, "averageXp": sum(s.profile["xp"] for s in students) / max(n, 1),
                "codeSolved": solved_total, "codeSolvedPerStudent": solved_total / max(n, 1),
                "assignedCount": len(exp_assigned) + len(code_assigned),
                "assignedCompletion": 100 * done_assigned / total_assigned if total_assigned else 0,
                "overdueCount": len(exp_over) + len(code_over), "attention": attention[:12], "feed": feed[:25]}

    # ------------------------------------------------------------ Code Lab views
    def submissions_matrix(self) -> dict:
        tasks = self.catalog.code_tasks()
        status = {t["id"]: t["status"] for t in self.classroom.code_task_states()}
        all_subs = self.submissions.summaries()
        keys = ("attempts", "passed", "bestMatch", "lastRun", "firstSolved")
        rows = []
        for pr in self.profiles.roster():
            subs = all_subs.get(pr["id"], {})
            rows.append({"id": pr["id"], "name": pr["name"], "roll": pr["roll"],
                         "cells": [{k: {**empty_submission(), **subs.get(t["id"], {})}[k] for k in keys} for t in tasks]})
        return {"tasks": [{"id": t["id"], "title": t["title"], "level": t["level"], "status": status[t["id"]]}
                          for t in tasks], "students": rows}

    def student(self, profile_id: str) -> dict:
        pr = self.profiles.require(profile_id)
        p = self.progress.load(profile_id)
        subs = self.submissions.summary(profile_id)
        states = {t["id"]: t for t in self.classroom.code_task_states()}
        code = []
        for t in self.catalog.code_tasks():
            e = {**empty_submission(), **subs.get(t["id"], {})}
            code.append({"id": t["id"], "title": t["title"], "level": t["level"], "status": states[t["id"]]["status"],
                         "due": states[t["id"]]["due"], **{k: e[k] for k in (
                             "attempts", "passed", "bestMatch", "lastRun", "firstSolved", "attemptsToSolve",
                             "lastError")}})
        stats = {c["name"]: c for c in p["categoryStats"]}
        topics = []
        for c in self.content.categories:
            s = stats.get(c, {"answered": 0, "correct": 0})
            topics.append({"category": c, "answered": s["answered"], "correct": s["correct"],
                           "accuracy": 100 * s["correct"] / max(s["answered"], 1)})
        return {"id": pr["id"], "name": pr["name"], "roll": pr["roll"], "created": pr["created"],
                "summary": summarise(p, [], profile_id), "lastActive": last_active(p, subs),
                "events": list(reversed(p["events"])), "quizHistory": list(reversed(p["quizHistory"])),
                "experiments": [{**e, "done": e["number"] in p["experimentsCompleted"]}
                                for e in self.classroom.experiment_states()],
                "topics": topics, "code": code}

    def submission(self, profile_id: str, task_id: str) -> dict:
        pr = self.profiles.require(profile_id)
        t = self.catalog.code_task(task_id)
        return {"student": {"id": pr["id"], "name": pr["name"], "roll": pr["roll"]},
                "task": {"id": t["id"], "title": t["title"], "level": t["level"]},
                "entry": self.submissions.get(profile_id, task_id)}

    def export(self) -> dict:
        return self.exports.class_report(self.report())
