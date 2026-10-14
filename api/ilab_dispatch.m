function response = ilab_dispatch(requestJson)
%ILAB_DISPATCH Single entry point between the ImageLab user interface and MATLAB.
%   response = ilab_dispatch(requestJson)
%
%   The request is a JSON string {"op": "...", "params": {...}}. The
%   response is a JSON string {"ok": true, "data": ...} or
%   {"ok": false, "error": "..."}. ALL image processing happens in the MATLAB
%   functions called from here - the UI only displays the results.
%
%   Images are passed by id (see ilab_store). Example:
%       ilab_dispatch('{"op":"loadSample","params":{"name":"peppers.png"}}')

t0 = tic;
op = '';
try
    req = jsondecode(char(requestJson));
    op = char(req.op);
    p = struct();
    if isfield(req, 'params') && isstruct(req.params), p = req.params; end
    % "track": false = preview request (e.g. landing-page demo) - no XP/progress
    trackingEnabled(~(isfield(p, 'track') && isequal(p.track, false)));
    % Progress, XP and badges belong to the student profile chosen in the UI
    profileManager('use', char(P(p, 'profileId', 'default')));
    [data, cached] = cachedRoute(op, p);
    response = jsonencode(struct('ok', true, 'op', op, 'data', {data}, ...
        'elapsedMs', 1000 * toc(t0), 'cached', cached), 'ConvertInfAndNaN', true);
catch err
    response = jsonencode(struct('ok', false, 'op', op, ...
        'error', friendlyMessage(err), 'errorId', err.identifier));
end
end

% =========================================================================
% Result cache: the same deterministic operation on the same image with the
% same parameters returns the stored result instantly (image ids never change
% their content). Entries whose output images were deleted are recomputed.
function [data, hit] = cachedRoute(op, p)
CACHEABLE = {'filter', 'histogram', 'sharpen', 'edges', 'segment', 'morphology', ...
             'regions', 'errorMap', 'applyKernel', 'color', 'colorEnhance', 'histogramOf'};
hit = false;
if ~any(strcmp(op, CACHEABLE)) || isequal(P(p, 'noCache', false), true)
    data = route(op, p);
    return
end
q = rmfield(p, intersect(fieldnames(p), {'profileId', 'track', 'noCache'}));
key = [op '|' jsonencode(q)];
[found, data] = resultCache('get', key);
if found && imagesExist(data)
    hit = true;
    replayActivity(op, p, data);        % XP / missions still count for this student
    return
end
data = route(op, p);
resultCache('put', key, data);
end

function varargout = resultCache(action, key, value)
% Least-recently-used cache with at most 300 entries (kept in MATLAB memory)
persistent store order
if isempty(store), store = containers.Map('KeyType', 'char', 'ValueType', 'any'); order = {}; end
switch action
    case 'get'
        if isKey(store, key)
            varargout = {true, store(key)};
            order = [order(~strcmp(order, key)), {key}];
        else
            varargout = {false, []};
        end
    case 'put'
        store(key) = value;
        order = [order(~strcmp(order, key)), {key}];
        while numel(order) > 300
            remove(store, order{1});
            order(1) = [];
        end
    case 'clear'
        store = containers.Map('KeyType', 'char', 'ValueType', 'any'); order = {};
end
end

function ok = imagesExist(data)
% True if every image id inside a result (fields id / ...Id) still exists
ok = true;
if iscell(data)
    for k = 1:numel(data), ok = ok && imagesExist(data{k}); end
elseif isstruct(data)
    for k = 1:numel(data)
        f = fieldnames(data(k));
        for j = 1:numel(f)
            v = data(k).(f{j});
            if (strcmp(f{j}, 'id') || endsWith(f{j}, 'Id')) && ischar(v) && ~isempty(v)
                ok = ok && ~isempty(regexp(v, '^[A-Za-z0-9_\-]+$', 'once')) && isfile(ilab_store('path', v));
            elseif isstruct(v) || iscell(v)
                ok = ok && imagesExist(v);
            end
            if ~ok, return; end
        end
    end
end
end

function replayActivity(op, p, data)
switch op
    case 'filter',       activity('filters', char(P(p, 'name', 'mean')));
    case 'histogram'
        m = char(P(p, 'method', 'histeq'));
        if ~strcmp(m, 'none'), activity('histogram', m); end
    case 'sharpen',      activity('sharpening', char(P(p, 'method', 'laplacian')));
    case 'edges'
        ms = cellstr(P(p, 'methods', {'sobel'}));
        for k = 1:numel(ms), activity('edges', ms{k}); end
    case 'segment',      activity('segmentation', char(P(p, 'method', 'otsu')));
    case 'morphology',   activity('morphology', char(P(p, 'operation', 'erode')));
    case 'regions',      activity('regions', sprintf('conn%d', data.conn));
    case 'applyKernel',  activity('tools', 'kernelPlayground');
    case 'color',        activity('color', char(P(p, 'space', 'rgb')));
    case 'colorEnhance', activity('color', 'enhance');
end
end

