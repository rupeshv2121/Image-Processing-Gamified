function out = quizEngine(action, varargin)
%QUIZENGINE Question selection and scoring for the Rapid Fire Quiz.
%
%   qs  = quizEngine('select', difficulty, categories, n)
%         difficulty : 'easy' | 'medium' | 'hard' | 'mixed'
%         categories : cell array of category names, or 'all'
%         n          : number of questions (default 10)
%         Options are shuffled (answer index updated); true/false keep order.
%
%   qs  = quizEngine('kernel', n)       generated "identify the kernel" questions
%   res = quizEngine('score', results)  results: struct array with fields
%         correct (logical), timeLeft (s), difficulty, category
%   c   = quizEngine('categories')      list of categories

switch action
    case 'categories'
        out = {'Fundamentals', 'Histogram', 'Spatial Filters', 'Linear Filters', ...
               'Non-Linear Filters', 'Noise', 'Correlation', 'Convolution', ...
               'Sharpening', 'Edge Detection', 'Segmentation', 'Color Processing'};

    case 'select'
        difficulty = argOr(varargin, 1, 'mixed');
        categories = argOr(varargin, 2, 'all');
        n = argOr(varargin, 3, 10);
        out = selectQuestions(difficulty, categories, n);

    case 'kernel'
        out = kernelQuestions(argOr(varargin, 1, 10));

    case 'score'
        out = scoreQuiz(varargin{1});

    otherwise
        error('ImageLab:invalidQuizState', 'Unknown quiz action "%s".', action);
end
end

% -------------------------------------------------------------------------
function qs = selectQuestions(difficulty, categories, n)
Q = questionBank();
if ischar(categories) || isstring(categories)
    if strcmpi(categories, 'all'), categories = {Q.category}; else, categories = {char(categories)}; end
end
inCat = ismember({Q.category}, categories);
if ~any(inCat)
    error('ImageLab:invalidQuizState', 'No questions found for the selected categories.');
end
if strcmpi(difficulty, 'mixed')
    pool = find(inCat);
    extra = [];
else
    pool = find(inCat & strcmpi({Q.difficulty}, difficulty));
    extra = find(inCat & ~strcmpi({Q.difficulty}, difficulty));   % top-up if needed
end
pool = pool(randperm(numel(pool)));
extra = extra(randperm(numel(extra)));
chosen = [pool extra];
chosen = chosen(1:min(n, numel(chosen)));
qs = Q(chosen);
for k = 1:numel(qs)
    qs(k) = shuffleOptions(qs(k));
end
end

function q = shuffleOptions(q)
if strcmp(q.type, 'truefalse'), return; end
order = randperm(numel(q.options));
q.options = q.options(order);
q.answer = find(order == q.answer);
end

% -------------------------------------------------------------------------
function qs = kernelQuestions(n)
names = {'mean', 'weighted', 'sobelx', 'sobely', 'prewittx', 'prewitty', ...
         'laplacian', 'laplacian8', 'sharpen', 'pointdetect', 'identity', 'emboss'};
labels = {'Mean (box)', 'Weighted mean', 'Sobel X', 'Sobel Y', 'Prewitt X', 'Prewitt Y', ...
          'Laplacian (4-neighbour)', 'Laplacian (8-neighbour)', 'Sharpening', ...
          'Point detection', 'Identity', 'Emboss'};
picks = randi(numel(names), 1, n);
Q = questionBank();
qs = Q([]);
for k = 1:n
    idx = picks(k);
    [K, description] = kernelPresets(names{idx}, 3);
    others = setdiff(1:numel(names), idx);
    others = others(randperm(numel(others), 3));
    optionIdx = [idx others];
    order = randperm(4);
    optionIdx = optionIdx(order);
    qs(end+1) = struct('id', sprintf('KER%d', k), 'category', 'Linear Filters', ...
        'difficulty', 'medium', 'type', 'kernel', 'question', 'Identify this kernel:', ...
        'options', {labels(optionIdx)}, 'answer', find(optionIdx == idx), ...
        'explanation', description, 'kernel', K); %#ok<AGROW>
end
end

% -------------------------------------------------------------------------
function res = scoreQuiz(results)
%   score per correct answer = 100 x difficulty multiplier
%                            + 5 points per second left on the timer
%                            + 10 x current streak (streak bonus)
if isempty(results)
    res = struct('score', 0, 'correct', 0, 'total', 0, 'accuracy', 0, 'bestStreak', 0);
    return
end
multiplier = containers.Map({'easy', 'medium', 'hard'}, {1, 1.5, 2});
score = 0; streak = 0; best = 0;
for k = 1:numel(results)
    r = results(k);
    if r.correct
        streak = streak + 1;
        best = max(best, streak);
        m = 1;
        if isKey(multiplier, r.difficulty), m = multiplier(r.difficulty); end
        score = score + round(100 * m + 5 * max(r.timeLeft, 0) + 10 * (streak - 1));
    else
        streak = 0;
    end
end
correct = nnz([results.correct]);
res = struct('score', score, 'correct', correct, 'total', numel(results), ...
    'accuracy', 100 * correct / numel(results), 'bestStreak', best);
end

function v = argOr(args, k, default)
if numel(args) >= k && ~isempty(args{k}), v = args{k}; else, v = default; end
end
