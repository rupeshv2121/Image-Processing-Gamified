function out = classroomManager(action, varargin)
%CLASSROOMMANAGER Teacher settings and class reports (data/classroom.mat).
%
%   s = classroomManager('get')                      public settings: hasPin and the
%                                                    status of every experiment
%   tf = classroomManager('checkPin', pin)            true if pin is right (or no PIN set)
%   classroomManager('requirePin', pin)              error if the pin is wrong
%   s = classroomManager('setPin', oldPin, newPin)   set / change ('' removes the PIN)
%   s = classroomManager('setExperiment', n, status, due, note)
%        status: 'open' | 'assigned' | 'locked'   due: 'yyyy-mm-dd' or ''
%   classroomManager('assertRunnable', n)            error if experiment n is locked
%   r = classroomManager('report')                   class overview (all student profiles)
%   f = classroomManager('export')                   writes CSV + XLSX to reports/output
%
%   The PIN is never stored: only its SHA-256 hash (salted with a random value).

root = fileparts(fileparts(mfilename('fullpath')));
file = fullfile(root, 'data', 'classroom.mat');
S = loadSettings(file);

switch action
    case 'get'
        out = publicView(S);

    case 'checkPin'
        out = pinOk(S, char(varargin{1}));

    case 'requirePin'
        if ~pinOk(S, char(varargin{1}))
            error('ImageLab:teacherPin', 'Wrong teacher PIN.');
        end
        out = true;

    case 'setPin'
        if ~pinOk(S, char(varargin{1}))
            error('ImageLab:teacherPin', 'Wrong teacher PIN.');
        end
        newPin = char(varargin{2});
        if isempty(newPin)
            S.pinHash = ''; S.salt = '';
        else
            if numel(newPin) < 4 || numel(newPin) > 32
                error('ImageLab:invalidParameter', 'The PIN must have 4 to 32 characters.');
            end
            S.salt = randomSalt();
            S.pinHash = hashPin(S.salt, newPin);
        end
        saveSettings(file, S);
        out = publicView(S);

    case 'setExperiment'
        n = double(varargin{1});
        status = lower(char(varargin{2}));
        if ~any(strcmp(status, {'open', 'assigned', 'locked'}))
            error('ImageLab:invalidParameter', 'Status must be open, assigned or locked.');
        end
        due = char(argOr(varargin, 3, ''));
        if ~isempty(due) && isempty(regexp(due, '^\d{4}-\d{2}-\d{2}$', 'once'))
            error('ImageLab:invalidParameter', 'The due date must look like 2026-10-31.');
        end
        note = strtrim(regexprep(char(argOr(varargin, 4, '')), '[\x00-\x1F<>]', ''));
        if numel(note) > 120, note = note(1:120); end
        idx = find([S.experiments.number] == n, 1);
        if isempty(idx)
            error('ImageLab:invalidParameter', 'There is no experiment %d.', n);
        end
        S.experiments(idx).status = status;
        S.experiments(idx).due = due;
        S.experiments(idx).note = note;
        saveSettings(file, S);
        out = publicView(S);

    case 'assertRunnable'
        n = double(varargin{1});
        idx = find([S.experiments.number] == n, 1);
        if ~isempty(idx) && strcmp(S.experiments(idx).status, 'locked')
            error('ImageLab:experimentLocked', ...
                'Experiment %d is locked by your teacher. Ask your teacher to unlock it.', n);
        end
        out = true;

    case 'report'
        out = classReport(S);

    case 'export'
        out = exportReport(classReport(S), root);

    otherwise
        error('ImageLab:internal', 'Unknown classroom action "%s".', action);
end
end

% -------------------------------------------------------------------------
function S = loadSettings(file)
E = experimentCatalog();
S = struct('pinHash', '', 'salt', '', ...
    'experiments', struct('number', num2cell([E.number]), 'title', {E.title}, ...
        'status', 'open', 'due', '', 'note', ''));
if isfile(file)
    try
        s = load(file, 'S');
        if isfield(s.S, 'pinHash'), S.pinHash = s.S.pinHash; S.salt = s.S.salt; end
        for k = 1:numel(s.S.experiments)          % keep saved states, catalogue may grow
            idx = find([S.experiments.number] == s.S.experiments(k).number, 1);
            if ~isempty(idx)
                S.experiments(idx).status = s.S.experiments(k).status;
                S.experiments(idx).due = s.S.experiments(k).due;
                S.experiments(idx).note = s.S.experiments(k).note;
            end
        end
    catch
        % corrupted file: everything open, no PIN
    end
end
end

function saveSettings(file, S) %#ok<INUSD> - saved by variable name
if ~isfolder(fileparts(file)), mkdir(fileparts(file)); end
save(file, 'S');
end