% =========================================================================
function data = route(op, p)
switch op
    % ------------------------------------------------------------ system
    case 'ping'
        data = struct('version', version, 'release', version('-release'), ...
            'ipt', hasIPT(), 'iptLicensed', license('test', 'image_toolbox') == 1, ...
            'root', fileparts(fileparts(mfilename('fullpath'))));

    case 'source'
        data = sourceCode(char(P(p, 'name', '')));

    % ------------------------------------------------------------ images
    case 'samples'
        generateSampleImages(false);
        data = lst(sampleImages('list'));

    case 'loadSample'
        name = char(P(p, 'name', 'peppers.png'));
        generateSampleImages(false);
        data = importImage(sampleImages('path', name), name);

    case 'importImage'
        data = importImage(char(P(p, 'path', '')), char(P(p, 'name', 'upload')));

    case 'imageInfo'
        data = describe(img(p.id));

    case 'grayscale'
        G = toGray(img(p.id));
        data = struct('id', put(G, 'gray'), 'info', describe(G));

    case 'histogramOf'
        data = struct('counts', imhistManual(img(p.id)), 'stats', imageStatistics(img(p.id)));

    case 'errorMap'
        [H, ~, stats] = errorMap(img(p.id), img(p.refId));
        data = stats;
        data.id = put(H, 'error');

    % ------------------------------------------------------------ noise
    case 'noise'
        seed(p);
        I = img(p.id);
        type = char(P(p, 'type', 'gaussian'));
        N = addNoise(I, type, p);
        q = imageQuality(N, I);
        data = struct('id', put(N, 'noisy'), ...
            'diffId', put(min(abs(N - I) * 3, 1), 'diff'), ...
            'mse', q.mse, 'psnr', q.psnr, 'ssim', q.ssim, ...
            'noisyStats', imageStatistics(N));
        activity('noise', type);

    % ------------------------------------------------------- spatial filters
    case 'filter'
        I = img(p.id);
        name = char(P(p, 'name', 'mean'));
        k = P(p, 'k', 3);
        impl = char(P(p, 'impl', 'toolbox'));
        if strcmp(impl, 'both'), impls = {'toolbox', 'manual'}; else, impls = {impl}; end
        ref = [];
        if isfield(p, 'refId') && ~isempty(p.refId), ref = img(p.refId); end
        runs = {};
        outputs = {};
        for n = 1:numel(impls)
            tic;
            [J, info] = ilab_runFilter(I, name, k, p, impls{n});
            t = 1000 * toc;
            if info.signed, shown = scaleToUnit(J); else, shown = J; end
            r = struct('impl', impls{n}, 'id', put(shown, name), 'timeMs', t, ...
                'implementation', info.implementation, 'functionName', info.functionName, ...
                'mse', [], 'psnr', [], 'ssim', []);
            if ~isempty(ref) && isequal(size(J), size(ref))
                q = imageQuality(J, ref);
                r.mse = q.mse; r.psnr = q.psnr; r.ssim = q.ssim;
            end
            runs{end+1} = r; %#ok<AGROW>
            outputs{end+1} = J; %#ok<AGROW>
        end
        data = struct('runs', {runs}, 'linear', info.linear, 'kernel', matOrEmpty(info.kernel), 'maxDifference', []);
        if numel(outputs) == 2
            data.maxDifference = max(abs(outputs{1}(:) - outputs{2}(:)));
        end
        activity('filters', name);

    case 'gaussianKernel'
        k = P(p, 'k', 5); sigma = P(p, 'sigma', 1);
        G = gaussianKernel(k, sigma);
        diffToolbox = [];
        if hasIPT(), diffToolbox = max(max(abs(G - fspecial('gaussian', k, sigma)))); end
        data = struct('kernel', ilab_mat(G), 'sum', sum(G(:)), 'diffToolbox', diffToolbox);

    % ------------------------------------------------------------ histogram
    case 'histogram'
        I = img(p.id);
        method = char(P(p, 'method', 'histeq'));
        [J, mapping, implementation] = histogramMethod(I, method, p);
        data = struct('id', put(J, method), ...
            'histBefore', imhistManual(I), 'histAfter', imhistManual(J), ...
            'statsBefore', imageStatistics(I), 'statsAfter', imageStatistics(J), ...
            'mapping', {mapping}, 'implementation', implementation);
        if ~strcmp(method, 'none'), activity('histogram', method); end

    % ------------------------------------------------ correlation/convolution
    case 'correlation'
        A = double(P(p, 'matrix', magic(3)));
        K = validateKernel(double(P(p, 'kernel', ones(3))));
        if numel(A) > 144
            error('ImageLab:invalidMatrix', 'Use an input matrix of at most 12x12 for the step-by-step view.');
        end
        mode = char(P(p, 'mode', 'correlation'));
        shape = char(P(p, 'shape', 'same'));
        padMode = char(P(p, 'padMode', 'zero'));
        if strcmp(mode, 'convolution')
            [out, steps, used] = manualConvolution(A, K, shape, padMode);
        else
            [out, steps] = manualCorrelation(A, K, shape, padMode);
            used = K;
        end
        corrOut = manualCorrelation(A, K, shape, padMode);
        convOut = manualConvolution(A, K, shape, padMode);
        builtinCorr = filter2(K, A, shape);
        builtinConv = conv2(A, K, shape);
        stepList = arrayfun(@(s) struct('row', s.row, 'col', s.col, 'window', ilab_mat(s.window), ...
            'products', ilab_mat(s.products), 'sum', s.sum), steps(:)', 'UniformOutput', false);
        switch shape
            case 'same',  pad = floor(size(K) / 2);
            case 'full',  pad = size(K) - 1;
            otherwise,    pad = [0 0];
        end
        data = struct('steps', {stepList}, 'output', ilab_mat(out), ...
            'kernel', ilab_mat(K), 'kernelUsed', ilab_mat(used), ...
            'padded', ilab_mat(padImage(A, pad(1), pad(2), padMode)), 'pad', pad, ...
            'correlation', ilab_mat(corrOut), 'convolution', ilab_mat(convOut), ...
            'builtinCorrelation', ilab_mat(builtinCorr), 'builtinConvolution', ilab_mat(builtinConv), ...
            'symmetric', isequal(K, rot90(K, 2)));
        if strcmp(padMode, 'zero')
            data.maxDiffBuiltin = max([max(abs(corrOut(:) - builtinCorr(:))), max(abs(convOut(:) - builtinConv(:)))]);
        else
            data.maxDiffBuiltin = [];
        end
        activity('tools', mode);

    % ------------------------------------------- step-by-step animations
    case 'steps'
        A = double(P(p, 'matrix', magic(5)));
        switch char(P(p, 'algorithm', 'median'))
            case 'median',     data = medianSteps(A, P(p, 'k', 3));
            case 'histeq',     data = histeqSteps(A, P(p, 'levels', 8));
            case 'morphology', data = morphologySteps(A, double(P(p, 'se', ones(3))), char(P(p, 'operation', 'erode')));
            case 'regiongrow'
                data = regionGrowingSteps(A, P(p, 'seedRow', 1), P(p, 'seedCol', 1), ...
                    P(p, 'tolerance', 10), P(p, 'conn', 8));
            otherwise
                error('ImageLab:invalidParameter', 'Unknown animation "%s".', char(P(p, 'algorithm', '')));
        end
        activity('animations', char(P(p, 'algorithm', 'median')));

    case 'kernelPreset'
        [K, description] = kernelPresets(char(P(p, 'name', 'mean')), P(p, 'size', 3));
        data = struct('kernel', ilab_mat(K), 'description', description);

    case 'applyKernel'
        I = img(p.id);
        K = validateKernel(double(P(p, 'kernel', ones(3) / 9)));
        if strcmp(char(P(p, 'mode', 'correlation')), 'convolution'), K = rot90(K, 2); end
        tic;
        J = filter2D(I, K, char(P(p, 'padMode', 'replicate')));
        t = 1000 * toc;
        display = char(P(p, 'display', 'auto'));
        if strcmp(display, 'auto')
            if abs(sum(K(:))) < 1e-9, display = 'abs'; else, display = 'clip'; end
        end
        switch display
            case 'scale', shown = scaleToUnit(J);
            case 'abs',   shown = min(abs(J) / max(max(abs(J(:))), eps), 1);
            otherwise,    shown = min(max(J, 0), 1);
        end
        data = struct('id', put(shown, 'kernel'), 'timeMs', t, 'kernelSum', sum(K(:)), ...
            'display', display, 'symmetric', isequal(K, rot90(K, 2)), ...
            'outputRange', [min(J(:)) max(J(:))]);
        activity('tools', 'kernelPlayground');

    case 'saveKernel'
        data = kernelLibrary('save', char(P(p, 'name', 'my kernel')), double(P(p, 'kernel', [])));

    case 'listKernels'
        data = kernelLibrary('list');

    % ------------------------------------------------------------ sharpening
    case 'sharpen'
        I = img(p.id);
        method = char(P(p, 'method', 'laplacian'));
        kernel = [];
        switch method
            case 'laplacian'
                [S, D, kernel] = laplacianSharpen(I, P(p, 'alpha', 0.2), P(p, 'strength', 1), logical(P(p, 'eight', false)));
                D = scaleToUnit(toGray(D));
            case {'sobel', 'prewitt'}
                [S, D] = gradientSharpen(I, method, P(p, 'weight', 0.5));
                D = min(D / max(max(D(:)), eps), 1);
                if strcmp(method, 'sobel'), kernel = [-1 0 1; -2 0 2; -1 0 1]; else, kernel = [-1 0 1; -1 0 1; -1 0 1]; end
            case 'unsharp'
                [S, D] = unsharpMask(I, P(p, 'sigma', 1.5), P(p, 'amount', 1));
                D = scaleToUnit(toGray(D));
            case 'highboost'
                k = P(p, 'k', 3);
                [S, D] = highBoostFilter(I, P(p, 'boost', 2), k);
                D = scaleToUnit(toGray(D));
                kernel = -ones(k) / k^2;
                c = (k + 1) / 2;
                kernel(c, c) = kernel(c, c) + 1 + P(p, 'boost', 2);
            otherwise
                error('ImageLab:invalidParameter', 'Unknown sharpening method "%s".', method);
        end
        data = struct('id', put(S, 'sharp'), 'detailId', put(D, 'detail'), ...
            'kernel', matOrEmpty(kernel), 'sharpnessBefore', sharpness(I), 'sharpnessAfter', sharpness(S));
        activity('sharpening', method);

    % ------------------------------------------------------------ edges
    case 'edges'
        I = img(p.id);
        methods = cellstr(P(p, 'methods', {'sobel'}));
        thresh = P(p, 'thresh', []);
        results = {};
        for n = 1:numel(methods)
            m = methods{n};
            tic;
            [BW, used, mag, implementation] = edgeDetect(I, m, thresh, P(p, 'sigma', []));
            t = 1000 * toc;
            results{end+1} = struct('method', m, 'id', put(BW, 'edge'), 'magId', put(mag, 'mag'), ...
                'edgePixels', nnz(BW), 'density', 100 * nnz(BW) / numel(BW), 'timeMs', t, ...
                'threshold', used, 'implementation', implementation); %#ok<AGROW>
            activity('edges', m);
        end
        data = struct('results', {results});
        if logical(P(p, 'manualGradients', false))
            tic; [mag, gx, gy] = sobelManual(I); tS = 1000 * toc;
            tic; [magP, gxP, gyP] = prewittManual(I); tP = 1000 * toc;
            data.manual = struct( ...
                'sobel', struct('gx', put(scaleToUnit(gx), 'gx'), 'gy', put(scaleToUnit(gy), 'gy'), ...
                                'mag', put(min(mag / 4, 1), 'mag'), 'timeMs', tS), ...
                'prewitt', struct('gx', put(scaleToUnit(gxP), 'gx'), 'gy', put(scaleToUnit(gyP), 'gy'), ...
                                  'mag', put(min(magP / 3, 1), 'mag'), 'timeMs', tP));
        end

    % ------------------------------------------------------------ segmentation
    case 'segment'
        data = segmentImage(img(p.id), p);
        activity('segmentation', char(P(p, 'method', 'otsu')));

    % ------------------------------------------------------------ morphology
    case 'structuringElement'
        data = ilab_mat(structuringElement(char(P(p, 'shape', 'square')), P(p, 'size', 3)));

    case 'morphology'
        data = morphologyOp(img(p.id), p);
        activity('morphology', char(P(p, 'operation', 'erode')));

    % ------------------------------------------------- representation
    case 'regions'
        data = regionAnalysis(img(p.id), p);
        activity('regions', sprintf('conn%d', data.conn));

    % ------------------------------------------------------------ colour
    case 'color'
        I = img(p.id);
        space = char(P(p, 'space', 'rgb'));
        [ch, names] = colorChannels(I, space);
        channels = cell(1, numel(ch));
        for k = 1:numel(ch)
            channels{k} = struct('name', names{k}, 'id', put(ch{k}, 'ch'), ...
                'mean', mean(ch{k}(:)), 'std', std(ch{k}(:)));
        end
        data = struct('channels', {channels});
        activity('color', space);

    case 'colorEnhance'
        J = colorEnhance(img(p.id), char(P(p, 'space', 'hsv')), P(p, 'channel', 2), ...
            char(P(p, 'operation', 'gain')), P(p, 'amount', 1.3));
        data = struct('id', put(J, 'color'));
        activity('color', 'enhance');

    % ------------------------------------------------------------ fundamentals
    case 'neighborhood'
        V = double(P(p, 'matrix', zeros(5)));
        info = pixelNeighborhood(V, P(p, 'row', 3), P(p, 'col', 3), double(P(p, 'valueSet', 1)));
        data = struct('N4', {pts(info.N4)}, 'ND', {pts(info.ND)}, 'N8', {pts(info.N8)}, ...
            'adjacent4', {pts(info.adjacent4)}, 'adjacent8', {pts(info.adjacent8)}, ...
            'adjacentM', {pts(info.adjacentM)}, 'centerInSet', info.centerInSet, ...
            'euclidean', ilab_mat(info.euclidean), 'cityBlock', ilab_mat(info.cityBlock), ...
            'chessboard', ilab_mat(info.chessboard));
        activity('tools', 'neighborhood');

    case 'sampling'
        I = img(p.id);
        factors = P(p, 'factors', [1 2 4 8]);
        out = cell(1, numel(factors));
        for k = 1:numel(factors)
            [d, small] = sampleImage(I, factors(k));
            out{k} = struct('factor', factors(k), 'id', put(d, 'sample'), ...
                'width', size(small, 2), 'height', size(small, 1));
        end
        data = out;
        activity('tools', 'sampling');

    case 'quantize'
        I = img(p.id);
        bits = P(p, 'bits', [1 2 4 8]);
        out = cell(1, numel(bits));
        for k = 1:numel(bits)
            [J, levels] = quantizeImage(I, bits(k));
            out{k} = struct('bits', bits(k), 'levels', levels, 'id', put(J, 'quant'), ...
                'psnr', calculatePSNR(J, I), 'uniqueLevels', numel(unique(toUint8(J))));
        end
        data = out;
        activity('tools', 'quantization');

    % ------------------------------------------------------------ comparison
    case 'compare'
        data = compareFilters(img(p.id), p);
        activity('tools', 'compare');

    % ------------------------------------------------------------ code lab
    case 'codeTasks'
        data = struct('tasks', {codeTasks('list')}, 'solved', {solvedCodeTasks()}, 'ipt', hasIPT());

    case 'codeWarmup'
        figurePool('warm');                 % first figure render takes seconds - do it early
        data = struct('warm', true);

    case 'codeTaskStart'
        data = struct('inputId', put(codeTasks('input', char(P(p, 'taskId', ''))), 'taskin'));

    case 'codeTaskSolution'
        taskId = char(P(p, 'taskId', ''));
        if ~ismember(taskId, solvedCodeTasks())
            error('ImageLab:invalidParameter', 'Solve the task first - then the model solution is shown.');
        end
        data = struct('code', codeTasks('solution', taskId));

    case 'runCode'
        data = runCodeLab(p);

    % ------------------------------------------------------------ quiz & games
    case 'quizCategories'
        data = quizEngine('categories');

    case 'quizQuestions'
        plan = [];
        if strcmp(char(P(p, 'mode', 'bank')), 'kernel')
            qs = quizEngine('kernel', P(p, 'n', 10));
        elseif strcmp(char(P(p, 'mode', 'bank')), 'weak')
            prog = progressManager('get');
            stats = prog.categoryStats;
            if iscell(stats), stats = [stats{:}]; end
            [qs, plan] = quizEngine('weak', stats, P(p, 'n', 10));
        else
            qs = quizEngine('select', char(P(p, 'difficulty', 'mixed')), P(p, 'categories', 'all'), P(p, 'n', 10));
        end
        data = arrayfun(@(q) struct('id', q.id, 'category', q.category, 'difficulty', q.difficulty, ...
            'type', q.type, 'question', q.question, 'options', {q.options}, 'answer', q.answer, ...
            'explanation', q.explanation, 'kernel', matOrEmpty(q.kernel)), qs(:)', 'UniformOutput', false);
        if ~isempty(plan)
            data = struct('questions', {data}, 'plan', {lst(plan)});
        end

    case 'quizSubmit'
        results = P(p, 'results', []);
        if iscell(results), results = [results{:}]; end
        if isempty(results)
            error('ImageLab:invalidQuizState', 'The quiz has no answers to submit.');
        end
        summary = quizEngine('score', results);
        summary.mode = char(P(p, 'mode', 'Rapid Fire'));
        progress = progressManager('quiz', summary, results);
        board = [];
        name = strtrim(char(P(p, 'name', '')));
        if ~isempty(name)
            board = leaderboardManager('add', struct('name', name, 'roll', char(P(p, 'roll', '')), ...
                'score', summary.score, 'accuracy', summary.accuracy, ...
                'bestStreak', summary.bestStreak, 'mode', summary.mode));
            board = lst(board);
        end
        data = struct('summary', summary, 'progress', progress, 'leaderboard', {board});

    case 'guessFilter'
        data = guessFilterRound(img(p.id));

    case 'pipelineProblems'
        probs = pipelineProblems();
        data = arrayfun(@(q) struct('id', q.id, 'title', q.title, 'description', q.description), ...
            probs(:)', 'UniformOutput', false);

    case 'pipelineStart'
        seed(p);
        prob = findProblem(char(P(p, 'problemId', 'sp')));
        I = img(p.id);
        D = degradeImage(I, prob.degrade);
        q = imageQuality(D, I);
        data = struct('degradedId', put(D, 'degraded'), 'cleanId', put(I, 'clean'), ...
            'psnr', q.psnr, 'ssim', q.ssim);

    case 'pipelineRun'
        data = runPipeline(p);
        date = char(P(p, 'daily', ''));
        if ~isempty(date)
            checkDate(date);
            % Bonus: 10 points per dB of PSNR gained (a perfect match has PSNR = Inf)
            bonus = min(200, max(0, round(10 * (data.after.psnr - data.before.psnr))));
            data.points = data.points + bonus * ~strcmp(data.verdict, 'wrong');
            data.psnrBonus = bonus;
            data.progress = progressManager('daily', date, data.points, strcmp(data.verdict, 'correct'));
        end

    case 'dailyStart'
        data = startDaily(char(P(p, 'date', char(datetime('today', 'Format', 'yyyy-MM-dd')))));

    case 'challengeStart'
        data = startChallenge(img(p.id), char(P(p, 'level', 'medium')), p);

    case 'challengeScore'
        data = scoreChallenge(p);

    case 'leaderboard'
        action = char(P(p, 'action', 'get'));
        if strcmp(action, 'add')
            data = lst(leaderboardManager('add', p.entry));
        else
            data = lst(leaderboardManager(action));
        end

    case 'profiles'
        switch char(P(p, 'action', 'list'))
            case 'add',    data = profileManager('add', char(P(p, 'name', '')), char(P(p, 'roll', '')));
            case 'update', data = profileManager('update', char(P(p, 'id', '')), char(P(p, 'name', '')), char(P(p, 'roll', '')));
            case 'remove', data = profileManager('remove', char(P(p, 'id', '')));
            otherwise,     data = profileManager('list');
        end

    case 'progress'
        action = char(P(p, 'action', 'get'));
        switch action
            case 'topic',      data = progressManager('topic', char(p.value));
            case 'experiment', data = progressManager('experiment', p.value);
            case 'reset',      data = progressManager('reset');
            otherwise,         data = progressManager('get');
        end

    % ------------------------------------------------------------ experiments
    case 'experiments'
        E = experimentCatalog();
        C = classroomManager('get');               % teacher's open / assigned / locked states
        data = cell(1, numel(E));
        for k = 1:numel(E)
            e = E(k);
            c = C.experiments{[cellfun(@(x) x.number, C.experiments)] == e.number};
            e.status = c.status; e.due = c.due; e.teacherNote = c.note;
            data{k} = e;
        end

    case 'classroom'
        % Teacher view. Everything except 'get' needs the teacher PIN (if one is set).
        action = char(P(p, 'action', 'get'));
        pin = char(P(p, 'pin', ''));
        if ~strcmp(action, 'get') && ~strcmp(action, 'setPin')
            classroomManager('requirePin', pin);
        end
        switch action
            case 'get',           data = classroomManager('get');
            case 'unlock',        data = classroomManager('get');
            case 'report',        data = classroomManager('report');
            case 'export',        data = classroomManager('export');
            case 'setPin',        data = classroomManager('setPin', pin, char(P(p, 'newPin', '')));
            case 'setExperiment'
                data = classroomManager('setExperiment', P(p, 'number', 0), char(P(p, 'status', 'open')), ...
                    char(P(p, 'due', '')), char(P(p, 'note', '')));
            otherwise
                error('ImageLab:invalidParameter', 'Unknown classroom action "%s".', action);
        end

    case 'runExperiment'
        n = P(p, 'number', 1);
        classroomManager('assertRunnable', n);
        if isfield(p, 'id') && ~isempty(p.id)
            I = img(p.id);
        else
            E = experimentCatalog();
            I = toDouble(imread(sampleImages('path', E(n).defaultImage)));
            I = limitSize(I);
        end
        R = runExperiment(n, I);
        data = struct('number', R.number, 'images', {lst(R.images)}, 'metrics', {lst(R.metrics)}, ...
            'observations', {R.observations}, 'kernel', matOrEmpty(R.kernel), 'parameters', R.parameters);
        if trackingEnabled(), progressManager('experiment', n); end

    case 'report'
        R = p;
        if isfield(R, 'images') && iscell(R.images), R.images = [R.images{:}]; end
        if isfield(R, 'metrics') && iscell(R.metrics), R.metrics = [R.metrics{:}]; end
        if isfield(R, 'kernel') && isstruct(R.kernel), R.kernel = []; end
        info = generateReport(R);
        data = struct('name', info.name, 'docx', info.docx, 'pdf', info.pdf);

    otherwise
        error('ImageLab:unknownOperation', 'Unknown operation "%s".', op);
end
end

% =========================================================================
% Images
function data = importImage(file, name)
if isempty(file) || ~isfile(file)
    error('ImageLab:noImage', 'The image file could not be found.');
end
try
    [I, map] = imread(file);
    finfo = imfinfo(file);
    finfo = finfo(1);
catch
    error('ImageLab:badFormat', ...
        'This file is not a supported image. Use PNG, JPG, TIF, BMP or GIF.');
end
originalClass = class(I);
if ~isempty(map)
    I = ind2rgb(I, map);
    colorType = 'Indexed (converted to RGB)';
elseif size(I, 3) == 4
    I = I(:, :, 1:3);
    colorType = 'RGB + alpha (alpha removed)';
elseif size(I, 3) == 3
    colorType = 'RGB';
elseif size(I, 3) == 1
    colorType = 'Grayscale';
else
    error('ImageLab:badFormat', 'Images with %d channels are not supported.', size(I, 3));
end
I = toDouble(I);
[h, w, ~] = size(I);
[I, resized] = limitSize(I);
id = put(I, 'orig');
bitDepth = [];
if isfield(finfo, 'BitDepth'), bitDepth = finfo.BitDepth; end
data = struct('id', id, 'name', name, 'info', describe(I), ...
    'original', struct('width', w, 'height', h, 'class', originalClass, ...
        'colorType', colorType, 'format', upper(finfo.Format), 'bitDepth', bitDepth, ...
        'fileSizeKB', finfo.FileSize / 1024), ...
    'resized', resized);
end

function [I, resized] = limitSize(I, maxSide)
% Keep images at most 640 px on the longest side so manual loops stay fast
if nargin < 2, maxSide = 640; end
[h, w, ~] = size(I);
resized = max(h, w) > maxSide;
if resized
    s = maxSide / max(h, w);
    I = resizeImage(I, round(h * s), round(w * s));
end
end

function s = describe(I)
[h, w, c] = size(I);
if c == 3, space = 'RGB'; else, space = 'Grayscale'; end
s = struct('width', w, 'height', h, 'channels', c, 'class', 'uint8', ...
    'dataType', 'uint8 (8 bits per channel, 0-255)', 'colorSpace', space, ...
    'pixels', h * w, 'memoryKB', h * w * c / 1024, ...
    'min', round(255 * min(I(:))), 'max', round(255 * max(I(:))), 'mean', 255 * mean(I(:)));
end

function I = img(id)
I = ilab_store('load', id);
end

function id = put(I, tag)
id = ilab_store('save', I, tag);
end

% =========================================================================
% Histogram lab
function [J, mapping, implementation] = histogramMethod(I, method, p)
ramp = (0:255)' / 255;
mapping = [];
implementation = 'Manual (base MATLAB)';
switch method
    case 'none'
        J = I;
        mapping = 0:255;
    case 'histeq'
        J = histogramEqualization(I);
        if hasIPT(), implementation = 'histeq (Image Processing Toolbox)'; end
        if size(I, 3) == 1, [~, mapping] = histogramEqualizationManual(I); end
    case 'histeqManual'
        [~, mapping] = histogramEqualizationManual(toGray(I));
        J = applyToLuminance(@histogramEqualizationManual, I);
    case 'clahe'
        tiles = P(p, 'tiles', 8);
        J = clahe(I, [tiles tiles], P(p, 'clipLimit', 0.01));
        if hasIPT(), implementation = 'adapthisteq (Image Processing Toolbox)'; end
    case 'stretch'
        lo = P(p, 'low', []); hi = P(p, 'high', []);
        [J, limits] = contrastStretch(I, lo, hi);
        mapping = round(255 * min(max((ramp - limits(1)) / (limits(2) - limits(1)), 0), 1));
        if hasIPT(), implementation = 'imadjust (Image Processing Toolbox)'; end
    case 'gamma'
        g = P(p, 'gamma', 0.5);
        J = gammaCorrection(I, g);
        mapping = round(255 * gammaCorrection(ramp, g));
    case 'log'
        k = P(p, 'k', 10);
        J = logTransform(I, k);
        mapping = round(255 * logTransform(ramp, k));
    case 'negative'
        J = negativeTransform(I);
        mapping = round(255 * negativeTransform(ramp));
    otherwise
        error('ImageLab:invalidParameter', 'Unknown histogram method "%s".', method);
end
if ~isempty(mapping), mapping = num2cell(mapping(:)'); end
end

% =========================================================================
% Segmentation lab
function data = segmentImage(I, p)
G = toGray(I);
method = char(P(p, 'method', 'otsu'));
level = [];
extraId = '';
L = [];
switch method
    case 'global'
        level = P(p, 'threshold', 0.5);
        BW = globalThreshold(G, level);
    case 'iterative'
        [BW, level] = iterativeThreshold(G);
    case 'otsu'
        [BW, level] = otsuThreshold(G);
    case 'adaptive'
        [BW, localMean] = adaptiveThreshold(G, P(p, 'window', 25), P(p, 'offset', 0.02));
        extraId = put(localMean, 'localmean');
    case 'point'
        [BW, R] = pointDetection(G, P(p, 'threshold', 0.9));
        extraId = put(min(abs(R) / max(max(abs(R(:))), eps), 1), 'response');
    case 'line'
        [BW, R] = lineDetection(G, char(P(p, 'direction', 'horizontal')), P(p, 'threshold', 0.5));
        extraId = put(R / max(max(R(:)), eps), 'response');
    case 'regiongrow'
        [h, w] = size(G);
        BW = regionGrowing(G, P(p, 'seedRow', round(h / 2)), P(p, 'seedCol', round(w / 2)), ...
            P(p, 'tolerance', 0.1), P(p, 'conn', 8));
    case 'splitmerge'
        [L, meanImage] = splitAndMerge(G, P(p, 'stdThreshold', 0.05), P(p, 'minBlock', 8), P(p, 'mergeThreshold', 0.08));
        B = false(size(L));
        B(:, 1:end-1) = L(:, 1:end-1) ~= L(:, 2:end);
        B(1:end-1, :) = B(1:end-1, :) | L(1:end-1, :) ~= L(2:end, :);
        extraId = put(meanImage, 'regions');
        BW = B;
    case 'boundary'
        BW = extractBoundary(otsuThreshold(G));
    otherwise
        error('ImageLab:invalidParameter', 'Unknown segmentation method "%s".', method);
end

if isempty(L)
    [L, n] = labelComponents(BW, 8);
else
    n = max(L(:));
end
props = regionProperties(L);
if ~isempty(props)
    [~, order] = sort([props.area], 'descend');
    props = props(order(1:min(15, numel(order))));
end

% Overlay: segmented pixels tinted green, boundaries red
base = repmat(G, 1, 1, 3);
tint = cat(3, zeros(size(G)), ones(size(G)), zeros(size(G)));
mask = repmat(BW, 1, 1, 3);
overlay = base;
overlay(mask) = 0.55 * base(mask) + 0.45 * tint(mask);
edgeMask = extractBoundary(BW);
for c = 1:3
    ch = overlay(:, :, c);
    ch(edgeMask) = double(c == 1);
    overlay(:, :, c) = ch;
end

data = struct('id', put(BW, 'bw'), 'overlayId', put(overlay, 'overlay'), ...
    'extraId', extraId, 'threshold', level, ...
    'foreground', 100 * nnz(BW) / numel(BW), 'regions', n, 'props', {lst(props)}, ...
    'histogram', imhistManual(G));
end

% =========================================================================
% Morphology lab
function data = morphologyOp(I, p)
op = char(P(p, 'operation', 'erode'));
SE = validateSE(double(P(p, 'se', ones(3))));
mode = char(P(p, 'mode', 'binary'));
if any(strcmp(op, {'boundary', 'fill'})), mode = 'binary'; end
level = [];
if strcmp(mode, 'binary')
    [A, level] = otsuThreshold(I);
    A = logical(A);
    if logical(P(p, 'invert', false)), A = ~A; end
else
    A = toDouble(I);
end
manual = strcmp(char(P(p, 'impl', 'toolbox')), 'manual');
if manual
    er = @(X) morphologyManual(X, SE, 'erode');
    di = @(X) morphologyManual(X, SE, 'dilate');
else
    er = @(X) erodeImage(X, SE);
    di = @(X) dilateImage(X, SE);
end
fname = '';
tic;
switch op
    case 'erode',    J = er(A);        fname = 'erodeImage';
    case 'dilate',   J = di(A);        fname = 'dilateImage';
    case 'open',     J = di(er(A));    fname = 'openImage';
    case 'close',    J = er(di(A));    fname = 'closeImage';
    case 'boundary', J = A & ~er(A);   fname = 'morphBoundary';
    case 'fill',     J = fillHoles(A); fname = 'fillHoles';
    otherwise
        error('ImageLab:invalidParameter', 'Unknown morphological operation "%s".', op);
end
t = 1000 * toc;
if manual && ~strcmp(op, 'fill'), fname = 'morphologyManual'; end

if islogical(J)
    % Change map: kept object white, removed pixels red, added pixels green
    kept = A & J; removed = A & ~J; added = ~A & J;
    change = cat(3, double(kept | removed), double(kept | added), double(kept));
    change = 0.04 + 0.92 * change;
    [~, nBefore] = labelComponents(A, 8);
    [~, nAfter] = labelComponents(J, 8);
    stats = struct('foregroundBefore', 100 * nnz(A) / numel(A), 'foregroundAfter', 100 * nnz(J) / numel(J), ...
        'regionsBefore', nBefore, 'regionsAfter', nAfter, ...
        'removed', nnz(removed), 'added', nnz(added));
else
    change = min(abs(J - A) * 4, 1);
    stats = struct('meanBefore', 255 * mean(A(:)), 'meanAfter', 255 * mean(J(:)), ...
        'changed', 100 * mean(any(abs(J - A) > 0.5 / 255, 3), 'all'));
end
if manual
    implementation = 'Manual implementation (explicit loops)';
elseif hasIPT()
    implementation = 'MATLAB Image Processing Toolbox (imerode / imdilate)';
else
    implementation = 'Vectorised base MATLAB (one shifted min/max per SE element)';
end
if strcmp(op, 'fill'), implementation = 'Connected-component labelling of the background (base MATLAB)'; end
data = struct('id', put(J, op), 'inputId', put(A, 'morphin'), 'changeId', put(change, 'change'), ...
    'operation', op, 'mode', mode, 'binary', islogical(J), 'threshold', level, ...
    'se', ilab_mat(SE), 'timeMs', t, 'functionName', fname, 'implementation', implementation, ...
    'stats', stats);
end

% =========================================================================
% Region analysis (representation & description)
function data = regionAnalysis(I, p)
G = toGray(I);
if strcmp(char(P(p, 'method', 'otsu')), 'global')
    level = P(p, 'threshold', 0.5);
    BW = G > level;
else
    [BW, level] = otsuThreshold(G);
    BW = logical(BW);
end
if logical(P(p, 'invert', false)), BW = ~BW; end
conn = P(p, 'conn', 8);
if ~any(conn == [4 8]), conn = 8; end
minArea = max(1, round(P(p, 'minArea', 20)));

tic;
[L, n] = labelComponents(BW, conn);
tLabel = 1000 * toc;
areas = accumarray(L(L > 0), 1, [max(n, 1) 1]);
if n == 0, areas = zeros(0, 1); end
[~, byArea] = sort(areas, 'descend');
byArea = byArea(areas(byArea) >= minArea);
total = numel(byArea);
shown = byArea(1:min(40, total));

% Colour every kept region; regions below minArea stay dark grey
% (golden-ratio hue steps keep neighbouring labels clearly different)
palette = zeros(numel(shown), 3);
if ~isempty(shown)
    palette = hsv2rgb([mod((0:numel(shown)-1)' * 0.618034, 1), 0.62 * ones(numel(shown), 1), 0.95 * ones(numel(shown), 1)]);
end
R = 0.25 * G; Gc = R; B = R;
small = BW & ~ismember(L, shown);
R(small) = 0.45; Gc(small) = 0.45; B(small) = 0.45;
regions = cell(1, numel(shown));
for k = 1:numel(shown)
    mask = L == shown(k);
    R(mask) = palette(k, 1); Gc(mask) = palette(k, 2); B(mask) = palette(k, 3);

    [r, c] = find(mask);
    r0 = min(r); r1 = max(r); c0 = min(c); c1 = max(c);
    [code, bnd] = chainCode(mask(r0:r1, c0:c1));
    bnd = bnd + [r0 c0] - 1;
    d = chainCodeDescriptors(code);
    area = numel(r);
    if d.perimeter > 0, circ = 4 * pi * area / d.perimeter^2; else, circ = 1; end
    regions{k} = struct('label', k, 'area', area, ...
        'centroidX', mean(c), 'centroidY', mean(r), ...
        'bboxX', c0, 'bboxY', r0, 'bboxWidth', c1 - c0 + 1, 'bboxHeight', r1 - r0 + 1, ...
        'boundaryPixels', size(bnd, 1), 'perimeter', d.perimeter, ...
        'circularity', min(circ, 1), 'equivDiameter', sqrt(4 * area / pi), ...
        'color', sprintf('#%02x%02x%02x', round(255 * palette(k, :))), ...
        'chainLength', numel(code), 'chain', clip(sprintf('%d', code), 800), ...
        'firstDifference', clip(sprintf('%d', d.firstDifference), 800), ...
        'shapeNumber', clip(sprintf('%d', d.shapeNumber), 800), ...
        'nEven', d.nEven, 'nOdd', d.nOdd, 'startRow', r0, 'startCol', bnd(1, 2), ...
        'cropId', put(regionCrop(G, mask, bnd, r0, r1, c0, c1), 'region'));
end
labelImage = cat(3, R, Gc, B);
data = struct('id', put(labelImage, 'labels'), 'binaryId', put(BW, 'bw'), ...
    'threshold', level, 'conn', conn, 'minArea', minArea, ...
    'components', n, 'kept', total, 'shown', numel(shown), ...
    'labelTimeMs', tLabel, 'regions', {regions}, ...
    'implementation', ternary(hasIPT(), 'bwlabel (toolbox) + chainCode.m', 'labelComponents.m (BFS) + chainCode.m'));
end

function C = regionCrop(G, mask, bnd, r0, r1, c0, c1)
% Close-up of one region: grey image, region tinted, traced boundary red,
% start pixel yellow. Enlarged with nearest-neighbour so pixels stay visible.
m = 3;
rr = max(1, r0 - m):min(size(G, 1), r1 + m);
cc = max(1, c0 - m):min(size(G, 2), c1 + m);
g = G(rr, cc);
k = mask(rr, cc);
R = g * 0.5; Gc = R; B = R;
R(k) = 0.35 + 0.3 * g(k); Gc(k) = 0.6 + 0.3 * g(k); B(k) = 0.45 + 0.3 * g(k);
idx = sub2ind(size(g), bnd(:, 1) - rr(1) + 1, bnd(:, 2) - cc(1) + 1);
R(idx) = 1; Gc(idx) = 0.15; B(idx) = 0.15;
R(idx(1)) = 1; Gc(idx(1)) = 0.85; B(idx(1)) = 0;
C = cat(3, R, Gc, B);
f = max(1, min(12, floor(160 / max(size(C, 1), size(C, 2)))));
C = repelem(C, f, f, 1);
end

function s = clip(s, n)
if numel(s) > n, s = [s(1:n) '...']; end
end

function v = ternary(c, a, b)
if c, v = a; else, v = b; end
end

% =========================================================================
% Daily challenge: same puzzle for everybody on a given date
function data = startDaily(date)
checkDate(date);
seedValue = str2double(strrep(date, '-', ''));
rng(seedValue);
probs = pipelineProblems();
prob = probs(randi(numel(probs)));
pool = {'peppers.png', 'shapes.png', 'lowcontrast.png', 'unevenlight.png', 'cameraman.tif', 'coins.png', 'moon.tif', 'pout.tif'};
generateSampleImages(false);
names = {sampleImages('list').name};
pool = pool(ismember(pool, names));
sample = pool{randi(numel(pool))};
[I, map] = imread(sampleImages('path', sample));
if ~isempty(map), I = ind2rgb(I, map); end
I = limitSize(toDouble(I(:, :, 1:min(3, size(I, 3)))), 400);
D = degradeImage(I, prob.degrade);
rng('shuffle');
q = imageQuality(D, I);
prog = progressManager('get');
hist = prog.dailyHistory;
if iscell(hist), hist = [hist{:}]; end
today = struct('solved', false, 'points', 0, 'attempts', 0);
if ~isempty(hist)
    idx = find(strcmp({hist.date}, date), 1);
    if ~isempty(idx), today = hist(idx); end
end
data = struct('date', date, 'problemId', prob.id, 'title', prob.title, ...
    'description', prob.description, 'sample', sample, ...
    'cleanId', put(I, 'target'), 'degradedId', put(D, 'daily'), ...
    'psnr', q.psnr, 'ssim', q.ssim, 'solved', today.solved, 'bestPoints', today.points, ...
    'attempts', today.attempts, 'streak', prog.dailyStreak, 'history', {lst(hist)});
end

function checkDate(date)
if isempty(regexp(date, '^\d{4}-\d{2}-\d{2}$', 'once'))
    error('ImageLab:invalidParameter', 'Invalid date "%s" (expected YYYY-MM-DD).', date);
end
end

% =========================================================================
% Code Lab: run the student's MATLAB code, grade it when it belongs to a task
function data = runCodeLab(p)
taskId = char(P(p, 'taskId', ''));
opts = struct();
if ~isempty(taskId)
    t = codeTasks('get', taskId);
    I = codeTasks('input', taskId);
    opts.forbidden = t.forbidden;
elseif isfield(p, 'id') && ~isempty(p.id)
    I = img(p.id);
else
    generateSampleImages(false);
    I = limitSize(toDouble(imread(sampleImages('path', 'peppers.png'))));
end
r = runStudentCode(char(P(p, 'code', '')), I, opts);
data = rmfield(r, {'outValue', 'hasOut'});
data.grade = [];
data.newBadges = {};
if isempty(taskId), return; end
if ~isempty(r.error)
    data.grade = struct('passed', false, 'match', 0, 'checks', {{}}, 'expectedId', '', 'diffId', '', ...
        'message', 'Your code stopped with an error - fix it (see the Command Window) and run again.');
    return
end
ws = struct();
if r.hasOut, ws.out = r.outValue; end
data.grade = codeTasks('grade', taskId, ws, I);
if data.grade.passed && trackingEnabled()
    prog = progressManager('codeTask', taskId);
    data.newBadges = prog.newBadges;
end
end

function ids = solvedCodeTasks()
prog = progressManager('get');
ids = {};
if isfield(prog.activities, 'codelab'), ids = reshape(cellstr(prog.activities.codelab), 1, []); end
end

% =========================================================================
% Filter comparison lab
function data = compareFilters(I, p)
seed(p);
noiseType = char(P(p, 'noiseType', 'saltpepper'));
if strcmp(noiseType, 'none'), N = I; else, N = addNoise(I, noiseType, p); end
qn = imageQuality(N, I);
filters = P(p, 'filters', struct('name', {'mean', 'median', 'gaussian', 'min'}, 'k', {3, 3, 5, 3}));
if iscell(filters), filters = [filters{:}]; end
if isempty(filters)
    error('ImageLab:invalidParameter', 'Select at least one filter to compare.');
end
results = cell(1, numel(filters));
labels = cell(1, numel(filters));
psnrs = zeros(1, numel(filters)); ssims = psnrs; times = psnrs;
for k = 1:numel(filters)
    f = filters(k);
    kk = 3; if isfield(f, 'k') && ~isempty(f.k), kk = f.k; end
    tic;
    [J, info] = ilab_runFilter(N, f.name, kk, f, 'toolbox');
    t = 1000 * toc;
    q = imageQuality(J, I);
    labels{k} = sprintf('%s %dx%d', f.name, kk, kk);
    psnrs(k) = q.psnr; ssims(k) = q.ssim; times(k) = t;
    results{k} = struct('label', labels{k}, 'name', f.name, 'k', kk, 'linear', info.linear, ...
        'id', put(J, f.name), 'mse', q.mse, 'psnr', q.psnr, 'ssim', q.ssim, 'timeMs', t);
    activity('filters', f.name);
end
[~, best] = max(psnrs);
data = struct('cleanId', put(I, 'clean'), 'noisyId', put(N, 'noisy'), ...
    'noisy', qn, 'results', {results}, 'best', labels{best}, ...
    'charts', struct('psnr', ilab_barChart(psnrs, labels, 'PSNR (higher is better)', 'PSNR (dB)'), ...
                     'ssim', ilab_barChart(ssims, labels, 'SSIM (higher is better)', 'SSIM'), ...
                     'time', ilab_barChart(times, labels, 'Processing time', 'Time (ms)')));
end

% =========================================================================
% Games
function data = guessFilterRound(I)
G = toGray(I);
options = {'Mean', 'Median', 'Gaussian', 'Laplacian', 'Sobel', 'Prewitt'};
explain = {
    'Mean: everything is blurred evenly, and the impulse noise is smeared into grey blobs rather than removed.'
    'Median: the salt & pepper dots vanish completely while edges stay sharp - the signature of the median filter.'
    'Gaussian: a smooth, soft blur; impulses are softened but still visible as faint spots.'
    'Laplacian: flat areas become mid-grey and every edge shows a double (light/dark) line - a second derivative.'
    'Sobel: edges appear bright on black with slightly thick, smooth outlines (1-2-1 weighting).'
    'Prewitt: very similar to Sobel - edges bright on black, slightly noisier because all weights are equal.'};
pick = randi(numel(options));
switch pick
    case 1, input = addSaltPepperNoise(G, 0.06); out = meanFilter(input, 5);
    case 2, input = addSaltPepperNoise(G, 0.06); out = medianFilter(input, 3);
    case 3, input = addSaltPepperNoise(G, 0.06); out = gaussianFilter(input, 7, 1.5);
    case 4, input = G; out = scaleToUnit(filter2D(G, [0 1 0; 1 -4 1; 0 1 0]));
    case 5, input = G; out = ilab_runFilter(G, 'sobel', 3, struct(), 'toolbox');
    case 6, input = G; out = ilab_runFilter(G, 'prewitt', 3, struct(), 'toolbox');
end
order = randperm(numel(options));
data = struct('inputId', put(input, 'guessin'), 'outputId', put(out, 'guessout'), ...
    'options', {options(order)}, 'answer', find(order == pick), 'explanation', explain{pick});
end

function prob = findProblem(id)
probs = pipelineProblems();
idx = find(strcmp({probs.id}, id), 1);
if isempty(idx)
    error('ImageLab:invalidParameter', 'Unknown pipeline problem "%s".', id);
end
prob = probs(idx);
end

function data = runPipeline(p)
prob = findProblem(char(P(p, 'problemId', 'sp')));
clean = img(p.cleanId);
D = img(p.degradedId);
steps = reshape(cellstr(P(p, 'steps', {})), 1, []);
if isempty(steps)
    error('ImageLab:invalidParameter', 'Add at least one block to your pipeline.');
end
J = D;
stepOut = cell(1, numel(steps));
for k = 1:numel(steps)
    J = applyBlock(J, steps{k});
    q = imageQuality(J, clean);
    stepOut{k} = struct('block', steps{k}, 'id', put(J, 'step'), 'psnr', q.psnr, 'ssim', q.ssim);
end
before = imageQuality(D, clean);
after = imageQuality(J, clean);

isMatch = @(seq) numel(seq) == numel(steps) && all(strcmpi(reshape(seq, 1, []), steps));
if isMatch(prob.expected) || any(cellfun(isMatch, prob.accepted))
    verdict = 'correct';
    feedback = 'Excellent! That is the right pipeline.';
elseif any(ismember(lower(steps), lower(prob.expected)))
    verdict = 'partial';
    feedback = 'Partly right - you used a correct block, but the sequence is not ideal.';
else
    verdict = 'wrong';
    feedback = 'Not quite. Think about which degradation is present and which filter targets it.';
end
data = struct('steps', {stepOut}, 'before', before, 'after', after, 'verdict', verdict, ...
    'feedback', feedback, 'expected', {prob.expected}, 'explanation', prob.explanation, ...
    'points', strcmp(verdict, 'correct') * 100 + strcmp(verdict, 'partial') * 40);
end

function data = startChallenge(I, level, p)
seed(p);
switch level
    case 'easy'
        steps = {{'saltpepper', 0.04}};
        text = 'The image has salt & pepper noise. Restore it!';
        limit = 90;
    case 'hard'
        steps = {{'blur', 1.2}, {'gaussian', 0.005}, {'saltpepper', 0.03}, {'contrast', 0.6}};
        text = 'Blur, Gaussian noise, impulse noise AND low contrast. Good luck!';
        limit = 60;
    otherwise
        steps = {{'gaussian', 0.008}, {'saltpepper', 0.02}};
        text = 'A mixture of Gaussian and salt & pepper noise. Restore it!';
        limit = 60;
end
D = degradeImage(I, steps);
q = imageQuality(D, I);
data = struct('cleanId', put(I, 'clean'), 'degradedId', put(D, 'challenge'), ...
    'description', text, 'timeLimit', limit, 'psnr', q.psnr, 'ssim', q.ssim);
end

function data = scoreChallenge(p)
clean = img(p.cleanId);
D = img(p.degradedId);
steps = P(p, 'steps', []);
if iscell(steps), steps = [steps{:}]; end
J = D;
tic;
for k = 1:numel(steps)
    J = applyBlock(J, steps(k).block, steps(k));
end
procMs = 1000 * toc;
before = imageQuality(D, clean);
after = imageQuality(J, clean);
timeUsed = P(p, 'timeUsed', 0);
timeLimit = P(p, 'timeLimit', 60);
% Score: PSNR gain (dB) x 40 + SSIM gain x 600 + time bonus, minimum 0
gainPsnr = after.psnr - before.psnr;
gainSsim = after.ssim - before.ssim;
timeBonus = round(200 * max(0, 1 - timeUsed / timeLimit));
score = max(0, round(40 * gainPsnr + 600 * gainSsim) + timeBonus * (gainPsnr > 0));
data = struct('id', put(J, 'result'), 'before', before, 'after', after, ...
    'psnrGain', gainPsnr, 'ssimGain', gainSsim, 'timeBonus', timeBonus, ...
    'processingMs', procMs, 'score', score);
end

% =========================================================================
% Helpers
function out = kernelLibrary(action, name, K)
file = fullfile(fileparts(fileparts(mfilename('fullpath'))), 'data', 'kernels.mat');
lib = struct('name', {}, 'kernel', {});
if isfile(file)
    s = load(file);
    if isfield(s, 'lib'), lib = s.lib; end
end
if strcmp(action, 'save')
    validateKernel(K);
    if isempty(strtrim(name))
        error('ImageLab:invalidParameter', 'Please give the kernel a name.');
    end
    idx = find(strcmp({lib.name}, name), 1);
    if isempty(idx), idx = numel(lib) + 1; end
    lib(idx) = struct('name', name, 'kernel', K);
    if ~isfolder(fileparts(file)), mkdir(fileparts(file)); end
    save(file, 'lib');
end
out = arrayfun(@(e) struct('name', e.name, 'kernel', ilab_mat(e.kernel)), lib(:)', 'UniformOutput', false);
end

function data = sourceCode(name)
if isempty(regexp(name, '^[A-Za-z]\w*$', 'once'))
    error('ImageLab:invalidParameter', 'Invalid function name.');
end
root = fileparts(fileparts(mfilename('fullpath')));
file = which(name);
if isempty(file) || ~startsWith(file, root)
    error('ImageLab:invalidParameter', 'No ImageLab function called "%s".', name);
end
data = struct('name', name, 'file', strrep(file(numel(root)+2:end), '\', '/'), 'code', fileread(file));
end

function s = sharpness(I)
G = toGray(I);
s = mean(hypot(filter2D(G, [-1 0 1; -2 0 2; -1 0 1] / 8), filter2D(G, [-1 -2 -1; 0 0 0; 1 2 1] / 8)), 'all');
end

function c = pts(Pm)
c = arrayfun(@(k) struct('r', Pm(k, 1), 'c', Pm(k, 2)), 1:size(Pm, 1), 'UniformOutput', false);
end

function m = matOrEmpty(K)
if isempty(K), m = []; else, m = ilab_mat(K); end
end

function c = lst(s)
c = num2cell(s(:)');
end

function seed(p)
if isfield(p, 'seed') && ~isempty(p.seed), rng(p.seed); else, rng('shuffle'); end
end

function tf = trackingEnabled(value)
% Remembers whether the current request should update the learning progress
persistent enabled
if nargin > 0, enabled = value; end
if isempty(enabled), enabled = true; end
tf = enabled;
end

function activity(area, item)
if ~trackingEnabled(), return; end
try
    progressManager('activity', area, item);
catch
    % progress tracking must never break an image operation
end
end

function v = P(s, name, default)
if isstruct(s) && isfield(s, name) && ~isempty(s.(name))
    v = s.(name);
else
    v = default;
end
end

function msg = friendlyMessage(err)
if startsWith(err.identifier, 'ImageLab:')
    msg = err.message;
elseif contains(err.identifier, 'nomem') || contains(err.message, 'memory')
    msg = 'MATLAB ran out of memory. Try a smaller image or kernel.';
elseif contains(err.identifier, 'imread') || contains(err.identifier, 'imagesci')
    msg = 'The image could not be read. Use PNG, JPG, TIF, BMP or GIF.';
elseif strcmp(err.identifier, 'MATLAB:json:ExpectedValue') || contains(err.identifier, 'json')
    msg = 'The request sent to MATLAB was malformed.';
else
    msg = sprintf('MATLAB error: %s', err.message);
end
end
