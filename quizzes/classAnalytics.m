function out = classAnalytics(action, S, varargin)
%CLASSANALYTICS Class views for the teacher (called by classroomManager).
%   R = classAnalytics('report', S)        roster + topic heatmap + experiment and
%                                          Code Lab task completion (also used for export)
%   O = classAnalytics('overview', S)      report + dashboard KPIs, students who need
%                                          attention and the recent activity feed
%   M = classAnalytics('submissions', S)   Code Lab matrix: every student x every task
%   D = classAnalytics('student', S, id)   everything about one student
%   C = classAnalytics('submission', S, id, taskId)   one student's code for one task
%
%   S is the classroom settings struct (experiment and code-task states).
%   All views are built from ONE pass over the students; progress and
%   submission files come from dataCache, so a refresh only reads the files
%   that changed since the last one.

switch action
    case 'report'
        out = report(S, collect(S));
    case 'overview'
        C = collect(S);
        out = report(S, C);
        out.dashboard = dashboard(S, C);
    case 'submissions'
        out = submissions(S);
    case 'student'
        out = studentDetail(S, char(varargin{1}));
    case 'submission'
        id = char(varargin{1}); taskId = char(varargin{2});
        pr = findProfile(id);
        t = codeTasks('get', taskId);
        e = submissionStore('get', id, taskId);
        out = struct('student', struct('id', pr.id, 'name', pr.name, 'roll', pr.roll), ...
            'task', struct('id', t.id, 'title', t.title, 'level', t.level), 'entry', e);
    otherwise
        error('ImageLab:internal', 'Unknown classAnalytics action "%s".', action);
end
end

% =========================================================================
function C = collect(S)
% One pass over all students: everything the views need, nothing more
roster = profileManager('roster');
cats = quizEngine('categories');
tasks = codeTasks('list');
taskIds = cellfun(@(t) t.id, tasks, 'UniformOutput', false);
n = numel(roster);
C = struct('profiles', {cell(1, n)}, 'cats', {cats}, 'taskIds', {taskIds}, ...
    'tasks', {tasks}, 'p', {cell(1, n)}, 'subs', {cell(1, n)});
for k = 1:n
    id = roster(k).id;
    r = progressManager('inspect', profileManager('file', id));     % one read per student
    C.p{k} = r.p;
    C.profiles{k} = profileManager('row', roster(k), r.peek);
    C.subs{k} = submissionStore('summary', id);
end
end

function R = report(S, C)
cats = C.cats;
nS = numel(C.profiles);
expAssigned = [S.experiments(strcmp({S.experiments.status}, 'assigned')).number];
codeAssigned = {S.codeTasks(strcmp({S.codeTasks.status}, 'assigned')).id};
students = cell(1, nS);
answered = zeros(1, numel(cats)); correct = answered; struggling = answered;
expDone = zeros(1, numel(S.experiments));
codeDone = zeros(1, numel(S.codeTasks)); codeTried = codeDone;
for k = 1:nS
    pr = C.profiles{k};
    p = C.p{k};
    acc = nan(1, numel(cats));
    for c = 1:numel(cats)
        idx = find(strcmp({p.categoryStats.name}, cats{c}), 1);
        if ~isempty(idx) && p.categoryStats(idx).answered > 0
            a = p.categoryStats(idx).answered;
            r = p.categoryStats(idx).correct;
            acc(c) = 100 * r / a;
            answered(c) = answered(c) + a;
            correct(c) = correct(c) + r;
            if a >= 2 && acc(c) < 60, struggling(c) = struggling(c) + 1; end
        end
    end
    done = p.experimentsCompleted;
    expDone = expDone + ismember([S.experiments.number], done);
    solved = solvedTasks(C.subs{k});
    tried = fieldnames(C.subs{k})';
    codeDone = codeDone + ismember({S.codeTasks.id}, solved);
    codeTried = codeTried + ismember({S.codeTasks.id}, tried);
    last = '';
    if ~isempty(p.quizHistory), last = p.quizHistory(end).date; end
    students{k} = struct('id', pr.id, 'name', pr.name, 'roll', pr.roll, 'level', pr.level, 'xp', pr.xp, ...
        'badges', pr.badges, 'quizzes', pr.quizzes, 'accuracy', pr.accuracy, ...
        'questions', p.questionsAnswered, 'dailyStreak', pr.dailyStreak, ...
        'experimentsDone', {num2cell(sort(done))}, ...
        'assignedDone', nnz(ismember(expAssigned, done)), 'assignedTotal', numel(expAssigned), ...
        'codeSolved', numel(solved), 'codeAssignedDone', nnz(ismember(codeAssigned, solved)), ...
        'codeAssignedTotal', numel(codeAssigned), 'codeAttempts', totalAttempts(C.subs{k}), ...
        'topicAccuracy', {num2cell(acc)}, 'lastQuiz', last, 'lastActive', lastActive(p, C.subs{k}));
