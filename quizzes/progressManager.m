function out = progressManager(action, varargin)
%PROGRESSMANAGER Learning progress, XP and badges (data/userProgress.mat).
%
%   p = progressManager('get')
%   p = progressManager('activity', area, item)   e.g. ('filters','median')
%   p = progressManager('topic', topicName)        mark a Learn topic complete
%   p = progressManager('experiment', number)      mark an experiment complete
%   p = progressManager('quiz', summary, results)  record a finished quiz
%   p = progressManager('reset')
%
%   XP:  +10 for each new thing tried, +20 per topic, +50 per experiment,
%        quiz score / 10.  Level = floor(sqrt(XP/100)) + 1.

root = fileparts(fileparts(mfilename('fullpath')));
dataDir = fullfile(root, 'data');
if ~isfolder(dataDir), mkdir(dataDir); end
file = fullfile(dataDir, 'userProgress.mat');
p = loadProgress(file);
newBadges = {};

switch action
    case 'get'
    case 'activity'
        area = matlab.lang.makeValidName(char(varargin{1}));
        item = char(varargin{2});
        if ~isfield(p.activities, area), p.activities.(area) = {}; end
        if ~ismember(item, p.activities.(area))
            p.activities.(area){end+1} = item;
            p.xp = p.xp + 10;
        end
    case 'topic'
        topic = char(varargin{1});
        if ~ismember(topic, p.topicsCompleted)
            p.topicsCompleted{end+1} = topic;
            p.xp = p.xp + 20;
        end
    case 'experiment'
        n = double(varargin{1});
        if ~ismember(n, p.experimentsCompleted)
            p.experimentsCompleted(end+1) = n;
            p.xp = p.xp + 50;
        end
    case 'quiz'
        summary = varargin{1};
        results = varargin{2};
        p.quizzesTaken = p.quizzesTaken + 1;
        p.questionsAnswered = p.questionsAnswered + summary.total;
        p.questionsCorrect = p.questionsCorrect + summary.correct;
        p.bestStreak = max(p.bestStreak, summary.bestStreak);
        p.xp = p.xp + round(summary.score / 10);
        if summary.total >= 10 && summary.correct == summary.total
            p.perfectQuizzes = p.perfectQuizzes + 1;
        end
        for k = 1:numel(results)
            c = char(results(k).category);
            idx = find(strcmp({p.categoryStats.name}, c), 1);
            if isempty(idx)
                p.categoryStats(end+1) = struct('name', c, 'answered', 0, 'correct', 0);
                idx = numel(p.categoryStats);
            end
            p.categoryStats(idx).answered = p.categoryStats(idx).answered + 1;
            p.categoryStats(idx).correct = p.categoryStats(idx).correct + logical(results(k).correct);
        end
        p.quizHistory(end+1) = struct('date', char(datetime('now', 'Format', 'yyyy-MM-dd HH:mm')), ...
            'score', summary.score, 'accuracy', summary.accuracy, 'mode', char(getf(summary, 'mode', 'Rapid Fire')));
    case 'reset'
        p = defaultProgress();
    otherwise
        error('ImageLab:internal', 'Unknown progress action "%s".', action);
end

[p, newBadges] = awardBadges(p);
save(file, 'p');
out = summarise(p, newBadges);
end

% -------------------------------------------------------------------------
function p = defaultProgress()
p = struct();
p.xp = 0;
p.quizzesTaken = 0;
p.questionsAnswered = 0;
p.questionsCorrect = 0;
p.bestStreak = 0;
p.perfectQuizzes = 0;
p.categoryStats = struct('name', {}, 'answered', {}, 'correct', {});
p.activities = struct();
p.topicsCompleted = {};
p.experimentsCompleted = zeros(1, 0);
p.badges = struct('id', {}, 'earned', {});
p.quizHistory = struct('date', {}, 'score', {}, 'accuracy', {}, 'mode', {});
end

function p = loadProgress(file)
p = defaultProgress();
if ~isfile(file), return; end
try
    s = load(file, 'p');
    fields = fieldnames(s.p);
    for k = 1:numel(fields)
        p.(fields{k}) = s.p.(fields{k});      % keep defaults for new fields
    end
catch
    p = defaultProgress();                     % corrupted file -> start again
end
end

