function failures = smokeTestApi()
%SMOKETESTAPI Call every ilab_dispatch operation once and report problems.
%   failures = smokeTestApi() returns the number of failed operations.

root = fileparts(fileparts(mfilename('fullpath')));
addpath(root);
ilab_setup();
ilab_store('init', fullfile(root, 'runtime', 'images'));
failures = 0;

r = call('loadSample', struct('name', 'peppers.png'));
id = r.data.id;
g = call('loadSample', struct('name', 'shapes.png'));
gid = g.data.id;

call('ping', struct());
call('samples', struct());
call('imageInfo', struct('id', id));
call('grayscale', struct('id', id));
n = call('noise', struct('id', id, 'type', 'saltpepper', 'density', 0.05, 'seed', 1));
for t = {'gaussian', 'speckle', 'poisson'}
    call('noise', struct('id', id, 'type', t{1}));
end
for f = {'mean', 'weighted', 'gaussian', 'median', 'min', 'max', 'midpoint', 'order', 'alphatrimmed', 'laplacian', 'sobel', 'prewitt'}
    call('filter', struct('id', gid, 'name', f{1}, 'k', 3, 'impl', 'toolbox', 'refId', gid));
end
call('filter', struct('id', n.data.id, 'name', 'median', 'k', 3, 'impl', 'both', 'refId', id));
call('gaussianKernel', struct('k', 5, 'sigma', 1));
for m = {'none', 'histeq', 'histeqManual', 'clahe', 'stretch', 'gamma', 'log', 'negative'}
    call('histogram', struct('id', id, 'method', m{1}));
end
call('correlation', struct('matrix', [1 2 3; 4 5 6; 7 8 9], 'kernel', [1 0 -1; 1 0 -1; 1 0 -1], 'mode', 'correlation'));
call('correlation', struct('matrix', magic(5), 'kernel', [1 2 3; 4 5 6; 7 8 9], 'mode', 'convolution', 'shape', 'full'));
call('kernelPreset', struct('name', 'sobelx', 'size', 5));
call('applyKernel', struct('id', id, 'kernel', [0 -1 0; -1 5 -1; 0 -1 0]));
call('applyKernel', struct('id', id, 'kernel', [-1 0 1; -2 0 2; -1 0 1]));
call('saveKernel', struct('name', 'smoke test', 'kernel', ones(3) / 9));
call('listKernels', struct());
for s = {'laplacian', 'sobel', 'prewitt', 'unsharp', 'highboost'}
    call('sharpen', struct('id', id, 'method', s{1}));
end
call('edges', struct('id', gid, 'methods', {{'roberts', 'prewitt', 'sobel', 'canny', 'log'}}, 'manualGradients', true));
for s = {'global', 'iterative', 'otsu', 'adaptive', 'point', 'line', 'regiongrow', 'splitmerge', 'boundary'}
    call('segment', struct('id', gid, 'method', s{1}));
end
for c = {'rgb', 'hsv', 'ycbcr', 'lab', 'gray'}
    call('color', struct('id', id, 'space', c{1}));
end
call('colorEnhance', struct('id', id, 'space', 'hsv', 'channel', 2, 'operation', 'gain', 'amount', 1.4));
call('colorEnhance', struct('id', id, 'space', 'lab', 'channel', 1, 'operation', 'equalize'));
call('neighborhood', struct('matrix', [0 1 1; 0 1 0; 0 0 1], 'row', 2, 'col', 2, 'valueSet', 1));
call('sampling', struct('id', id));
call('quantize', struct('id', id));
call('compare', struct('id', id, 'noiseType', 'saltpepper', 'density', 0.05, 'seed', 3));
call('quizCategories', struct());
q = call('quizQuestions', struct('difficulty', 'easy', 'n', 10));
call('quizQuestions', struct('mode', 'kernel', 'n', 5));
res = struct('id', {'A', 'B'}, 'category', {'Noise', 'Histogram'}, 'difficulty', {'easy', 'hard'}, ...
    'correct', {true, false}, 'timeLeft', {6, 0});
call('quizSubmit', struct('results', res, 'name', 'Smoke Test', 'roll', '000'));
call('guessFilter', struct('id', id));
call('pipelineProblems', struct());
ps = call('pipelineStart', struct('id', id, 'problemId', 'spcontrast'));
call('pipelineRun', struct('problemId', 'spcontrast', 'cleanId', ps.data.cleanId, ...
    'degradedId', ps.data.degradedId, 'steps', {{'median', 'clahe'}}));