end
topics = struct('category', cats, 'answered', num2cell(answered), 'correct', num2cell(correct), ...
    'accuracy', num2cell(100 * correct ./ max(answered, 1)), 'struggling', num2cell(struggling));
for c = 1:numel(topics)
    if answered(c) == 0, topics(c).accuracy = NaN; end
end
tried = topics(answered > 0);
[~, order] = sort([tried.accuracy]);
experiments = S.experiments;
for k = 1:numel(experiments), experiments(k).completedBy = expDone(k); end
code = S.codeTasks;
for k = 1:numel(code)
    code(k).solvedBy = codeDone(k);
    code(k).triedBy = codeTried(k);
    t = C.tasks{strcmp(C.taskIds, code(k).id)};
    code(k).level = t.level; code(k).unit = t.unit; code(k).topic = t.topic;
end
R = struct('students', {students}, 'categories', {cats}, 'topics', {num2cell(topics)}, ...
    'weakest', {num2cell(tried(order))}, 'experiments', {num2cell(experiments)}, ...
    'codeTasks', {num2cell(code)}, 'studentCount', nS, ...
    'generated', char(datetime('now', 'Format', 'yyyy-MM-dd HH:mm')));
end

function D = dashboard(S, C)
today = char(datetime('now', 'Format', 'yyyy-MM-dd'));
nS = numel(C.profiles);
expOverdue = S.experiments(strcmp({S.experiments.status}, 'assigned') & ...
    ~cellfun(@isempty, {S.experiments.due}) & cellfun(@(d) string(d) < string(today), {S.experiments.due}));
codeOverdue = S.codeTasks(strcmp({S.codeTasks.status}, 'assigned') & ...
    ~cellfun(@isempty, {S.codeTasks.due}) & cellfun(@(d) string(d) < string(today), {S.codeTasks.due}));
active7 = 0; xp = zeros(1, nS); solvedTotal = 0;
attention = {};
feed = struct('time', {}, 'type', {}, 'text', {}, 'studentId', {}, 'student', {});
for k = 1:nS
    pr = C.profiles{k}; p = C.p{k}; subs = C.subs{k};
    xp(k) = pr.xp;
    solved = solvedTasks(subs);
    solvedTotal = solvedTotal + numel(solved);
    la = lastActive(p, subs);
    days = daysSince(la);
    if days <= 7, active7 = active7 + 1; end

    issues = {};
    nOver = nnz(~ismember([expOverdue.number], p.experimentsCompleted)) + ...
            nnz(~ismember({codeOverdue.id}, solved));
    if nOver > 0, issues{end+1} = sprintf('%d overdue assignment%s', nOver, plural(nOver)); end %#ok<AGROW>
    if isempty(la)
        issues{end+1} = 'Has not started yet'; %#ok<AGROW>
    elseif days > 7
        issues{end+1} = sprintf('Inactive for %d days', floor(days)); %#ok<AGROW>
    end
    if p.questionsAnswered >= 10 && pr.accuracy < 60
        issues{end+1} = sprintf('Quiz accuracy %d%%', round(pr.accuracy)); %#ok<AGROW>
    end
    f = fieldnames(subs);
    for j = 1:numel(f)
        e = subs.(f{j});
        if ~e.passed && e.attempts >= 5
            t = C.tasks{strcmp(C.taskIds, f{j})};
            issues{end+1} = sprintf('Stuck on "%s" (%d attempts)', t.title, e.attempts); %#ok<AGROW>
        end
    end
    if ~isempty(issues)
        attention{end+1} = struct('id', pr.id, 'name', pr.name, 'issues', {issues}, 'score', numel(issues)); %#ok<AGROW>
    end
    ev = p.events;
    for j = max(1, numel(ev) - 9):numel(ev)       % at most 10 per student
        feed(end+1) = struct('time', ev(j).time, 'type', ev(j).type, 'text', ev(j).text, ...
            'studentId', pr.id, 'student', pr.name); %#ok<AGROW>
    end
end
if ~isempty(attention)
    a = [attention{:}];
    [~, order] = sort([a.score], 'descend');
    attention = attention(order(1:min(12, end)));
end
if ~isempty(feed)
    [~, order] = sort({feed.time});
    feed = feed(fliplr(order));
    feed = feed(1:min(25, end));
end
expAssigned = nnz(strcmp({S.experiments.status}, 'assigned'));
codeAssigned = {S.codeTasks(strcmp({S.codeTasks.status}, 'assigned')).id};
doneAssigned = 0;
for k = 1:nS
    doneAssigned = doneAssigned + nnz(ismember([S.experiments(strcmp({S.experiments.status}, 'assigned')).number], C.p{k}.experimentsCompleted)) ...
        + nnz(ismember(codeAssigned, solvedTasks(C.subs{k})));
