function out = liveQuizManager(action, who, p)
%LIVEQUIZMANAGER Live classroom quiz (Mentimeter / Kahoot style).
%   The teacher builds a quiz (questions from questionBank.m and/or their own
%   questions, a timer for every question, instructions and rules), opens it
%   with a 6-digit join code and sets the pace from the projector screen.
%   Students join on their own devices with the code; MATLAB keeps the
%   clock, measures every student's response time and ranks the class.
%
%   out = liveQuizManager(action, who, p)
%       who : the caller's session (role, profileId, name) - identity is
%             never taken from p
%       p   : request parameters
%
%   Teacher
%     'create'   p.quiz = struct(title, instructions, settings, questions)
%     'host'     everything the projector screen shows (polled)
%     'start' | 'reveal' | 'next' | 'finish' | 'close'   set the pace; with
%                p.qIndex the step only happens if the teacher's screen was
%                on that question (a double click never skips a question)
%     'kick'     p.id - remove a student (they cannot re-join this session)
%     'bank'     every questionBank.m question, to pick from
%     'pick'     p.n, p.categories, p.difficulty - random bank questions
%     'sets' | 'saveSet' (p.set) | 'deleteSet' (p.id)        saved quizzes
%     'history' | 'result' (p.id) | 'deleteResult' (p.id)   finished sessions
%     'export'   p.id ('' = the current session) - CSV + XLSX in reports/output
%
%   Student
%     'join' (p.code) | 'state' (polled) | 'answer' (p.qIndex, p.choice) | 'leave'
%
%   Timing: a question opens when the teacher starts it and closes after its
%   time limit (answers arriving up to GRACE s late still count - network
%   delay). A student's response time runs from the moment MATLAB first sent
%   them the question to the moment their answer arrived, so a slow poll
%   never costs time. When every connected student has answered, the answer
%   is revealed at once (setting autoReveal).
%   Points: a correct answer earns 1000; with speed scoring
%   round(1000 x (1 - 0.5 x time / timeLimit)), i.e. 500 to 1000.
%   Ranking: points, then the total answer time (faster first).
%
%   The running session lives in MATLAB memory. When it finishes it is saved
%   to data/liveQuizResults.mat and recorded in every participant's progress
%   (mode "Live Quiz": topic accuracy, XP and badges as for other quizzes).

persistent S
GRACE = 1.0;            % s - late answers still accepted (network delay)
ONLINE = 8;             % s - a student whose last poll is older is "offline"
if nargin < 3 || ~isstruct(p), p = struct(); end
if ~isempty(S), S = tick(S, GRACE, ONLINE); end