function v = publicView(S)
v = struct('hasPin', ~isempty(S.pinHash), 'experiments', {num2cell(S.experiments)});
end

function tf = pinOk(S, pin)
tf = isempty(S.pinHash) || strcmp(hashPin(S.salt, pin), S.pinHash);
end

function h = hashPin(salt, pin)
bytes = uint8(unicode2native(['imagelab:' salt ':' pin], 'UTF-8'));
md = java.security.MessageDigest.getInstance('SHA-256');
d = typecast(md.digest(bytes), 'uint8');
h = lower(reshape(dec2hex(d, 2).', 1, []));
end

function s = randomSalt()
s = lower(reshape(dec2hex(randi([0 255], 1, 16), 2).', 1, []));
end

% -------------------------------------------------------------------------
function R = classReport(S)
profiles = profileManager('list');
cats = quizEngine('categories');
assigned = [S.experiments(strcmp({S.experiments.status}, 'assigned')).number];
nS = numel(profiles);
students = cell(1, nS);
answered = zeros(1, numel(cats));
correct = zeros(1, numel(cats));
struggling = zeros(1, numel(cats));
expDone = zeros(1, numel(S.experiments));
for k = 1:nS
    pr = profiles{k};
    p = progressManager('raw', profileManager('file', pr.id));
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
    last = '';
    if ~isempty(p.quizHistory), last = p.quizHistory(end).date; end
    students{k} = struct('id', pr.id, 'name', pr.name, 'roll', pr.roll, 'level', pr.level, 'xp', pr.xp, ...
        'badges', pr.badges, 'quizzes', pr.quizzes, 'accuracy', pr.accuracy, ...
        'questions', p.questionsAnswered, 'dailyStreak', pr.dailyStreak, ...
        'experimentsDone', {num2cell(sort(done))}, ...
        'assignedDone', nnz(ismember(assigned, done)), 'assignedTotal', numel(assigned), ...
        'topicAccuracy', {num2cell(acc)}, 'lastQuiz', last);
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
R = struct('students', {students}, 'categories', {cats}, 'topics', {num2cell(topics)}, ...
    'weakest', {num2cell(tried(order))}, 'experiments', {num2cell(experiments)}, ...
    'studentCount', nS, 'generated', char(datetime('now', 'Format', 'yyyy-MM-dd HH:mm')));
end

function f = exportReport(R, root)
outDir = fullfile(root, 'reports', 'output');
if ~isfolder(outDir), mkdir(outDir); end
base = ['ImageLab_class_report_' char(datetime('now', 'Format', 'yyyyMMdd_HHmmss'))];
n = numel(R.students);
st = [R.students{:}];
if n == 0, st = struct('name', {}, 'roll', {}, 'level', {}, 'xp', {}, 'badges', {}, 'quizzes', {}, ...
        'questions', {}, 'accuracy', {}, 'dailyStreak', {}, 'experimentsDone', {}, 'assignedDone', {}, ...
        'assignedTotal', {}, 'topicAccuracy', {}, 'lastQuiz', {}); end
T = table(string({st.name})', string({st.roll})', [st.level]', [st.xp]', [st.badges]', ...
    [st.quizzes]', [st.questions]', round([st.accuracy]', 1), [st.dailyStreak]', ...
    cellfun(@numel, {st.experimentsDone})', ...
    string(arrayfun(@(s) sprintf('%d/%d', s.assignedDone, s.assignedTotal), st, 'UniformOutput', false))', ...
    string({st.lastQuiz})', ...
    'VariableNames', {'Name', 'Roll', 'Level', 'XP', 'Badges', 'Quizzes', 'Questions', ...
                      'Accuracy (%)', 'Daily streak', 'Experiments done', 'Assigned done', 'Last quiz'});
for c = 1:numel(R.categories)
    v = nan(n, 1);
    for k = 1:n, v(k) = round(st(k).topicAccuracy{c}, 1); end
    T.([R.categories{c} ' (%)']) = v;
end
tp = [R.topics{:}];
TT = table(string({tp.category})', [tp.answered]', [tp.correct]', round([tp.accuracy]', 1), [tp.struggling]', ...
    'VariableNames', {'Topic', 'Answers', 'Correct', 'Class accuracy (%)', 'Students below 60%'});
TT = sortrows(TT, 'Class accuracy (%)', 'ascend', 'MissingPlacement', 'last');

writetable(T, fullfile(outDir, [base '.csv']));
xlsx = fullfile(outDir, [base '.xlsx']);
writetable(T, xlsx, 'Sheet', 'Students');
writetable(TT, xlsx, 'Sheet', 'Topics');
f = struct('csv', [base '.csv'], 'xlsx', [base '.xlsx']);
end

function v = argOr(args, k, default)
if numel(args) >= k && ~isempty(args{k}), v = args{k}; else, v = default; end
end
