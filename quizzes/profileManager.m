function out = profileManager(action, varargin)
%PROFILEMANAGER Student profiles, so several students can share one computer.
%
%   list = profileManager('list')               all profiles (with XP stats)
%   list = profileManager('add', name, roll)    create a profile
%   list = profileManager('update', id, name, roll)
%   list = profileManager('remove', id)         delete a profile and its progress
%   id   = profileManager('use', id)            make id the active profile
%   id   = profileManager('active')             the active profile id
%   file = profileManager('file')               progress file of the active profile
%   p    = profileManager('get', id)            one profile (id, name, roll, created)
%   r    = profileManager('roster')             all profiles WITHOUT stats (no progress reads)
%   row  = profileManager('row', profile, peek) one 'list' entry from a progress peek
%
%   Profiles are kept in data/profiles.mat. Each profile has its own
%   progress file (data/progress_<id>.mat); the 'default' profile keeps
%   using data/userProgress.mat so existing progress is not lost.
%   The UI sends the active profile id with every request (ilab_dispatch
%   calls profileManager('use', id) first). The reserved id 'teacher' is
%   used in teacher mode and 'guest' before anybody signed in: they belong to
%   no student and store no progress. Roll numbers are unique (students sign
%   in with them, see authManager).

persistent activeId
if isempty(activeId), activeId = 'default'; end

root = fileparts(fileparts(mfilename('fullpath')));
dataDir = fullfile(root, 'data');
listFile = fullfile(dataDir, 'profiles.mat');

switch action
    case 'use'
        id = char(varargin{1});
        if ~any(strcmp(id, {'teacher', 'guest'}))
            profiles = loadProfiles(listFile);
            if ~validId(id) || ~any(strcmp({profiles.id}, id)), id = 'default'; end
        end
        activeId = id;
        out = id;

    case 'active'
        out = activeId;

    case 'file'
        id = activeId;
        if numel(varargin) >= 1, id = char(varargin{1}); end
        out = progressFile(dataDir, id);

    case 'get'
        profiles = loadProfiles(listFile);
        idx = find(strcmp({profiles.id}, char(varargin{1})), 1);
        if isempty(idx), idx = 1; end
        out = profiles(idx);

    case 'list'
        out = withStats(loadProfiles(listFile), dataDir);

    case 'roster'
        out = loadProfiles(listFile);

    case 'row'
        out = statsRow(varargin{1}, varargin{2});

    case 'add'
        profiles = loadProfiles(listFile);
        name = cleanName(varargin{1});
        roll = cleanRoll(argOr(varargin, 2, ''));
        if any(strcmpi({profiles.name}, name))
            error('ImageLab:invalidParameter', 'A student called "%s" already exists.', name);
        end
        uniqueRoll(profiles, roll);
        if numel(profiles) >= 500
            error('ImageLab:invalidParameter', 'At most 500 student profiles are supported.');
        end
        [~, t] = fileparts(tempname);
        id = ['s' lower(t(end-9:end))];
        profiles(end+1) = struct('id', id, 'name', name, 'roll', roll, ...
            'created', char(datetime('now', 'Format', 'yyyy-MM-dd')));
        saveProfiles(listFile, profiles);
        out = withStats(profiles, dataDir);

    case 'update'
        profiles = loadProfiles(listFile);
        idx = find(strcmp({profiles.id}, char(varargin{1})), 1);
        if isempty(idx)
            error('ImageLab:invalidParameter', 'That student profile no longer exists.');
        end
        name = cleanName(varargin{2});
        others = profiles([1:idx-1 idx+1:end]);
        if any(strcmpi({others.name}, name))
            error('ImageLab:invalidParameter', 'A student called "%s" already exists.', name);
        end
        roll = cleanRoll(argOr(varargin, 3, ''));
        uniqueRoll(others, roll);
        profiles(idx).name = name;
        profiles(idx).roll = roll;
        saveProfiles(listFile, profiles);
        out = withStats(profiles, dataDir);

    case 'remove'
        id = char(varargin{1});
        if strcmp(id, 'default')
            error('ImageLab:invalidParameter', 'The first profile cannot be deleted (you can rename it).');
        end
        profiles = loadProfiles(listFile);
        idx = find(strcmp({profiles.id}, id), 1);
        if ~isempty(idx)
            profiles(idx) = [];
            saveProfiles(listFile, profiles);
            f = progressFile(dataDir, id);
            if isfile(f), delete(f); end
            dataCache('forget', f);
            submissionStore('remove', id);
            authManager('forget', id);
        end
        if strcmp(activeId, id), activeId = 'default'; end
        out = withStats(profiles, dataDir);

    otherwise
        error('ImageLab:internal', 'Unknown profile action "%s".', action);
end
end

% -------------------------------------------------------------------------
function f = progressFile(dataDir, id)
% plain concatenation: fullfile is slow when called for every student
if ~validId(id) || strcmp(id, 'default')
    f = [dataDir filesep 'userProgress.mat'];
else
    f = [dataDir filesep 'progress_' id '.mat'];
end
end

function profiles = loadProfiles(file)
profiles = struct('id', {'default'}, 'name', {'Student 1'}, 'roll', {''}, 'created', {''});
if isfile(file)
    try
        s = dataCache('load', file);
        if isfield(s, 'profiles') && isstruct(s.profiles) && ~isempty(s.profiles)
            profiles = s.profiles;
        end
    catch
        % corrupted file: fall back to the single default profile
    end
end
end

function saveProfiles(file, profiles) %#ok<INUSD> - saved by variable name
folder = fileparts(file);
if ~isfolder(folder), mkdir(folder); end
save(file, 'profiles');
dataCache('put', file, struct('profiles', profiles));
end

function list = withStats(profiles, dataDir)
list = cell(1, numel(profiles));
for k = 1:numel(profiles)
    list{k} = statsRow(profiles(k), progressManager('peek', progressFile(dataDir, profiles(k).id)));
end
end

function r = statsRow(pr, s)
r = struct('id', pr.id, 'name', pr.name, 'roll', pr.roll, ...
    'created', pr.created, 'xp', s.xp, 'level', s.level, ...
    'badges', s.badgeCount, 'quizzes', s.quizzesTaken, 'accuracy', s.accuracy, ...
    'bestScore', s.bestScore, 'dailyStreak', s.dailyStreak, ...
    'codeTasks', s.codeTasks, 'lastActive', s.lastActive);
end

function tf = validId(id)
tf = ischar(id) && ~isempty(regexp(id, '^[a-z0-9]{1,16}$', 'once'));
end

function name = cleanName(name)
name = strtrim(char(name));
name = regexprep(name, '[\x00-\x1F<>]', '');
if isempty(name)
    error('ImageLab:invalidParameter', 'Please enter the student''s name.');
end
if numel(name) > 40, name = name(1:40); end
end

function uniqueRoll(profiles, roll)
if ~isempty(roll) && any(strcmpi({profiles.roll}, roll))
    error('ImageLab:invalidParameter', 'Roll number "%s" is already taken.', roll);
end
end

function roll = cleanRoll(roll)
roll = strtrim(regexprep(char(roll), '[\x00-\x1F<>]', ''));
if numel(roll) > 20, roll = roll(1:20); end
end

function v = argOr(args, k, default)
if numel(args) >= k && ~isempty(args{k}), v = args{k}; else, v = default; end
end