function defs = badgeDefinitions()
defs = struct( ...
    'id',   {'filter_master', 'noise_fighter', 'histogram_hero', 'convolution_expert', ...
             'edge_detective', 'segmentation_pro', 'colour_artist', 'perfect_quiz', ...
             'streak_master', 'experimenter', 'scholar', 'quiz_regular'}, ...
    'name', {'Filter Master', 'Noise Fighter', 'Histogram Hero', 'Convolution Expert', ...
             'Edge Detective', 'Segmentation Pro', 'Colour Artist', 'Perfect Quiz', ...
             'Streak Master', 'Experimenter', 'Scholar', 'Quiz Regular'}, ...
    'description', {'Test 6 different spatial filters', ...
                    'Try 3 noise models and run a filter comparison', ...
                    'Use 4 histogram processing methods', ...
                    'Step through correlation AND convolution and use the kernel playground', ...
                    'Compare 4 edge detectors', ...
                    'Use 4 segmentation methods', ...
                    'Explore 3 colour models', ...
                    'Answer 10/10 in a quiz', ...
                    'Reach a streak of 5 correct answers', ...
                    'Complete 5 experiments', ...
                    'Complete 8 Learn topics', ...
                    'Finish 5 quizzes'});
end

function [p, newBadges] = awardBadges(p)
a = p.activities;
count = @(f) numel(getf(a, f, {}));
has = @(f, item) ismember(item, getf(a, f, {}));
earned = [ ...
    count('filters') >= 6, ...
    count('noise') >= 3 && has('tools', 'compare'), ...
    count('histogram') >= 4, ...
    has('tools', 'correlation') && has('tools', 'convolution') && has('tools', 'kernelPlayground'), ...
    count('edges') >= 4, ...
    count('segmentation') >= 4, ...
    count('color') >= 3, ...
    p.perfectQuizzes >= 1, ...
    p.bestStreak >= 5, ...
    numel(p.experimentsCompleted) >= 5, ...
    numel(p.topicsCompleted) >= 8, ...
    p.quizzesTaken >= 5];
defs = badgeDefinitions();
have = {p.badges.id};
newBadges = {};
for k = find(earned)
    if ~ismember(defs(k).id, have)
        p.badges(end+1) = struct('id', defs(k).id, 'earned', char(datetime('now', 'Format', 'yyyy-MM-dd')));
        p.xp = p.xp + 100;
        newBadges{end+1} = defs(k).name; %#ok<AGROW>
    end
end
end

function s = summarise(p, newBadges)
defs = badgeDefinitions();
have = {p.badges.id};
badges = struct('id', {defs.id}, 'name', {defs.name}, 'description', {defs.description}, ...
    'earned', num2cell(ismember({defs.id}, have)));

cats = p.categoryStats;
weak = {}; strong = {};
for k = 1:numel(cats)
    if cats(k).answered >= 2
        acc = cats(k).correct / cats(k).answered;
        if acc < 0.6, weak{end+1} = cats(k).name; end %#ok<AGROW>
        if acc >= 0.8, strong{end+1} = cats(k).name; end %#ok<AGROW>
    end
end

act = p.activities;
fields = fieldnames(act);
filtersTested = 0;
for k = 1:numel(fields)
    if any(strcmp(fields{k}, {'filters', 'edges', 'histogram', 'sharpening'}))
        filtersTested = filtersTested + numel(act.(fields{k}));
    end
end

s = struct( ...
    'xp', p.xp, ...
    'level', floor(sqrt(p.xp / 100)) + 1, ...
    'quizzesTaken', p.quizzesTaken, ...
    'questionsAnswered', p.questionsAnswered, ...
    'questionsCorrect', p.questionsCorrect, ...
    'accuracy', 100 * p.questionsCorrect / max(p.questionsAnswered, 1), ...
    'bestStreak', p.bestStreak, ...
    'bestScore', max([p.quizHistory.score, 0]), ...
    'filtersTested', filtersTested, ...
    'topicsCompleted', {p.topicsCompleted}, ...
    'experimentsCompleted', {num2cell(p.experimentsCompleted)}, ...
    'activities', act, ...
    'categoryStats', {num2cell(cats)}, ...
    'weakTopics', {weak}, ...
    'strongTopics', {strong}, ...
    'badges', {num2cell(badges)}, ...
    'newBadges', {newBadges}, ...
    'quizHistory', {num2cell(p.quizHistory)});
end

function v = getf(s, name, default)
if isstruct(s) && isfield(s, name) && ~isempty(s.(name)), v = s.(name); else, v = default; end
end
