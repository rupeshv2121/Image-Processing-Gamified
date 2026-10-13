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
%
%   Profiles are kept in data/profiles.mat. Each profile has its own
%   progress file (data/progress_<id>.mat); the 'default' profile keeps
%   using data/userProgress.mat so existing progress is not lost.
%   The UI sends the active profile id with every request (ilab_dispatch
%   calls profileManager('use', id) first).

persistent activeId
if isempty(activeId), activeId = 'default'; end

root = fileparts(fileparts(mfilename('fullpath')));
dataDir = fullfile(root, 'data');
listFile = fullfile(dataDir, 'profiles.mat');

switch action
    case 'use'
        id = char(varargin{1});
        profiles = loadProfiles(listFile);
        if ~validId(id) || ~any(strcmp({profiles.id}, id)), id = 'default'; end
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

    case 'add'
        profiles = loadProfiles(listFile);
        name = cleanName(varargin{1});
        roll = cleanRoll(argOr(varargin, 2, ''));
        if any(strcmpi({profiles.name}, name))
            error('ImageLab:invalidParameter', 'A student called "%s" already exists.', name);
        end
        if numel(profiles) >= 60
            error('ImageLab:invalidParameter', 'At most 60 student profiles are supported.');
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
        profiles(idx).name = name;
        profiles(idx).roll = cleanRoll(argOr(varargin, 3, ''));
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
        end
        if strcmp(activeId, id), activeId = 'default'; end
        out = withStats(profiles, dataDir);

    otherwise
        error('ImageLab:internal', 'Unknown profile action "%s".', action);
end
end

% -------------------------------------------------------------------------
function f = progressFile(dataDir, id)
if ~validId(id) || strcmp(id, 'default')
    f = fullfile(dataDir, 'userProgress.mat');
else
    f = fullfile(dataDir, ['progress_' id '.mat']);
end
end

function profiles = loadProfiles(file)
profiles = struct('id', {'default'}, 'name', {'Student 1'}, 'roll', {''}, 'created', {''});
if isfile(file)
    try
        s = load(file, 'profiles');
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
end

function list = withStats(profiles, dataDir)
list = cell(1, numel(profiles));
for k = 1:numel(profiles)
    s = progressManager('peek', progressFile(dataDir, profiles(k).id));
    list{k} = struct('id', profiles(k).id, 'name', profiles(k).name, 'roll', profiles(k).roll, ...
        'created', profiles(k).created, 'xp', s.xp, 'level', s.level, ...
        'badges', s.badgeCount, 'quizzes', s.quizzesTaken, 'accuracy', s.accuracy, ...
        'bestScore', s.bestScore, 'dailyStreak', s.dailyStreak);
end
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

function roll = cleanRoll(roll)
roll = strtrim(regexprep(char(roll), '[\x00-\x1F<>]', ''));
if numel(roll) > 20, roll = roll(1:20); end
end

function v = argOr(args, k, default)
if numel(args) >= k && ~isempty(args{k}), v = args{k}; else, v = default; end
end
