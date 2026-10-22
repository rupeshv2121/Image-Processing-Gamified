function failures = smokeTestApi()
%SMOKETESTAPI Call every MATLAB operation of ilab_dispatch once and report problems.
%   failures = smokeTestApi() returns the number of failed operations.
%
%   Only the image work is tested here. Sign-in, progress, quizzes, the live
%   quiz and the classroom live in the backend and are tested end to end by
%   backend/tests/test_integration_matlab.py (which also runs these ops).

root = fileparts(fileparts(mfilename('fullpath')));
addpath(root);
ilab_setup();
ilab_store('init', fullfile(tempdir, 'ilab_smoke_images'));
failures = 0;

r = call('loadSample', struct('name', 'peppers.png'));
id = r.data.id;
g = call('loadSample', struct('name', 'shapes.png'));
gid = g.data.id;

call('ping', struct());
call('samples', struct());
call('imageInfo', struct('id', id));
call('grayscale', struct('id', id));
call('histogramOf', struct('id', id));
n = call('noise', struct('id', id, 'type', 'saltpepper', 'density', 0.05, 'seed', 1));
for t = {'gaussian'}
    call('noise', struct('id', id, 'type', t{1}));
end
for f = {'mean', 'weighted', 'gaussian', 'median', 'min', 'max', 'midpoint', 'order', 'alphatrimmed', 'laplacian', 'sobel', 'prewitt'}
    call('filter', struct('id', gid, 'name', f{1}, 'k', 3, 'impl', 'toolbox', 'refId', gid));
end
call('filter', struct('id', n.data.id, 'name', 'median', 'k', 3, 'impl', 'both', 'refId', id));
for f = {'adaptivemedian', 'adaptivelocal'}
    call('filter', struct('id', n.data.id, 'name', f{1}, 'k', 7, 'refId', id));
end
call('errorMap', struct('id', n.data.id, 'refId', id));
call('gaussianKernel', struct('k', 5, 'sigma', 1));
for m = {'none', 'histeq', 'histeqManual', 'stretch', 'gamma', 'log', 'negative'}
    call('histogram', struct('id', id, 'method', m{1}));
end
call('correlation', struct('matrix', [1 2 3; 4 5 6; 7 8 9], 'kernel', [1 0 -1; 1 0 -1; 1 0 -1], 'mode', 'correlation'));
call('correlation', struct('matrix', magic(5), 'kernel', [1 2 3; 4 5 6; 7 8 9], 'mode', 'convolution', 'shape', 'full'));
call('kernelPreset', struct('name', 'sobelx', 'size', 5));
call('kernelPresets', struct('names', {{'mean', 'sobelx'}}, 'size', 3));
call('applyKernel', struct('id', id, 'kernel', [0 -1 0; -1 5 -1; 0 -1 0]));
call('applyKernel', struct('id', id, 'kernel', [-1 0 1; -2 0 2; -1 0 1]));
for s = {'laplacian', 'sobel', 'prewitt', 'unsharp', 'highboost'}
    call('sharpen', struct('id', id, 'method', s{1}));
end
call('edges', struct('id', gid, 'methods', {{'roberts', 'prewitt', 'sobel', 'canny', 'log'}}, 'manualGradients', true));
for s = {'global', 'iterative', 'otsu', 'adaptive', 'point', 'line', 'regiongrow', 'splitmerge'}
    call('segment', struct('id', gid, 'method', s{1}));
end
call('regions', struct('id', gid));
for c = {'rgb', 'hsv', 'gray'}
    call('color', struct('id', id, 'space', c{1}));
end
call('colorEnhance', struct('id', id, 'space', 'hsv', 'channel', 2, 'operation', 'gain', 'amount', 1.4));
call('colorEnhance', struct('id', id, 'space', 'hsv', 'channel', 3, 'operation', 'equalize'));
call('neighborhood', struct('matrix', [0 1 1; 0 1 0; 0 0 1], 'row', 2, 'col', 2, 'valueSet', 1));
call('sampling', struct('id', id));
call('quantize', struct('id', id));
call('steps', struct('algorithm', 'median', 'matrix', magic(5)));
call('steps', struct('algorithm', 'histeq', 'matrix', [0 1 2; 3 2 1], 'levels', 4));
call('steps', struct('algorithm', 'regiongrow', 'matrix', magic(6), 'seedRow', 2, 'seedCol', 2, 'tolerance', 10));

% syllabus additions: perception, spectrum, noise models, mean filters,
% intensity transformations, LPI restoration, colour, edge linking, descriptors
for k = {'machbands', 'simultaneous', 'weber'}
    call('perception', struct('kind', k{1}));
end
call('spectrum', struct('wavelength', 520));
for t = {'rayleigh', 'erlang', 'exponential', 'uniform'}
    call('noise', struct('id', id, 'type', t{1}, 'seed', 2));
end
for f = {'geometric', 'harmonic', 'contraharmonic'}
    call('filter', struct('id', n.data.id, 'name', f{1}, 'k', 3, 'Q', -1.5, 'refId', id));
