function data = filterOps(op, p)
%FILTEROPS Spatial filters, kernels, correlation / convolution, sharpening, comparison.
%   data = filterOps(op, p) - called by ilab_dispatch for:
%   filter, gaussianKernel, kernelPreset, kernelPresets, applyKernel,
%   correlation, sharpen, compare

switch op
    case 'filter'
        data = runFilters(ilab_img(p), p);

    case 'gaussianKernel'
        k = ilab_param(p, 'k', 5); sigma = ilab_param(p, 'sigma', 1);
        G = gaussianKernel(k, sigma);
        diffToolbox = [];
        if hasIPT(), diffToolbox = max(max(abs(G - fspecial('gaussian', k, sigma)))); end
        data = struct('kernel', ilab_mat(G), 'sum', sum(G(:)), 'diffToolbox', diffToolbox);

    case 'kernelPreset'
        [K, description] = kernelPresets(char(ilab_param(p, 'name', 'mean')), ilab_param(p, 'size', 3));
        data = struct('kernel', ilab_mat(K), 'description', description);

    case 'kernelPresets'                    % several at once (the kernel quiz)
        names = cellstr(ilab_param(p, 'names', kernelPresets()));
        data = cell(1, numel(names));
        for k = 1:numel(names)
            [K, description] = kernelPresets(names{k}, ilab_param(p, 'size', 3));
            data{k} = struct('name', names{k}, 'kernel', ilab_mat(K), 'description', description);
        end

    case 'applyKernel'
        data = applyKernel(ilab_img(p), p);

    case 'correlation'
        data = correlationSteps(p);

    case 'sharpen'
        data = sharpen(ilab_img(p), p);

    case 'compare'
        data = compareFilters(ilab_img(p), p);

    otherwise
        error('ImageLab:unknownOperation', 'Unknown operation "%s".', op);
end
end

% =========================================================================
function data = runFilters(I, p)
% One filter with the toolbox and/or the manual implementation, with timings
name = char(ilab_param(p, 'name', 'mean'));
k = ilab_param(p, 'k', 3);
impl = char(ilab_param(p, 'impl', 'toolbox'));
if strcmp(impl, 'both'), impls = {'toolbox', 'manual'}; else, impls = {impl}; end
ref = [];
if ~isempty(ilab_param(p, 'refId', '')), ref = ilab_img(p, 'refId'); end
runs = cell(1, numel(impls));
outputs = cell(1, numel(impls));
for n = 1:numel(impls)
    tic;
    [J, info] = ilab_runFilter(I, name, k, p, impls{n});
    t = 1000 * toc;
    if info.signed, shown = scaleToUnit(J); else, shown = J; end
    r = struct('impl', impls{n}, 'id', ilab_put(shown, name), 'timeMs', t, ...
        'implementation', info.implementation, 'functionName', info.functionName, ...
        'mse', [], 'psnr', [], 'ssim', []);
    if ~isempty(ref) && isequal(size(J), size(ref))
        q = imageQuality(J, ref);
        r.mse = q.mse; r.psnr = q.psnr; r.ssim = q.ssim;
    end
    runs{n} = r;
    outputs{n} = J;
end
data = struct('runs', {runs}, 'linear', info.linear, 'kernel', ilab_matOrEmpty(info.kernel), 'maxDifference', []);
if numel(outputs) == 2
    data.maxDifference = max(abs(outputs{1}(:) - outputs{2}(:)));
end
end

function data = applyKernel(I, p)
% Kernel Playground: any user kernel, with a display mode for signed results
K = validateKernel(double(ilab_param(p, 'kernel', ones(3) / 9)));
if strcmp(char(ilab_param(p, 'mode', 'correlation')), 'convolution'), K = rot90(K, 2); end
tic;
J = filter2D(I, K, char(ilab_param(p, 'padMode', 'replicate')));
t = 1000 * toc;
display = char(ilab_param(p, 'display', 'auto'));
if strcmp(display, 'auto')
    if abs(sum(K(:))) < 1e-9, display = 'abs'; else, display = 'clip'; end
end
switch display
    case 'scale', shown = scaleToUnit(J);
    case 'abs',   shown = min(abs(J) / max(max(abs(J(:))), eps), 1);
    otherwise,    shown = min(max(J, 0), 1);