cs = call('challengeStart', struct('id', id, 'level', 'medium'));
steps = struct('block', {'median', 'gaussian'}, 'k', {3, 5});
call('challengeScore', struct('cleanId', cs.data.cleanId, 'degradedId', cs.data.degradedId, ...
    'steps', steps, 'timeUsed', 20, 'timeLimit', 60));
call('leaderboard', struct('action', 'get'));
call('progress', struct('action', 'topic', 'value', 'Smoke'));
call('experiments', struct());
for e = 1:13
    call('runExperiment', struct('number', e));
end
call('source', struct('name', 'medianFilterManual'));
call('report', struct('title', 'Smoke report', 'students', 'Test', 'aim', 'Check', ...
    'images', struct('label', {'Original'}, 'id', {id}), 'metrics', struct('name', {'PSNR'}, 'value', {30}), ...
    'kernel', ones(3) / 9, 'observations', {{'ok'}}));
% morphology, regions, error map, profiles, daily challenge, weak quiz
call('structuringElement', struct('shape', 'disk', 'size', 5));
for op = {'erode', 'dilate', 'open', 'close', 'boundary', 'fill'}
    call('morphology', struct('id', gid, 'operation', op{1}, 'se', ones(3)));
end
call('morphology', struct('id', id, 'operation', 'open', 'se', ones(3), 'mode', 'gray'));
call('regions', struct('id', gid, 'conn', 4));
call('errorMap', struct('id', n.data.id, 'refId', id));
for f = {'adaptivemedian', 'adaptivelocal'}
    call('filter', struct('id', n.data.id, 'name', f{1}, 'k', 7, 'refId', id));
end
call('quizQuestions', struct('mode', 'weak', 'n', 5));
call('profiles', struct('action', 'list'));
d = call('dailyStart', struct('date', '2026-01-01'));
call('pipelineRun', struct('problemId', d.data.problemId, 'cleanId', d.data.cleanId, ...
    'degradedId', d.data.degradedId, 'steps', {{'median'}}, 'daily', '2026-01-01'));

call('steps', struct('algorithm', 'median', 'matrix', magic(5)));
call('steps', struct('algorithm', 'histeq', 'matrix', [0 1 2; 3 2 1], 'levels', 4));
call('steps', struct('algorithm', 'morphology', 'matrix', eye(5), 'se', ones(3), 'operation', 'dilate'));
call('steps', struct('algorithm', 'regiongrow', 'matrix', magic(6), 'seedRow', 2, 'seedCol', 2, 'tolerance', 10));
call('classroom', struct('action', 'get'));
call('codeTasks', struct());
call('codeTaskStart', struct('taskId', 'meanfilter'));
call('runCode', struct('taskId', 'negative', 'code', 'out = 1 - img;', 'track', false));
call('runCode', struct('id', id, 'code', sprintf('J = rgb2gray(img);\nimshow(J)\nout = J;')));

% expected errors
expectError('morphology', struct('id', gid, 'se', zeros(3)));
expectError('dailyStart', struct('date', 'not-a-date'));
expectError('filter', struct('id', id, 'name', 'mean', 'k', 4));
expectError('imageInfo', struct('id', '../../etc'));
expectError('correlation', struct('matrix', magic(3), 'kernel', ones(2)));
expectError('runCode', struct('code', 'system(''dir'')'));
expectError('codeTaskSolution', struct('taskId', 'otsu'));

% clean test entries from the leaderboard/progress files
leaderboardManager('clear');
progressManager('reset');
fprintf('\nSmoke test finished: %d failure(s)\n', failures);

    function r = call(op, params)
        tic;
        r = jsondecode(ilab_dispatch(jsonencode(struct('op', op, 'params', params))));
        t = toc;
        if r.ok
            fprintf('  ok   %-18s %7.0f ms\n', op, 1000 * t);
        else
            failures = failures + 1;
            fprintf('  FAIL %-18s %s\n', op, r.error);
        end
    end

    function expectError(op, params)
        r = jsondecode(ilab_dispatch(jsonencode(struct('op', op, 'params', params))));
        if r.ok
            failures = failures + 1;
            fprintf('  FAIL %-18s expected an error\n', op);
        else
            fprintf('  ok   %-18s (expected error: %s)\n', op, r.error);
        end
    end
end
