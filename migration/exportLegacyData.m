function json = exportLegacyData(dataDir, leaderboardFile)
%EXPORTLEGACYDATA Convert the data files of ImageLab 1.x (.mat) to one JSON string.
%   json = exportLegacyData(dataDir, leaderboardFile)
%
%   Called once by the backend (backend/imagelab/storage/legacy.py), which
%   stores the result in data/imagelab.db. Only MATLAB can read .mat files
%   with MATLAB tables and nested structs reliably, which is why this step
%   is a MATLAB function. The .mat files are only read, never changed.

out = struct('profiles', {{}}, 'accounts', struct(), 'progress', struct(), 'submissions', struct(), ...
    'classroom', [], 'kernels', {{}}, 'leaderboard', {{}}, 'liveQuizSets', {{}}, 'liveQuizResults', {{}});

s = loadIf(fullfile(dataDir, 'profiles.mat'));
if isfield(s, 'profiles'), out.profiles = ilab_list(s.profiles); end
ids = cellfun(@(p) p.id, out.profiles, 'UniformOutput', false);
if ~any(strcmp(ids, 'default')), ids{end+1} = 'default'; end

s = loadIf(fullfile(dataDir, 'accounts.mat'));
if isfield(s, 'A'), out.accounts = s.A; end

for k = 1:numel(ids)                         % 'default' keeps the original file name
    if strcmp(ids{k}, 'default'), f = 'userProgress.mat'; else, f = ['progress_' ids{k} '.mat']; end
    s = loadIf(fullfile(dataDir, f));
    if isfield(s, 'p'), out.progress.(ids{k}) = s.p; end
    s = loadIf(fullfile(dataDir, 'codelab', [ids{k} '.mat']));
    if isfield(s, 'subs'), out.submissions.(ids{k}) = s.subs; end
end

s = loadIf(fullfile(dataDir, 'classroom.mat'));
if isfield(s, 'S')
    c = s.S;
    out.classroom = struct('pinHash', field(c, 'pinHash', ''), 'salt', field(c, 'salt', ''), ...
        'selfRegister', field(c, 'selfRegister', true), 'experiments', {ilab_list(field(c, 'experiments', []))}, ...
        'codeTasks', {ilab_list(field(c, 'codeTasks', []))});
end

s = loadIf(fullfile(dataDir, 'kernels.mat'));
if isfield(s, 'lib')                         % matrices keep their shape as {rows, cols, data}
    out.kernels = arrayfun(@(e) struct('name', e.name, 'kernel', ilab_mat(e.kernel)), s.lib(:)', 'UniformOutput', false);
end

s = loadIf(leaderboardFile);
if isfield(s, 'board') && istable(s.board) && height(s.board) > 0
    rows = table2struct(s.board);
    for k = 1:numel(rows)
        for f = {'Name', 'Roll', 'Mode', 'Date'}
            rows(k).(f{1}) = char(rows(k).(f{1}));
        end
    end
    out.leaderboard = ilab_list(rows);
end

for f = {'liveQuizSets', 'liveQuizResults'}
    s = loadIf(fullfile(dataDir, [f{1} '.mat']));
    if isfield(s, 'L') && iscell(s.L), out.(f{1}) = reshape(s.L, 1, []); end
end

json = jsonencode(out, 'ConvertInfAndNaN', true);
end

function s = loadIf(file)
s = struct();
if isfile(file)
    try
        s = load(file);
    catch
        warning('ImageLab:legacy', 'Could not read %s - skipped.', file);
    end
end
end

function v = field(s, name, default)
if isfield(s, name), v = s.(name); else, v = default; end
end