switch action
    % ================================================================ teacher
    case 'create'
        if ~isempty(S) && ~strcmp(S.phase, 'finished')
            error('ImageLab:invalidQuizState', ...
                'A live quiz is already open (code %s). End it before starting a new one.', S.code);
        end
        S = newSession(getf(p, 'quiz', struct()));
        out = hostView(S, ONLINE);

    case 'host'
        out = hostView(S, ONLINE);

    case 'start'
        requireSession(S);
        if sameStep(S, p, 'lobby'), S = openQuestion(S, 1); end
        out = hostView(S, ONLINE);

    case 'reveal'
        requireSession(S);
        if sameStep(S, p, 'question'), S.phase = 'reveal'; end
        out = hostView(S, ONLINE);

    case 'next'
        requireSession(S);
        if sameStep(S, p, 'reveal')
            if S.qIndex >= numel(S.questions), S = finish(S); else, S = openQuestion(S, S.qIndex + 1); end
        end
        out = hostView(S, ONLINE);

    case 'finish'
        requireSession(S);
        if ~strcmp(S.phase, 'finished'), S = finish(S); end
        out = hostView(S, ONLINE);

    case 'close'
        % Answers given so far are never lost: an unfinished quiz is saved first
        if ~isempty(S) && ~strcmp(S.phase, 'finished') && any([S.players.choice] > 0), finish(S); end
        S = [];
        out = hostView(S, ONLINE);

    case 'kick'
        requireSession(S);
        id = char(getf(p, 'id', ''));
        idx = find(strcmp({S.players.id}, id), 1);
        if ~isempty(idx)
            S.players(idx) = [];
            S.kicked{end+1} = id;
        end
        out = hostView(S, ONLINE);

    case 'bank'
        Q = questionBank();
        out = arrayfun(@(q) item(q.id, q.question, q.options, q.answer, q.category, ...
            q.difficulty, q.explanation, 0), Q(:)', 'UniformOutput', false);

    case 'pick'
        cats = getf(p, 'categories', 'all');
        if iscell(cats) && isempty(cats), cats = 'all'; end
        n = min(max(round(double(getf(p, 'n', 5))), 1), 50);
        qs = quizEngine('select', char(getf(p, 'difficulty', 'mixed')), cats, n);
        Q = questionBank();
        out = cell(1, numel(qs));
        for k = 1:numel(qs)                        % the bank's own option order
            q = Q(strcmp({Q.id}, qs(k).id));
            out{k} = item(q.id, q.question, q.options, q.answer, q.category, q.difficulty, q.explanation, 0);
        end

    case 'sets'
        out = loadList('liveQuizSets.mat');

    case 'saveSet'
        out = saveSet(getf(p, 'set', struct()));

    case 'deleteSet'
        L = loadList('liveQuizSets.mat');
        L = L(~cellfun(@(s) strcmp(s.id, char(getf(p, 'id', ''))), L));
        saveList('liveQuizSets.mat', L);
        out = L;

    case 'history'
        R = loadList('liveQuizResults.mat');
        out = cellfun(@(r) rmfield(r, {'questions', 'leaderboard'}), R, 'UniformOutput', false);

    case 'result'
        out = findResult(char(getf(p, 'id', '')));

    case 'deleteResult'
        R = loadList('liveQuizResults.mat');
        R = R(~cellfun(@(r) strcmp(r.id, char(getf(p, 'id', ''))), R));
        saveList('liveQuizResults.mat', R);
        out = cellfun(@(r) rmfield(r, {'questions', 'leaderboard'}), R, 'UniformOutput', false);

    case 'export'
        id = char(getf(p, 'id', ''));
        if isempty(id)
            requireSession(S);
            r = resultRecord(S);
        else
            r = findResult(id);
        end
        out = exportResult(r);

    % ================================================================ student
    case 'join'
        requireStudent(who);
        if isempty(S) || strcmp(S.phase, 'finished')
            error('ImageLab:invalidQuizState', 'There is no live quiz open right now.');
        end
        code = regexprep(char(getf(p, 'code', '')), '\s', '');
        if ~strcmp(code, S.code)
            error('ImageLab:invalidParameter', 'Wrong code - check the code on the teacher''s screen.');
        end
        if any(strcmp(S.kicked, who.profileId))
            error('ImageLab:forbidden', 'The teacher removed you from this quiz.');
        end
        if ~any(strcmp({S.players.id}, who.profileId))
            if ~strcmp(S.phase, 'lobby') && ~S.settings.lateJoin
                error('ImageLab:invalidQuizState', 'This quiz has already started - late joining is switched off.');
            end
            S.players(end+1) = newPlayer(who, numel(S.questions));
        end
        [S, out] = studentView(S, who);

    case 'state'
        requireStudent(who);
        [S, out] = studentView(S, who);

    case 'answer'
        requireStudent(who);
        if isempty(S), error('ImageLab:invalidQuizState', 'The live quiz has ended.'); end
        idx = find(strcmp({S.players.id}, who.profileId), 1);
        if isempty(idx), error('ImageLab:invalidQuizState', 'Join the quiz first.'); end
        k = S.qIndex;
        if double(getf(p, 'qIndex', -1)) ~= k || k == 0
            error('ImageLab:invalidQuizState', 'Time is up - this question is closed.');
        end
        if S.players(idx).choice(k) > 0
            error('ImageLab:invalidQuizState', 'You have already answered this question.');
        end
        if ~strcmp(S.phase, 'question')
            error('ImageLab:invalidQuizState', 'Time is up - this question is closed.');
        end
        q = S.questions(k);
        choice = round(double(getf(p, 'choice', 0)));
        if ~isscalar(choice) || choice < 1 || choice > numel(q.options)
            error('ImageLab:invalidParameter', 'Choose one of the answers.');
        end
        t = nowS();
        seen = S.players(idx).seen(k);
        if isnan(seen), seen = S.qStart; end
        rt = min(max(t - max(seen, S.qStart), 0), q.timeLimit);
        S.players(idx).choice(k) = choice;
        S.players(idx).time(k) = round(rt * 100) / 100;
        S.players(idx).points(k) = points(choice == q.answer, rt, q.timeLimit, S.settings.speedPoints);
        S.players(idx).lastSeen = t;
        S = tick(S, GRACE, ONLINE);                % the last answer reveals at once
        [S, out] = studentView(S, who);

    case 'leave'
        requireStudent(who);
        if ~isempty(S) && strcmp(S.phase, 'lobby')
            S.players(strcmp({S.players.id}, who.profileId)) = [];
        end
        out = true;

    otherwise
        error('ImageLab:invalidParameter', 'Unknown live quiz action "%s".', action);
end
end

% =========================================================================
% Session life cycle
function S = newSession(q)
st = settingsFrom(getf(q, 'settings', struct()));
items = normaliseItems(getf(q, 'questions', {}));
qs = buildQuestions(items, st.timeLimit);
if st.shuffleQuestions, qs = qs(randperm(numel(qs))); end
if st.shuffleOptions
    for k = 1:numel(qs)
        if ~strcmp(qs(k).type, 'truefalse')
            order = randperm(numel(qs(k).options));
            qs(k).options = qs(k).options(order);
            qs(k).answer = find(order == qs(k).answer);
        end
    end
end
title = cleanText(getf(q, 'title', ''), 80, false);
if isempty(title), title = 'Live quiz'; end
S = struct('id', ['LQ' char(datetime('now', 'Format', 'yyyyMMddHHmmss'))], 'code', joinCode(), ...
    'title', title, 'instructions', cleanText(getf(q, 'instructions', ''), 1500, true), ...
    'settings', st, 'questions', {qs}, 'phase', 'lobby', 'qIndex', 0, 'qStart', 0, 'deadline', 0, ...
    'players', {newPlayer([], 0, true)}, 'kicked', {{}}, ...
    'created', char(datetime('now', 'Format', 'yyyy-MM-dd HH:mm')));
end

function S = openQuestion(S, k)
S.qIndex = k;
S.phase = 'question';
S.qStart = nowS();
S.deadline = S.qStart + S.questions(k).timeLimit;
end

function S = tick(S, grace, online)
% Close the open question when its time is up, or when every connected
% student has answered (autoReveal)
if ~strcmp(S.phase, 'question'), return; end
t = nowS();
if t > S.deadline + grace
    S.phase = 'reveal';
elseif S.settings.autoReveal && ~isempty(S.players)
    on = t - [S.players.lastSeen] <= online;
    answered = arrayfun(@(pl) pl.choice(S.qIndex) > 0, S.players);
    if any(answered) && all(answered(on))
        S.phase = 'reveal';
    end
end
end

function S = finish(S)
S.phase = 'finished';
r = resultRecord(S);
R = loadList('liveQuizResults.mat');
R = [{r}, R(~cellfun(@(x) strcmp(x.id, r.id), R))];
saveList('liveQuizResults.mat', R(1:min(end, 100)));
recordProgress(S);
end

function tf = sameStep(S, p, phase)
% True if the session is in this phase and (if the teacher's screen says
% which question it showed) still on that question
tf = strcmp(S.phase, phase) && (~isfield(p, 'qIndex') || isempty(p.qIndex) || double(p.qIndex) == S.qIndex);
end

function recordProgress(S)
% Every participant's own progress gets the quiz like any other quiz mode.
% Runs in the teacher's request, so the active profile is switched per
% student and restored afterwards.
prev = profileManager('active');
restore = onCleanup(@() profileManager('use', prev));
n = S.qIndex;
for j = 1:numel(S.players)
    pl = S.players(j);
    if n == 0 || ~any(pl.choice(1:n) > 0), continue; end
    try
        if ~strcmp(profileManager('use', pl.id), pl.id), continue; end   % student deleted meanwhile
        res = struct('id', {S.questions(1:n).id}, 'category', {S.questions(1:n).category}, ...
            'difficulty', {S.questions(1:n).difficulty}, ...
            'correct', num2cell(pl.choice(1:n) == [S.questions(1:n).answer]), ...
            'timeLeft', num2cell(max([S.questions(1:n).timeLimit] - fillTime(pl, S, n), 0)));
        summary = quizEngine('score', res);
        summary.mode = 'Live Quiz';
        progressManager('quiz', summary, res);
    catch
        % a progress file that cannot be written must not lose the results
    end
end
clear restore
end

% =========================================================================
% Views
function v = hostView(S, online)
if isempty(S)
    v = struct('active', false);
    return
end
t = nowS();
k = S.qIndex;
n = numel(S.players);
on = t - [S.players.lastSeen] <= online;
players = cell(1, n);
for j = 1:n
    pl = S.players(j);
    players{j} = struct('id', pl.id, 'name', pl.name, 'roll', pl.roll, 'online', on(j), ...
        'answered', k > 0 && pl.choice(k) > 0, 'score', sum(pl.points(1:scoredUpTo(S))));
end
v = struct('active', true, 'id', S.id, 'code', S.code, 'title', S.title, ...
    'instructions', S.instructions, 'settings', S.settings, 'phase', S.phase, ...
    'qIndex', k, 'qCount', numel(S.questions), 'remainingMs', remaining(S, t), ...
    'question', [], 'answered', 0, 'online', nnz(on), 'players', {players}, ...
    'distribution', [], 'answerTimes', {{}}, 'leaderboard', {{}}, 'questionStats', {{}}, ...
    'created', S.created);
if k > 0
    q = S.questions(k);
    v.question = questionView(q, true, k);
    v.answered = nnz(arrayfun(@(pl) pl.choice(k) > 0, S.players));
    if ~strcmp(S.phase, 'question')            % nothing about the answers before the reveal
        v.distribution = num2cell(arrayfun(@(o) nnz(arrayfun(@(pl) pl.choice(k) == o, S.players)), 1:numel(q.options)));
        v.answerTimes = answerTimes(S, k);
    end
end
v.leaderboard = leaderboard(S, scoredUpTo(S));
if strcmp(S.phase, 'finished') || strcmp(S.phase, 'reveal')
    v.questionStats = questionStats(S, scoredUpTo(S));
end
end

function [S, v] = studentView(S, who)
v = struct('active', ~isempty(S), 'joined', false);
if isempty(S), return; end
t = nowS();
idx = find(strcmp({S.players.id}, who.profileId), 1);
v.title = S.title;
v.phase = S.phase;
v.canJoin = ~strcmp(S.phase, 'finished') && (strcmp(S.phase, 'lobby') || S.settings.lateJoin) ...
    && ~any(strcmp(S.kicked, who.profileId));
if isempty(idx), return; end
S.players(idx).lastSeen = t;
k = S.qIndex;
if strcmp(S.phase, 'question') && isnan(S.players(idx).seen(k))
    S.players(idx).seen(k) = t;                % this student's clock starts now
end
pl = S.players(idx);
upto = scoredUpTo(S);
B = leaderboard(S, upto);
me = B{cellfun(@(b) strcmp(b.id, pl.id), B)};
v.joined = true;
v.name = pl.name;
v.instructions = S.instructions;
v.settings = S.settings;
v.qIndex = k;
v.qCount = numel(S.questions);
v.playerCount = numel(S.players);
v.remainingMs = remaining(S, t);
v.me = me;
v.question = [];
v.mine = [];
v.leaderboard = {};
if k > 0
    q = S.questions(k);
    reveal = ~strcmp(S.phase, 'question');
    v.question = questionView(q, reveal, k);
    % points and correctness only after the reveal
    v.mine = struct('choice', pl.choice(k), 'time', pl.time(k), 'points', reveal * pl.points(k), ...
        'correct', reveal && pl.choice(k) == q.answer);
    if reveal
        v.distribution = num2cell(arrayfun(@(o) nnz(arrayfun(@(x) x.choice(k) == o, S.players)), 1:numel(q.options)));
    end
end
if S.settings.showLeaderboard && ~any(strcmp(S.phase, {'lobby', 'question'}))
    v.leaderboard = B(1:min(numel(B), boardSize(S.settings.leaderboard)));
end
end

function q = questionView(q, withAnswer, k)
v = struct('index', k, 'question', q.question, 'options', {q.options}, 'category', q.category, ...
    'difficulty', q.difficulty, 'type', q.type, 'timeLimit', q.timeLimit);
if withAnswer
    v.answer = q.answer;
    v.explanation = q.explanation;
end
q = v;
end

function n = scoredUpTo(S)
% Questions whose points count on the board: the open question only after its reveal
n = S.qIndex - strcmp(S.phase, 'question');
end

function ms = remaining(S, t)
ms = 0;
if strcmp(S.phase, 'question'), ms = round(1000 * max(S.deadline - t, 0)); end
end

function B = leaderboard(S, n)
% Ranked by points, then total answer time (unanswered = full time limit)
B = {};
if isempty(S.players), return; end
[order, score, total] = ranking(S, n);
prevOrder = ranking(S, n - 1);
B = cell(1, numel(order));
for r = 1:numel(order)
    j = order(r);
    pl = S.players(j);
    asked = 1:max(n, 0);
    answered = pl.choice(asked) > 0;
    last = struct('choice', 0, 'time', [], 'points', 0, 'correct', false);
    if n > 0
        last = struct('choice', pl.choice(n), 'time', pl.time(n), 'points', pl.points(n), ...
            'correct', pl.choice(n) == S.questions(n).answer);
    end
    avg = mean(pl.time(asked(answered)));
    if ~any(answered), avg = []; end
    B{r} = struct('rank', r, 'id', pl.id, 'name', pl.name, 'roll', pl.roll, 'score', score(j), ...
        'correct', nnz(pl.choice(asked) == [S.questions(asked).answer]), 'answered', nnz(answered), ...
        'avgTime', round(avg * 100) / 100, 'totalTime', round(total(j) * 100) / 100, ...
        'move', find(prevOrder == j) - r, 'last', last);
end
end

function [order, score, total] = ranking(S, n)
m = numel(S.players);
score = zeros(1, m); total = zeros(1, m);
for j = 1:m
    if n > 0
        score(j) = sum(S.players(j).points(1:n));
        total(j) = sum(fillTime(S.players(j), S, n));
    end
end
names = lower({S.players.name});
[~, byName] = sort(names);
idx = byName;                                  % stable sorts: name, then time, then score
[~, o] = sort(total(idx), 'ascend');  idx = idx(o);
[~, o] = sort(score(idx), 'descend'); idx = idx(o);
order = idx;
end

function t = fillTime(pl, S, n)
% Answer times of questions 1..n; an unanswered question counts its full time limit
t = pl.time(1:n);
miss = pl.choice(1:n) == 0;
lim = [S.questions(1:n).timeLimit];
t(miss) = lim(miss);
end

function A = answerTimes(S, k)
% Every answer to question k, fastest first
pl = S.players(arrayfun(@(x) x.choice(k) > 0, S.players));
[~, o] = sort(arrayfun(@(x) x.time(k), pl));
pl = pl(o);
A = cell(1, numel(pl));
for j = 1:numel(pl)
    A{j} = struct('id', pl(j).id, 'name', pl(j).name, 'roll', pl(j).roll, 'time', pl(j).time(k), ...
        'choice', pl(j).choice(k), 'correct', pl(j).choice(k) == S.questions(k).answer, 'points', pl(j).points(k));
end
end

function Q = questionStats(S, n)
Q = cell(1, max(n, 0));
for k = 1:n
    q = S.questions(k);
    ch = arrayfun(@(pl) pl.choice(k), S.players);
    tm = arrayfun(@(pl) pl.time(k), S.players);
    a = ch > 0;
    avg = mean(tm(a)); if ~any(a), avg = []; end
    pct = []; if ~isempty(ch), pct = round(100 * nnz(ch == q.answer) / numel(ch), 1); end
    Q{k} = struct('index', k, 'question', q.question, 'category', q.category, ...
        'options', {q.options}, 'answer', q.answer, 'timeLimit', q.timeLimit, ...
        'answered', nnz(a), 'correct', nnz(ch == q.answer), 'correctPct', pct, ...
        'avgTime', round(avg * 100) / 100, ...
        'counts', {num2cell(arrayfun(@(o) nnz(ch == o), 1:numel(q.options)))});
end
end

function n = boardSize(mode)
switch mode
    case 'top5',  n = 5;
    case 'top10', n = 10;
    otherwise,    n = Inf;
end
end

% =========================================================================
% Saved results
function r = resultRecord(S)
n = scoredUpTo(S);
B = leaderboard(S, n);
for j = 1:numel(B)
    pl = S.players(strcmp({S.players.id}, B{j}.id));
    B{j}.choices = num2cell(pl.choice(1:n));
    B{j}.times = num2cell(pl.time(1:n));
    B{j}.points = num2cell(pl.points(1:n));
    B{j} = rmfield(B{j}, {'move', 'last'});
end
Q = questionStats(S, n);
acc = []; avgT = [];
if n > 0 && ~isempty(S.players)
    ch = reshape([S.players.choice], [], numel(S.players))';
    acc = round(100 * nnz(ch(:, 1:n) == [S.questions(1:n).answer]) / (n * numel(S.players)), 1);
    tm = reshape([S.players.time], [], numel(S.players))';
    tm = tm(:, 1:n);
    if any(~isnan(tm(:))), avgT = round(mean(tm(~isnan(tm))) * 100) / 100; end
end
r = struct('id', S.id, 'code', S.code, 'title', S.title, 'date', S.created, ...
    'questionCount', n, 'plannedQuestions', numel(S.questions), 'playerCount', numel(S.players), ...
    'accuracy', acc, 'avgTime', avgT, 'winner', '', 'questions', {Q}, 'leaderboard', {B});
if ~isempty(B), r.winner = B{1}.name; end
end

function r = findResult(id)
R = loadList('liveQuizResults.mat');
idx = find(cellfun(@(x) strcmp(x.id, id), R), 1);
if isempty(idx), error('ImageLab:invalidParameter', 'That live quiz result no longer exists.'); end
r = R{idx};
end

function f = exportResult(r)
root = fileparts(fileparts(mfilename('fullpath')));
outDir = fullfile(root, 'reports', 'output');
if ~isfolder(outDir), mkdir(outDir); end
base = ['ImageLab_live_quiz_' regexprep(r.id, '^LQ', '')];
B = r.leaderboard; Q = r.questions;
nb = numel(B); nq = numel(Q);
col = @(c, f) reshape(cellfun(@(x) num(x.(f)), c), [], 1);
str = @(c, f) reshape(string(cellfun(@(x) x.(f), c, 'UniformOutput', false)), [], 1);
if nb == 0
    T = table(zeros(0, 1), strings(0, 1), strings(0, 1), zeros(0, 1), zeros(0, 1), zeros(0, 1), zeros(0, 1), zeros(0, 1));
else
    T = table(col(B, 'rank'), str(B, 'name'), str(B, 'roll'), col(B, 'score'), col(B, 'correct'), ...
        col(B, 'answered'), col(B, 'avgTime'), col(B, 'totalTime'));
end
T.Properties.VariableNames = {'Rank', 'Name', 'Roll', 'Points', 'Correct', 'Answered', ...
    'Average answer time (s)', 'Total time (s)'};
letters = 'ABCDEF';
if nq == 0
    TQ = table(zeros(0, 1), strings(0, 1), strings(0, 1), strings(0, 1), zeros(0, 1), zeros(0, 1), zeros(0, 1), zeros(0, 1));
else
    TQ = table(col(Q, 'index'), str(Q, 'question'), str(Q, 'category'), ...
        reshape(string(cellfun(@(q) sprintf('%s: %s', letters(q.answer), q.options{q.answer}), Q, 'UniformOutput', false)), [], 1), ...
        col(Q, 'timeLimit'), col(Q, 'answered'), col(Q, 'correctPct'), col(Q, 'avgTime'));
end
TQ.Properties.VariableNames = {'Question', 'Text', 'Topic', 'Correct answer', 'Time limit (s)', ...
    'Answered', 'Correct (%)', 'Average answer time (s)'};
% One row per student, three columns per question: answer letter, time, points
TA = table(str(B, 'name'), str(B, 'roll'), 'VariableNames', {'Name', 'Roll'});
if nb == 0, TA = table(strings(0, 1), strings(0, 1), 'VariableNames', {'Name', 'Roll'}); end
for k = 1:nq
    ch = cellfun(@(b) b.choices{k}, B); ch = ch(:);
    ans_ = repmat("-", nb, 1);
    ans_(ch > 0) = string(reshape(letters(ch(ch > 0)), [], 1));
    TA.(sprintf('Q%d answer', k)) = ans_;
    TA.(sprintf('Q%d time (s)', k)) = reshape(cellfun(@(b) num(b.times{k}), B), [], 1);
    TA.(sprintf('Q%d points', k)) = reshape(cellfun(@(b) num(b.points{k}), B), [], 1);
end
writetable(T, fullfile(outDir, [base '.csv']));
xlsx = fullfile(outDir, [base '.xlsx']);
if isfile(xlsx), delete(xlsx); end
writetable(T, xlsx, 'Sheet', 'Leaderboard');
writetable(TQ, xlsx, 'Sheet', 'Questions');
writetable(TA, xlsx, 'Sheet', 'Answers');
f = struct('csv', [base '.csv'], 'xlsx', [base '.xlsx']);
end

function x = num(v)
if isempty(v), x = NaN; else, x = double(v); end
end

% =========================================================================
% Quiz definition: settings and questions
function st = settingsFrom(s)
st = struct('timeLimit', clampTime(getf(s, 'timeLimit', 20), 20), ...
    'speedPoints', flag(s, 'speedPoints', true), ...
    'leaderboard', 'top5', ...
    'showLeaderboard', flag(s, 'showLeaderboard', true), ...
    'autoReveal', flag(s, 'autoReveal', true), ...
    'lateJoin', flag(s, 'lateJoin', true), ...
    'shuffleQuestions', flag(s, 'shuffleQuestions', false), ...
    'shuffleOptions', flag(s, 'shuffleOptions', false));
lb = lower(char(getf(s, 'leaderboard', 'top5')));
if any(strcmp(lb, {'top5', 'top10', 'all'})), st.leaderboard = lb; end
end

function tf = flag(s, name, default)
tf = logical(getf(s, name, default));
if ~isscalar(tf), tf = default; end
end

function t = clampTime(v, default)
v = double(v);
if ~isscalar(v) || ~isfinite(v) || v <= 0, t = default; else, t = min(max(round(v), 5), 300); end
end

function items = normaliseItems(raw)
% Questions as sent by the browser (struct array or cell) -> cell of items.
% A bank question is {bankId, timeLimit}; the bank's text is used.
if isstruct(raw), raw = num2cell(raw); end
if ~iscell(raw), raw = {}; end
if numel(raw) > 50
    error('ImageLab:invalidParameter', 'A live quiz can have at most 50 questions.');
end
Q = questionBank();
items = cell(1, numel(raw));
for k = 1:numel(raw)
    r = raw{k};
    if ~isstruct(r), error('ImageLab:invalidParameter', 'Question %d is malformed.', k); end
    bankId = char(getf(r, 'bankId', ''));
    tl = clampTime(getf(r, 'timeLimit', 0), 0);
    if ~isempty(bankId)
        b = Q(strcmp({Q.id}, bankId));
        if isempty(b), error('ImageLab:invalidParameter', 'Question %d: "%s" is not in the question bank.', k, bankId); end
        items{k} = item(b.id, b.question, b.options, b.answer, b.category, b.difficulty, b.explanation, tl);
        continue
    end
    text = cleanText(getf(r, 'question', ''), 300, true);
    opts = getf(r, 'options', {});
    if ischar(opts) || isstring(opts), opts = cellstr(opts); end
    if ~iscell(opts), opts = {}; end
    opts = cellfun(@(o) cleanText(o, 120, false), reshape(opts, 1, []), 'UniformOutput', false);
    if isempty(text), error('ImageLab:invalidParameter', 'Question %d has no text.', k); end
    if numel(opts) < 2 || numel(opts) > 6 || any(cellfun(@isempty, opts))
        error('ImageLab:invalidParameter', 'Question %d needs 2 to 6 answers, none of them empty.', k);
    end
    ans_ = double(getf(r, 'answer', 0));
    if ~isscalar(ans_) || ans_ < 1 || ans_ > numel(opts) || ans_ ~= round(ans_)
        error('ImageLab:invalidParameter', 'Question %d: mark the correct answer.', k);
    end
    cat = char(getf(r, 'category', ''));
    if ~any(strcmp(cat, quizEngine('categories'))), cat = 'General'; end
    diff = lower(char(getf(r, 'difficulty', 'medium')));
    if ~any(strcmp(diff, {'easy', 'medium', 'hard'})), diff = 'medium'; end
    items{k} = item('', text, opts, ans_, cat, diff, cleanText(getf(r, 'explanation', ''), 400, true), tl);
end
end

function it = item(bankId, question, options, answer, category, difficulty, explanation, timeLimit)
it = struct('bankId', bankId, 'question', question, 'options', {reshape(cellstr(options), 1, [])}, ...
    'answer', answer, 'category', category, 'difficulty', difficulty, ...
    'explanation', explanation, 'timeLimit', timeLimit);
end

function qs = buildQuestions(items, defaultTime)
if isempty(items)
    error('ImageLab:invalidParameter', 'Add at least one question to the quiz.');
end
qs = struct('id', {}, 'category', {}, 'difficulty', {}, 'type', {}, 'question', {}, ...
    'options', {}, 'answer', {}, 'explanation', {}, 'timeLimit', {});
for k = 1:numel(items)
    it = items{k};
    id = it.bankId;
    if isempty(id), id = sprintf('LIVE%d', k); end
    type = 'mcq';
    if numel(it.options) == 2 && all(strcmpi(it.options, {'True', 'False'})), type = 'truefalse'; end
    tl = it.timeLimit; if tl <= 0, tl = defaultTime; end
    qs(end+1) = struct('id', id, 'category', it.category, 'difficulty', it.difficulty, 'type', type, ...
        'question', it.question, 'options', {it.options}, 'answer', it.answer, ...
        'explanation', it.explanation, 'timeLimit', tl); %#ok<AGROW>
end
end

function L = saveSet(s)
title = cleanText(getf(s, 'title', ''), 80, false);
if isempty(title), error('ImageLab:invalidParameter', 'Give the quiz a title before saving it.'); end
items = normaliseItems(getf(s, 'questions', {}));
buildQuestions(items, 20);                     % same checks as when it is opened
L = loadList('liveQuizSets.mat');
id = char(getf(s, 'id', ''));
if isempty(regexp(id, '^[A-Za-z0-9_]{1,40}$', 'once')), id = ['set' char(datetime('now', 'Format', 'yyyyMMddHHmmssSSS'))]; end
entry = struct('id', id, 'title', title, 'instructions', cleanText(getf(s, 'instructions', ''), 1500, true), ...
    'settings', settingsFrom(getf(s, 'settings', struct())), 'questions', {items}, ...
    'updated', char(datetime('now', 'Format', 'yyyy-MM-dd HH:mm')));
L = [{entry}, L(~cellfun(@(x) strcmp(x.id, id), L))];
if numel(L) > 50, L = L(1:50); end
saveList('liveQuizSets.mat', L);
end

% =========================================================================
% Helpers
function pl = newPlayer(who, nq, emptyList)
if nargin > 2 && emptyList
    pl = struct('id', {}, 'name', {}, 'roll', {}, 'joined', {}, 'lastSeen', {}, ...
        'choice', {}, 'time', {}, 'points', {}, 'seen', {});
    return
end
roll = '';
roster = profileManager('roster');
idx = find(strcmp({roster.id}, who.profileId), 1);
if ~isempty(idx), roll = char(roster(idx).roll); end
t = nowS();
pl = struct('id', who.profileId, 'name', char(who.name), 'roll', roll, 'joined', t, 'lastSeen', t, ...
    'choice', zeros(1, nq), 'time', nan(1, nq), 'points', zeros(1, nq), 'seen', nan(1, nq));
end

function pts = points(correct, rt, limit, speed)
pts = 0;
if ~correct, return; end
if speed, pts = round(1000 * (1 - 0.5 * min(rt / limit, 1))); else, pts = 1000; end
end

function code = joinCode()
persistent rng_
if isempty(rng_), rng_ = java.security.SecureRandom(); end
code = sprintf('%06d', 100000 + rng_.nextInt(900000));
end

function requireSession(S)
if isempty(S), error('ImageLab:invalidQuizState', 'No live quiz is open.'); end
end

function requireStudent(who)
if isempty(who) || ~strcmp(who.role, 'student')
    error('ImageLab:forbidden', 'Sign in with your student account to join a live quiz.');
end
end

function s = cleanText(v, maxLen, keepNewlines)
if isstring(v), v = char(v); end
if ~ischar(v), s = ''; return; end
if keepNewlines
    s = regexprep(v, '\r\n?', '\n');
    s = regexprep(s, '[\x00-\x09\x0B-\x1F]', '');
else
    s = regexprep(v, '[\x00-\x1F]', ' ');
end
s = strtrim(s);
if numel(s) > maxLen, s = s(1:maxLen); end
end

function v = getf(s, name, default)
if isstruct(s) && isfield(s, name) && ~isempty(s.(name)), v = s.(name); else, v = default; end
end

function t = nowS()
% Seconds on one monotonic clock for the whole MATLAB session
persistent t0
if isempty(t0), t0 = tic; end
t = toc(t0);
end

function L = loadList(name)
L = {};
s = dataCache('load', dataFile(name));
if isstruct(s) && isfield(s, 'L') && iscell(s.L), L = reshape(s.L, 1, []); end
end

function saveList(name, L) %#ok<INUSD> - saved by variable name
f = dataFile(name);
if ~isfolder(fileparts(f)), mkdir(fileparts(f)); end
save(f, 'L');
dataCache('put', f, struct('L', {L}));
end

function f = dataFile(name)
f = fullfile(fileparts(fileparts(mfilename('fullpath'))), 'data', name);
end
