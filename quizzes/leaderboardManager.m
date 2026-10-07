function out = leaderboardManager(action, entry)
%LEADERBOARDMANAGER Local leaderboard stored in quizzes/leaderboard.mat.
%   board = leaderboardManager('get')            sorted table as struct array
%   board = leaderboardManager('add', entry)     entry: name, roll, score,
%                                                accuracy, bestStreak, mode
%   leaderboardManager('clear')
%
%   The data is a MATLAB table saved in a MAT file - no internet needed.

file = fullfile(fileparts(mfilename('fullpath')), 'leaderboard.mat');
board = loadBoard(file);

switch action
    case 'get'
        % nothing to change
    case 'add'
        name = strtrim(char(entry.name));
        if isempty(name)
            error('ImageLab:invalidParameter', 'Please enter your name for the leaderboard.');
        end
        row = table(string(name), string(strtrim(char(getf(entry, 'roll', '')))), ...
            double(getf(entry, 'score', 0)), double(getf(entry, 'accuracy', 0)), ...
            double(getf(entry, 'bestStreak', 0)), string(getf(entry, 'mode', 'Rapid Fire')), ...
            string(datetime('now', 'Format', 'yyyy-MM-dd HH:mm')), ...
            'VariableNames', board.Properties.VariableNames);
        board = [board; row];
        save(file, 'board');
    case 'clear'
        board = board([], :);
        save(file, 'board');
    otherwise
        error('ImageLab:internal', 'Unknown leaderboard action "%s".', action);
end

board = sortrows(board, {'Score', 'Accuracy'}, {'descend', 'descend'});
out = table2struct(board);
for k = 1:numel(out)
    out(k).Rank = k;
    out(k).Name = char(out(k).Name);
    out(k).Roll = char(out(k).Roll);
    out(k).Mode = char(out(k).Mode);
    out(k).Date = char(out(k).Date);
end
end

function board = loadBoard(file)
empty = table(strings(0,1), strings(0,1), zeros(0,1), zeros(0,1), zeros(0,1), ...
    strings(0,1), strings(0,1), 'VariableNames', ...
    {'Name', 'Roll', 'Score', 'Accuracy', 'BestStreak', 'Mode', 'Date'});
board = empty;
if isfile(file)
    try
        s = load(file, 'board');
        if isfield(s, 'board') && istable(s.board)
            board = s.board;
        end
    catch
        board = empty;          % corrupted file -> start a fresh leaderboard
    end
end
end

function v = getf(s, name, default)
if isfield(s, name) && ~isempty(s.(name)), v = s.(name); else, v = default; end
end
