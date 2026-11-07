function data = workspaceOps(op, p)
%WORKSPACEOPS Image operations of the Workspace: one step, a pipeline, or a comparison.
%   data = workspaceOps(op, p) - called by ilab_dispatch for:
%   wsApply    p.id, p.steps = [{op, ...parameters}], p.intermediate
%              -> the result (and every intermediate image) with MSE / PSNR vs the input
%   wsCompare  p.id, p.variants = [{label, steps}]
%              -> one result per variant, all from the same input
%
%   A step is a struct with the field "op" (see applyStep below) and its
%   parameters; missing parameters take the defaults of the core functions.

switch op
    case 'wsApply'
        I = ilab_img(p);
        intermediate = isequal(ilab_param(p, 'intermediate', false), true);
        [J, steps, ms] = runSteps(I, asCell(ilab_param(p, 'steps', {})), intermediate);
        data = result(I, J, ms);
        data.steps = steps;

    case 'wsCompare'
        I = ilab_img(p);
        variants = asCell(ilab_param(p, 'variants', {}));
        if isempty(variants) || numel(variants) > 8
            error('ImageLab:invalidParameter', 'Compare 1 to 8 variants.');
        end
        data = cell(1, numel(variants));
        for v = 1:numel(variants)
            [J, ~, ms] = runSteps(I, asCell(variants{v}.steps), false);
            r = result(I, J, ms);
            r.label = char(variants{v}.label);
            data{v} = r;
        end

    otherwise
        error('ImageLab:unknownOperation', 'Unknown operation "%s".', op);
end
end

% =========================================================================
function [J, out, ms] = runSteps(I, steps, intermediate)
if isempty(steps) || numel(steps) > 12
    error('ImageLab:invalidParameter', 'Use 1 to 12 operations.');
end
J = I;
out = cell(1, numel(steps) * intermediate);
t = tic;
for k = 1:numel(steps)
    J = applyStep(J, steps{k});
    if intermediate
        out{k} = struct('op', char(steps{k}.op), 'id', ilab_put(J, 'step'));
    end
end
ms = 1000 * toc(t);
end

function r = result(I, J, ms)
r = struct('id', ilab_put(J, 'ws'), 'info', ilab_describe(J), 'timeMs', ms, 'mse', [], 'psnr', []);
if isequal(size(I), size(J))
    q = imageQuality(J, I);
    r.mse = q.mse; r.psnr = q.psnr;
end
end

function J = applyStep(I, s)
% One Workspace operation. Every one is a function of this project (core/,
% algorithms/, histogram/, noise/, segmentation/, color/, fundamentals/).
op = lower(char(s.op));
k = oddSize(num(s, 'k', 3));
switch op
    % ---- intensity transformations (Unit II)
    case 'negative',   J = negativeTransform(I);
    case 'log',        J = logTransform(I, num(s, 'c', 10));
    case 'gamma',      J = gammaCorrection(I, num(s, 'gamma', 0.5));
    case 'stretch',    J = contrastStretch(I);
    case 'piecewise',  J = piecewiseLinear(I, num(s, 'r1', 0.3), num(s, 's1', 0.1), num(s, 'r2', 0.7), num(s, 's2', 0.9));
    case 'slice',      J = grayLevelSlicing(I, num(s, 'a', 0.4), num(s, 'b', 0.7), txt(s, 'mode', 'preserve'));
    case 'quantize',   J = quantizeImage(I, round(num(s, 'bits', 3)));
    case 'grayscale',  J = toGray(I);
    case 'histeq',     J = histogramEqualization(I);
    % ---- smoothing (linear and order-statistic)
    case 'mean',       J = meanFilter(I, k);
    case 'weighted',   J = weightedMeanFilter(I, k);
    case 'gaussian',   J = gaussianFilter(I, max(k, 3), num(s, 'sigma', 1));
    case 'median',     J = medianFilter(I, k);
    case 'min',        J = minFilter(I, k);
    case 'max',        J = maxFilter(I, k);
    case 'midpoint',   J = midpointFilter(I, k);
    % ---- restoration filters (Unit III)
    case 'geometric',  J = geometricMeanFilter(I, k);
    case 'harmonic',   J = harmonicMeanFilter(I, k);
    case 'contraharmonic', J = contraharmonicMeanFilter(I, k, num(s, 'q', 1.5));
    case 'alphatrimmed',   J = alphaTrimmedMeanFilter(I, k, 2 * round(num(s, 'd', 2) / 2));
    case 'adaptivemedian', J = adaptiveMedianFilter(I, oddSize(num(s, 'smax', 7)));
    case 'adaptivelocal',  J = adaptiveLocalFilter(I, k);
    % ---- sharpening
    case 'laplacian',  J = laplacianSharpen(I, 0.2, num(s, 'amount', 0.7));
    case 'unsharp',    J = unsharpMask(I, num(s, 'sigma', 1.5), num(s, 'amount', 1));
    case 'highboost',  J = highBoostFilter(I, num(s, 'boost', 2), k);
    case 'gradient',   J = gradientSharpen(I, txt(s, 'operator', 'sobel'), num(s, 'weight', 0.5));
    % ---- noise models
    case 'noise'
        params = struct('mean', 0, 'variance', num(s, 'variance', 0.01), 'density', num(s, 'density', 0.05));
        J = addNoise(I, txt(s, 'type', 'gaussian'), params);
    % ---- edges and segmentation (Unit IV)
    case 'edges',      J = double(edgeDetect(I, txt(s, 'method', 'sobel')));
    case 'threshold',  J = double(globalThreshold(toGray(I), num(s, 't', 0.5)));
    case 'otsu',       J = double(otsuThreshold(toGray(I)));
    case 'adaptive',   J = double(adaptiveThreshold(toGray(I), oddSize(num(s, 'window', 15)), num(s, 'offset', 0.02)));
    % ---- colour
    case 'pseudocolor', J = intensitySlicing(I, round(num(s, 'slices', 8)), txt(s, 'map', 'jet'));
    otherwise
        error('ImageLab:invalidParameter', 'Unknown workspace operation "%s".', op);
end
J = min(max(toDouble(J), 0), 1);
end

% =========================================================================
function c = asCell(v)
if isstruct(v), c = num2cell(v); elseif iscell(v), c = v; else, c = {}; end
end

function v = num(s, name, default)
if isstruct(s) && isfield(s, name) && ~isempty(s.(name)) && isnumeric(s.(name)), v = double(s.(name)); else, v = default; end
end

function v = txt(s, name, default)
if isstruct(s) && isfield(s, name) && ~isempty(s.(name)), v = char(s.(name)); else, v = default; end
end

function k = oddSize(k)
k = max(3, min(15, round(k)));
if mod(k, 2) == 0, k = k + 1; end
end