end
totalAssigned = (expAssigned + numel(codeAssigned)) * nS;
D = struct('activeThisWeek', active7, 'averageXp', sum(xp) / max(nS, 1), ...
    'codeSolved', solvedTotal, 'codeSolvedPerStudent', solvedTotal / max(nS, 1), ...
    'assignedCount', expAssigned + numel(codeAssigned), ...
    'assignedCompletion', 100 * doneAssigned / max(totalAssigned, 1) * (totalAssigned > 0), ...
    'overdueCount', numel(expOverdue) + numel(codeOverdue), ...
    'attention', {attention}, 'feed', {num2cell(feed)});
end

function M = submissions(S)
roster = profileManager('roster');
profiles = num2cell(roster(:)');
tasks = codeTasks('list');
rows = cell(1, numel(profiles));
for k = 1:numel(profiles)
    pr = profiles{k};
    subs = submissionStore('summary', pr.id);
    cells = cell(1, numel(tasks));
    for j = 1:numel(tasks)
        id = tasks{j}.id;
        if isfield(subs, id)
            e = subs.(id);
            cells{j} = struct('attempts', e.attempts, 'passed', e.passed, 'bestMatch', e.bestMatch, ...
                'lastRun', e.lastRun, 'firstSolved', e.firstSolved);
        else
            cells{j} = struct('attempts', 0, 'passed', false, 'bestMatch', 0, 'lastRun', '', 'firstSolved', '');
        end
    end
    rows{k} = struct('id', pr.id, 'name', pr.name, 'roll', pr.roll, 'cells', {cells});
end
info = cellfun(@(t) struct('id', t.id, 'title', t.title, 'level', t.level, ...
    'status', S.codeTasks(strcmp({S.codeTasks.id}, t.id)).status), tasks, 'UniformOutput', false);
M = struct('tasks', {info}, 'students', {rows});
end

function D = studentDetail(S, id)
pr = findProfile(id);
file = profileManager('file', id);
p = progressManager('raw', file);
summary = progressManager('summaryOf', file);
subs = submissionStore('summary', id);
tasks = codeTasks('list');
code = cell(1, numel(tasks));
for j = 1:numel(tasks)
    t = tasks{j};
    st = S.codeTasks(strcmp({S.codeTasks.id}, t.id));
    e = struct('attempts', 0, 'passed', false, 'bestMatch', 0, 'lastMatch', 0, 'lastRun', '', ...
        'firstSolved', '', 'attemptsToSolve', 0, 'lastError', '');
    if isfield(subs, t.id), e = subs.(t.id); end
    code{j} = struct('id', t.id, 'title', t.title, 'level', t.level, 'status', st.status, 'due', st.due, ...
        'attempts', e.attempts, 'passed', e.passed, 'bestMatch', e.bestMatch, 'lastRun', e.lastRun, ...
        'firstSolved', e.firstSolved, 'attemptsToSolve', e.attemptsToSolve, 'lastError', e.lastError);
end
exps = S.experiments;
for k = 1:numel(exps), exps(k).done = ismember(exps(k).number, p.experimentsCompleted); end
cats = quizEngine('categories');
topicStats = cell(1, numel(cats));
for c = 1:numel(cats)
    idx = find(strcmp({p.categoryStats.name}, cats{c}), 1);
    a = 0; r = 0;
    if ~isempty(idx), a = p.categoryStats(idx).answered; r = p.categoryStats(idx).correct; end
    topicStats{c} = struct('category', cats{c}, 'answered', a, 'correct', r, 'accuracy', 100 * r / max(a, 1));
end
D = struct('id', pr.id, 'name', pr.name, 'roll', pr.roll, 'created', pr.created, ...
    'summary', summary, 'lastActive', lastActive(p, subs), ...
    'events', {num2cell(fliplr(p.events))}, 'quizHistory', {num2cell(fliplr(p.quizHistory))}, ...
    'experiments', {num2cell(exps)}, 'topics', {topicStats}, 'code', {code});
end

% =========================================================================
function pr = findProfile(id)
roster = profileManager('roster');
idx = find(strcmp({roster.id}, id), 1);
if isempty(idx)
    error('ImageLab:invalidParameter', 'That student no longer exists.');
end
pr = roster(idx);
end

function ids = solvedTasks(subs)
f = fieldnames(subs);
ids = f(cellfun(@(k) subs.(k).passed, f))';
if isempty(ids), ids = {}; end
end

function n = totalAttempts(subs)
f = fieldnames(subs);
n = sum(cellfun(@(k) subs.(k).attempts, f));
end

function t = lastActive(p, subs)
% Latest of the progress change and the latest Code Lab run
t = p.lastActive;
f = fieldnames(subs);
for k = 1:numel(f)
    if string(subs.(f{k}).lastRun) > string(t), t = subs.(f{k}).lastRun; end
end
t = char(t);
end

function d = daysSince(t)
if isempty(t), d = Inf; return; end
d = days(datetime('now') - datetime(t, 'InputFormat', 'yyyy-MM-dd HH:mm'));
end

function s = plural(n)
if n == 1, s = ''; else, s = 's'; end
end
