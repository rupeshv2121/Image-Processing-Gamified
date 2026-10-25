"""Quizzes, live quiz, games, Code Lab and experiments."""

from __future__ import annotations

from ...errors import quiz_state
from ...utils import as_list, param, today_text
from ...services.quiz import public_question
from ..registry import Call, Registry


def _n(p: dict, default: int = 10) -> int:
    try:
        return max(int(float(param(p, "n", default))), 0)
    except (TypeError, ValueError):
        return default


def register(r: Registry) -> None:
    # ------------------------------------------------------------ quiz
    @r.op("quizCategories")
    def quiz_categories(call: Call):
        return call.app.quiz.categories()

    @r.op("quizQuestions")
    def quiz_questions(call: Call):
        p, quiz, c = call.params, call.app.quiz, call.caller
        mode = str(param(p, "mode", "bank"))
        if mode == "kernel":
            return [public_question(q) for q in quiz.kernel_questions(_n(p))]
        if mode == "weak":
            stats = call.app.progress.summary(c.actor, c.student_id)["categoryStats"]
            questions, plan = quiz.weak(stats, _n(p))
            return {"questions": [public_question(q) for q in questions], "plan": plan}
        questions = quiz.select(str(param(p, "difficulty", "mixed")), param(p, "categories", "all"), _n(p))
        return [public_question(q) for q in questions]

    @r.op("quizSubmit")
    def quiz_submit(call: Call):
        p, c = call.params, call.caller
        results = [x for x in as_list(param(p, "results", [])) if isinstance(x, dict)]
        if not results:
            raise quiz_state("The quiz has no answers to submit.")
        summary = {**call.app.quiz.score(results), "mode": str(param(p, "mode", "Rapid Fire"))}
        progress = call.app.progress.quiz(c.actor, c.student_id, summary, results)
        board = []
        # "name" opts in to the leaderboard; the entry carries the signed-in student's
        # own profile name and roll number, so nobody can post scores as somebody else
        profile = call.app.profiles.get(c.student_id) if c.student_id is not None else None
        if str(param(p, "name", "")).strip() and profile is not None:
            board = call.app.leaderboard.add({"name": profile["name"], "roll": profile["roll"],
                                              "score": summary["score"], "accuracy": summary["accuracy"],
                                              "bestStreak": summary["bestStreak"], "mode": summary["mode"],
                                              "profileId": profile["id"]})
        return {"summary": summary, "progress": progress, "leaderboard": board}

    @r.op("live")
    def live(call: Call):
        """Live classroom quiz: the teacher hosts, students join with a code (rpc/access.py)."""
        return call.app.live.handle(str(param(call.params, "action", "state")), call.caller.session, call.params)

    # ------------------------------------------------------------ games
    @r.op("pipelineProblems")
    def pipeline_problems(call: Call):
        return call.app.games.problems()

    @r.op("pipelineStart")
    def pipeline_start(call: Call):
        return call.app.games.pipeline_start(call.params)

    @r.op("pipelineRun")
    def pipeline_run(call: Call):
        return call.app.games.pipeline_run(call.caller, call.params)

    @r.op("dailyStart")
    def daily_start(call: Call):
        return call.app.games.daily_start(call.caller, str(param(call.params, "date", today_text())))

    @r.op("challengeStart")
    def challenge_start(call: Call):
        return call.app.games.challenge_start(call.params)

    @r.op("challengeScore")
    def challenge_score(call: Call):
        return call.app.games.challenge_score(call.params)

    # ------------------------------------------------------------ Code Lab
    r.matlab("codeWarmup")

    @r.op("codeTasks")
    def code_tasks(call: Call):
        return call.app.codelab.tasks(call.caller)

    @r.op("codeTaskStart")
    def code_task_start(call: Call):
        return call.app.codelab.start(call.caller, str(param(call.params, "taskId", "")))

    @r.op("codeTaskEdit")
    def code_task_edit(call: Call):
        """The teacher writes the class's Code Lab tasks (teacher only, rpc/access.py)."""
        return call.app.codelab.edit(str(param(call.params, "action", "list")), call.params)

    @r.op("codeTaskSolution")
    def code_task_solution(call: Call):
        return call.app.codelab.solution(call.caller, str(param(call.params, "taskId", "")))

    @r.op("runCode")
    def run_code(call: Call):
        return call.app.codelab.run(call.caller, call.params)

    # ------------------------------------------------------------ experiments
    r.matlab("report")

    @r.op("experiments")
    def experiments(call: Call):
        return call.app.experiments.list()

    @r.op("runExperiment")
    def run_experiment(call: Call):
        return call.app.experiments.run(call.caller, call.params)