end
call('histogram', struct('id', id, 'method', 'match', 'shape', 'gaussian', 'targetMean', 0.4, 'targetStd', 0.1));
call('histogram', struct('id', gid, 'method', 'match', 'shape', 'sample', 'refSample', 'peppers.png'));
call('histogram', struct('id', id, 'method', 'piecewise', 'r1', 0.3, 's1', 0.1, 'r2', 0.7, 's2', 0.9));
call('histogram', struct('id', id, 'method', 'slice', 'a', 0.4, 'b', 0.6, 'sliceMode', 'preserve'));
call('bitPlanes', struct('id', id, 'keep', [7 8]));
dg = call('lpiDegrade', struct('id', id, 'psf', 'motion', 'length', 11, 'angle', 30, 'noiseVar', 0.0001, 'seed', 5));
for m = {'inverse', 'wiener', 'cls', 'lucy'}
    call('deconvolve', struct('id', dg.data.id, 'refId', dg.data.cleanId, 'psf', 'motion', ...
        'length', 11, 'angle', 30, 'method', m{1}, 'lambda', 0.01, 'iterations', 10));
end
for s = {'gaussian', 'disk', 'box'}
    call('lpiDegrade', struct('id', gid, 'psf', s{1}));
end
for c = {'hsi', 'cmy', 'cmyk'}
    call('color', struct('id', id, 'space', c{1}));
end
call('colorEnhance', struct('id', id, 'space', 'hsi', 'channel', 3, 'operation', 'equalize'));
call('colorEnhance', struct('id', id, 'space', 'cmy', 'channel', 1, 'operation', 'gain', 'amount', 0.8));
call('pseudocolor', struct('id', gid, 'method', 'slicing', 'slices', 6, 'map', 'hot'));
call('pseudocolor', struct('id', id, 'method', 'transform', 'frequency', 1.5, 'phases', [0 60 120]));
call('edgeLink', struct('id', gid, 'method', 'hough', 'peaks', 6));
call('edgeLink', struct('id', id, 'method', 'local', 'magnitude', 0.25, 'angle', 30, 'gap', 6));
call('describeRegion', struct('id', gid, 'region', 1));
expectError('describeRegion', struct('id', gid, 'region', 99));
expectError('deconvolve', struct('id', dg.data.id, 'refId', dg.data.cleanId, 'method', 'magic'));

% games
call('guessFilter', struct('id', id));
d = call('degrade', struct('id', id, 'steps', struct('op', {'contrast', 'saltpepper'}, 'value', {0.35, 0.05}), 'seed', 4));
call('degrade', struct('sample', 'peppers.png', 'maxSide', 400, 'steps', struct('op', 'blur', 'value', 1.5), 'seed', 20260101));
call('applyPipeline', struct('cleanId', d.data.cleanId, 'degradedId', d.data.degradedId, ...
    'steps', struct('block', {'median', 'histeq'}), 'intermediate', true));
call('applyPipeline', struct('cleanId', d.data.cleanId, 'degradedId', d.data.degradedId, ...
    'steps', {{struct('block', 'median', 'k', 3), struct('block', 'gaussian')}}));

% Code Lab and experiments
call('codeTaskList', struct());
call('codeTaskStart', struct('taskId', 'meanfilter'));
call('codeTaskSolution', struct('taskId', 'negative'));
call('runCode', struct('taskId', 'negative', 'code', 'out = 1 - img;'));
call('runCode', struct('id', id, 'code', sprintf('J = rgb2gray(img);\nimshow(J)\nout = J;')));
call('experimentCatalog', struct());
for e = 1:13
    call('runExperiment', struct('number', e));
end
call('report', struct('title', 'Smoke report', 'students', 'Test', 'aim', 'Check', ...
    'images', struct('label', {'Original'}, 'id', {id}), 'metrics', struct('name', {'PSNR'}, 'value', {30}), ...
    'kernel', ones(3) / 9, 'observations', {{'ok'}}));

% expected errors
% removed from the site (not in the syllabus)
for op = {'morphology', 'structuringElement', 'compare'}
    expectError(op{1}, struct('id', gid));
end
expectError('noise', struct('id', id, 'type', 'speckle'));
expectError('color', struct('id', id, 'space', 'lab'));
expectError('histogram', struct('id', id, 'method', 'clahe'));
expectError('segment', struct('id', gid, 'method', 'boundary'));
expectError('applyPipeline', struct('cleanId', d.data.cleanId, 'degradedId', d.data.degradedId, ...
    'steps', struct('block', 'clahe')));
expectError('steps', struct('algorithm', 'morphology', 'matrix', eye(5)));
expectError('filter', struct('id', id, 'name', 'mean', 'k', 4));
expectError('imageInfo', struct('id', '../../etc'));
expectError('correlation', struct('matrix', magic(3), 'kernel', ones(2)));
expectError('runCode', struct('code', 'system(''dir'')'));
expectError('auth', struct());                       % handled by the backend, not MATLAB

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
