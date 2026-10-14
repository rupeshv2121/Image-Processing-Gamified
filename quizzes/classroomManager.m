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
%   s = classroomManager('setCodeTask', id, status, due, note)   same for a Code Lab task
%   s = classroomManager('setSelfRegister', tf)       may students create their own account?
%   classroomManager('assertRunnable', n)            error if experiment n is locked
%   classroomManager('assertCodeRunnable', id)       error if Code Lab task id is locked
%   r = classroomManager('report')                   class overview (all student profiles)
%   o = classroomManager('overview')                 report + dashboard (KPIs, attention, feed)
%   m = classroomManager('submissions')              Code Lab matrix (students x tasks)
%   d = classroomManager('student', id)              one student in detail
%   c = classroomManager('submission', id, taskId)   one student's code for one task
%   f = classroomManager('export')                   writes CSV + XLSX to reports/output
%   (the class views are built by classAnalytics.m)
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
        [status, due, note] = assignment(varargin{2:end});
        idx = find([S.experiments.number] == n, 1);
        if isempty(idx)
            error('ImageLab:invalidParameter', 'There is no experiment %d.', n);
        end
        S.experiments(idx).status = status;
        S.experiments(idx).due = due;
        S.experiments(idx).note = note;
        saveSettings(file, S);
        out = publicView(S);

    case 'setCodeTask'
        id = char(varargin{1});
        [status, due, note] = assignment(varargin{2:end});
        idx = find(strcmp({S.codeTasks.id}, id), 1);
        if isempty(idx)
            error('ImageLab:invalidParameter', 'There is no Code Lab task "%s".', id);
        end
        S.codeTasks(idx).status = status;
        S.codeTasks(idx).due = due;
        S.codeTasks(idx).note = note;
        saveSettings(file, S);
        out = publicView(S);

    case 'setSelfRegister'
        S.selfRegister = logical(varargin{1});
        saveSettings(file, S);
        out = publicView(S);

    case 'assertCodeRunnable'
        idx = find(strcmp({S.codeTasks.id}, char(varargin{1})), 1);
        if ~isempty(idx) && strcmp(S.codeTasks(idx).status, 'locked')
            error('ImageLab:taskLocked', ...
                'The task "%s" is locked by your teacher. Ask your teacher to unlock it.', S.codeTasks(idx).title);
        end
        out = true;

    case 'assertRunnable'
        n = double(varargin{1});
        idx = find([S.experiments.number] == n, 1);
        if ~isempty(idx) && strcmp(S.experiments(idx).status, 'locked')
            error('ImageLab:experimentLocked', ...
                'Experiment %d is locked by your teacher. Ask your teacher to unlock it.', n);
        end
        out = true;

    case {'report', 'overview', 'submissions'}
        out = classAnalytics(action, S);

    case 'student'
        out = classAnalytics('student', S, varargin{1});

    case 'submission'
        out = classAnalytics('submission', S, varargin{1}, varargin{2});

    case 'export'
        out = exportReport(classAnalytics('report', S), root);

    otherwise
        error('ImageLab:internal', 'Unknown classroom action "%s".', action);
end
end

% -------------------------------------------------------------------------
function S = loadSettings(file)
E = experimentCatalog();
T = codeTasks('list');
S = struct('pinHash', '', 'salt', '', 'selfRegister', true, ...
    'experiments', struct('number', num2cell([E.number]), 'title', {E.title}, ...
        'status', 'open', 'due', '', 'note', ''), ...
    'codeTasks', struct('id', cellfun(@(t) t.id, T, 'UniformOutput', false), ...
        'title', cellfun(@(t) t.title, T, 'UniformOutput', false), ...
        'status', 'open', 'due', '', 'note', ''));