end
data = struct('id', ilab_put(shown, 'kernel'), 'timeMs', t, 'kernelSum', sum(K(:)), ...
    'display', display, 'symmetric', isequal(K, rot90(K, 2)), ...
    'outputRange', [min(J(:)) max(J(:))]);
end

function data = correlationSteps(p)
% Step-by-step correlation / convolution of a small matrix, checked against filter2 / conv2
A = double(ilab_param(p, 'matrix', magic(3)));
K = validateKernel(double(ilab_param(p, 'kernel', ones(3))));
if numel(A) > 144
    error('ImageLab:invalidMatrix', 'Use an input matrix of at most 12x12 for the step-by-step view.');
end
mode = char(ilab_param(p, 'mode', 'correlation'));
shape = char(ilab_param(p, 'shape', 'same'));
padMode = char(ilab_param(p, 'padMode', 'zero'));
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
end

function data = sharpen(I, p)
method = char(ilab_param(p, 'method', 'laplacian'));
kernel = [];
switch method
    case 'laplacian'
        [S, D, kernel] = laplacianSharpen(I, ilab_param(p, 'alpha', 0.2), ilab_param(p, 'strength', 1), ...
            logical(ilab_param(p, 'eight', false)));
        D = scaleToUnit(toGray(D));
    case {'sobel', 'prewitt'}
        [S, D] = gradientSharpen(I, method, ilab_param(p, 'weight', 0.5));
        D = min(D / max(max(D(:)), eps), 1);
        if strcmp(method, 'sobel'), kernel = [-1 0 1; -2 0 2; -1 0 1]; else, kernel = [-1 0 1; -1 0 1; -1 0 1]; end
    case 'unsharp'
        [S, D] = unsharpMask(I, ilab_param(p, 'sigma', 1.5), ilab_param(p, 'amount', 1));
        D = scaleToUnit(toGray(D));
    case 'highboost'
        k = ilab_param(p, 'k', 3);
        boost = ilab_param(p, 'boost', 2);
        [S, D] = highBoostFilter(I, boost, k);
        D = scaleToUnit(toGray(D));
        kernel = -ones(k) / k^2;
        c = (k + 1) / 2;
        kernel(c, c) = kernel(c, c) + 1 + boost;
    otherwise
        error('ImageLab:invalidParameter', 'Unknown sharpening method "%s".', method);
end
data = struct('id', ilab_put(S, 'sharp'), 'detailId', ilab_put(D, 'detail'), ...
    'kernel', ilab_matOrEmpty(kernel), 'sharpnessBefore', sharpness(I), 'sharpnessAfter', sharpness(S));
end

function s = sharpness(I)
% Mean gradient magnitude (Sobel / 8)
G = toGray(I);
s = mean(hypot(filter2D(G, [-1 0 1; -2 0 2; -1 0 1] / 8), filter2D(G, [-1 -2 -1; 0 0 0; 1 2 1] / 8)), 'all');
end

function data = compareFilters(I, p)
% Add noise, run several filters, rank them by PSNR / SSIM with MATLAB bar charts
ilab_seed(p);
noiseType = char(ilab_param(p, 'noiseType', 'saltpepper'));
if strcmp(noiseType, 'none'), N = I; else, N = addNoise(I, noiseType, p); end
qn = imageQuality(N, I);
filters = ilab_param(p, 'filters', struct('name', {'mean', 'median', 'gaussian', 'min'}, 'k', {3, 3, 5, 3}));
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
        'id', ilab_put(J, f.name), 'mse', q.mse, 'psnr', q.psnr, 'ssim', q.ssim, 'timeMs', t);
end
[~, best] = max(psnrs);
data = struct('cleanId', ilab_put(I, 'clean'), 'noisyId', ilab_put(N, 'noisy'), ...
    'noisy', qn, 'results', {results}, 'best', labels{best}, ...
    'charts', struct('psnr', ilab_barChart(psnrs, labels, 'PSNR (higher is better)', 'PSNR (dB)'), ...
                     'ssim', ilab_barChart(ssims, labels, 'SSIM (higher is better)', 'SSIM'), ...
                     'time', ilab_barChart(times, labels, 'Processing time', 'Time (ms)')));
end
