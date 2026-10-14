function out = submissionStore(action, profileId, taskId, code, grade, errorText)
%SUBMISSIONSTORE Students' Code Lab submissions, for the teacher.
%   submissionStore('record', profileId, taskId, code, grade, errorText)
%                                          store a graded run (grade = [] when
%                                          the code stopped with an error)
%   s = submissionStore('summary', profileId)        per task: attempts, passed,
%                                                    best / last match, times (no code)
%   e = submissionStore('get', profileId, taskId)    one task including the code
%   submissionStore('remove', profileId)             delete all of a student's code
%
%   One small file per student: data/codelab/<profileId>.mat holding the
%   struct "subs" with one field per task id. Only the latest code and the
%   latest PASSING code are kept, so the files stay small however often a
%   student runs. Files are read through dataCache.

persistent dir_
if isempty(dir_)
    dir_ = fullfile(fileparts(fileparts(mfilename('fullpath'))), 'data', 'codelab');
end
if nargin < 2 || isempty(regexp(char(profileId), '^[a-z0-9]{1,16}$', 'once'))
    error('ImageLab:invalidParameter', 'Invalid student id.');
end
file = [dir_ filesep char(profileId) '.mat'];

switch action
    case 'record'
        subs = loadSubs(file);
        taskId = char(taskId);
        if isfield(subs, taskId), e = subs.(taskId); else, e = emptyEntry(); end
        now_ = char(datetime('now', 'Format', 'yyyy-MM-dd HH:mm'));
        e.attempts = e.attempts + 1;
        e.lastRun = now_;
        e.lastCode = char(code);
        if isempty(grade)
            e.lastMatch = 0;
            e.lastError = char(errorText);
        else
            e.lastMatch = grade.match;
            e.lastError = '';
            e.bestMatch = max(e.bestMatch, grade.match);
            if grade.passed
                if ~e.passed, e.firstSolved = now_; e.attemptsToSolve = e.attempts; end
                e.passed = true;
                e.passedCode = char(code);
            end
        end
        subs.(taskId) = e;
        if ~isfolder(dir_), mkdir(dir_); end
        save(file, 'subs');
        dataCache('put', file, struct('subs', subs));
        out = summaryOf(subs);

    case 'summary'
        out = summaryOf(loadSubs(file));

    case 'get'
        subs = loadSubs(file);
        if isfield(subs, char(taskId)), out = subs.(char(taskId)); else, out = emptyEntry(); end

    case 'remove'
        if isfile(file), delete(file); end
        dataCache('forget', file);
        out = [];

    otherwise
        error('ImageLab:internal', 'Unknown submissionStore action "%s".', action);
end
end

function subs = loadSubs(file)
subs = struct();
s = dataCache('load', file);
if isstruct(s) && isfield(s, 'subs'), subs = s.subs; end
end

function e = emptyEntry()
e = struct('attempts', 0, 'passed', false, 'bestMatch', 0, 'lastMatch', 0, ...
    'lastRun', '', 'firstSolved', '', 'attemptsToSolve', 0, ...
    'lastCode', '', 'passedCode', '', 'lastError', '');
end

function s = summaryOf(subs)
% Everything except the code (small enough to send for a whole class)
s = struct();
f = fieldnames(subs);
for k = 1:numel(f)
    e = subs.(f{k});
    s.(f{k}) = rmfield(e, {'lastCode', 'passedCode'});
end
end