if isfile(file)
    try
        s = dataCache('load', file);
        if isfield(s.S, 'pinHash'), S.pinHash = s.S.pinHash; S.salt = s.S.salt; end
        if isfield(s.S, 'selfRegister'), S.selfRegister = s.S.selfRegister; end
        for k = 1:numel(s.S.experiments)          % keep saved states, catalogue may grow
            idx = find([S.experiments.number] == s.S.experiments(k).number, 1);
            if ~isempty(idx)
                S.experiments(idx).status = s.S.experiments(k).status;
                S.experiments(idx).due = s.S.experiments(k).due;
                S.experiments(idx).note = s.S.experiments(k).note;
            end
        end
        if isfield(s.S, 'codeTasks')               % keep saved Code Lab task states
            for k = 1:numel(s.S.codeTasks)
                idx = find(strcmp({S.codeTasks.id}, s.S.codeTasks(k).id), 1);
                if ~isempty(idx)
                    S.codeTasks(idx).status = s.S.codeTasks(k).status;
                    S.codeTasks(idx).due = s.S.codeTasks(k).due;
                    S.codeTasks(idx).note = s.S.codeTasks(k).note;
                end
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
dataCache('put', file, struct('S', S));
end

function [status, due, note] = assignment(status, due, note)
% Validate an open / assigned / locked state with optional due date and note
if nargin < 2, due = ''; end
if nargin < 3, note = ''; end
status = lower(char(status));
if ~any(strcmp(status, {'open', 'assigned', 'locked'}))
    error('ImageLab:invalidParameter', 'Status must be open, assigned or locked.');
end
due = char(due);
if ~isempty(due) && isempty(regexp(due, '^\d{4}-\d{2}-\d{2}$', 'once'))
    error('ImageLab:invalidParameter', 'The due date must look like 2026-10-31.');
end
note = strtrim(regexprep(char(note), '[\x00-\x1F<>]', ''));
if numel(note) > 120, note = note(1:120); end
end

function v = publicView(S)
v = struct('hasPin', ~isempty(S.pinHash), 'selfRegister', S.selfRegister, ...
    'experiments', {num2cell(S.experiments)}, ...
    'codeTasks', {num2cell(S.codeTasks)});
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

function f = exportReport(R, root)
outDir = fullfile(root, 'reports', 'output');
if ~isfolder(outDir), mkdir(outDir); end
base = ['ImageLab_class_report_' char(datetime('now', 'Format', 'yyyyMMdd_HHmmss'))];
n = numel(R.students);
st = [R.students{:}];
if n == 0, st = struct('name', {}, 'roll', {}, 'level', {}, 'xp', {}, 'badges', {}, 'quizzes', {}, ...
        'questions', {}, 'accuracy', {}, 'dailyStreak', {}, 'experimentsDone', {}, 'assignedDone', {}, ...
        'assignedTotal', {}, 'codeSolved', {}, 'codeAttempts', {}, 'topicAccuracy', {}, ...
        'lastQuiz', {}, 'lastActive', {}); end
T = table(string({st.name})', string({st.roll})', [st.level]', [st.xp]', [st.badges]', ...
    [st.quizzes]', [st.questions]', round([st.accuracy]', 1), [st.dailyStreak]', ...
    cellfun(@numel, {st.experimentsDone})', ...
    string(arrayfun(@(s) sprintf('%d/%d', s.assignedDone, s.assignedTotal), st, 'UniformOutput', false))', ...
    [st.codeSolved]', [st.codeAttempts]', string({st.lastQuiz})', string({st.lastActive})', ...
    'VariableNames', {'Name', 'Roll', 'Level', 'XP', 'Badges', 'Quizzes', 'Questions', ...
                      'Accuracy (%)', 'Daily streak', 'Experiments done', 'Assigned done', ...
                      'Code tasks solved', 'Code runs', 'Last quiz', 'Last active'});
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
ct = [R.codeTasks{:}];
TC = table(string({ct.title})', string({ct.level})', string({ct.status})', string({ct.due})', ...
    [ct.solvedBy]', [ct.triedBy]', ...
    'VariableNames', {'Code Lab task', 'Level', 'Status', 'Due', 'Solved by', 'Tried by'});
writetable(TC, xlsx, 'Sheet', 'Code Lab');
f = struct('csv', [base '.csv'], 'xlsx', [base '.xlsx']);
end
