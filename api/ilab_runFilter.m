function [J, info] = ilab_runFilter(I, name, k, params, impl)
%ILAB_RUNFILTER Run any ImageLab spatial filter by name.
%   [J, info] = ilab_runFilter(I, name, k, params, impl)
%
%   name   : mean | weighted | gaussian | median | min | max | midpoint |
%            order | alphatrimmed | laplacian | sobel | prewitt
%   k      : neighbourhood size (odd)
%   params : struct (sigma, rank, d)
%   impl   : 'toolbox' (fast / Image Processing Toolbox) or 'manual' (loops)
%
%   info.kernel         kernel matrix for linear filters ([] otherwise)
%   info.linear         true for linear filters
%   info.implementation human readable description of the code path used
%   info.functionName   the MATLAB function that did the work

if nargin < 3 || isempty(k), k = 3; end
if nargin < 4 || isempty(params), params = struct(); end
if nargin < 5 || isempty(impl), impl = 'toolbox'; end
manual = strcmpi(impl, 'manual');
sigma = param(params, 'sigma', max(k / 6, 0.5));
validateKernelSize(k);

info = struct('kernel', [], 'linear', true, 'implementation', '', ...
    'functionName', '', 'signed', false);

switch lower(name)
    case 'mean'
        info.kernel = ones(k) / k^2;
        [J, info.functionName] = pick(manual, @() meanFilterManual(I, k), 'meanFilterManual', ...
                                              @() meanFilter(I, k), 'meanFilter');
    case 'weighted'
        info.kernel = weightedMeanKernel(k);
        [J, info.functionName] = pick(manual, @() manualFilterLoop(I, info.kernel), 'manualFilterLoop', ...
                                              @() weightedMeanFilter(I, k), 'weightedMeanFilter');
    case 'gaussian'
        info.kernel = gaussianKernel(k, sigma);
        [J, info.functionName] = pick(manual, @() gaussianFilterManual(I, k, sigma), 'gaussianFilterManual', ...
                                              @() gaussianFilter(I, k, sigma), 'gaussianFilter');
    case 'median'
        info.linear = false;
        [J, info.functionName] = pick(manual, @() medianFilterManual(I, k), 'medianFilterManual', ...
                                              @() medianFilter(I, k), 'medianFilter');
    case 'min'
        info.linear = false;
        [J, info.functionName] = pick(manual, @() orderStatisticFilterManual(I, k, 1), 'orderStatisticFilterManual', ...
                                              @() minFilter(I, k), 'minFilter');
    case 'max'
        info.linear = false;
        [J, info.functionName] = pick(manual, @() orderStatisticFilterManual(I, k, k*k), 'orderStatisticFilterManual', ...
                                              @() maxFilter(I, k), 'maxFilter');
    case 'midpoint'
        info.linear = false;
        [J, info.functionName] = pick(manual, ...
            @() (orderStatisticFilterManual(I, k, 1) + orderStatisticFilterManual(I, k, k*k)) / 2, 'orderStatisticFilterManual', ...
            @() midpointFilter(I, k), 'midpointFilter');
    case 'order'
        info.linear = false;
        rank = round(param(params, 'rank', ceil(k*k / 2)));
        [J, info.functionName] = pick(manual, @() orderStatisticFilterManual(I, k, rank), 'orderStatisticFilterManual', ...
                                              @() orderStatisticFilter(I, k, rank), 'orderStatisticFilter');
    case 'alphatrimmed'
        info.linear = false;
        d = round(param(params, 'd', 2));
        J = alphaTrimmedMeanFilter(I, k, d);
        info.functionName = 'alphaTrimmedMeanFilter';
    case 'laplacian'
        info.kernel = [0 1 0; 1 -4 1; 0 1 0];
        info.signed = true;
        [J, info.functionName] = pick(manual, @() manualFilterLoop(I, info.kernel), 'manualFilterLoop', ...
                                              @() filter2D(I, info.kernel), 'filter2D');
    case 'sobel'
        info.kernel = [-1 0 1; -2 0 2; -1 0 1];
        [J, info.functionName] = pick(manual, @() sobelManual(I), 'sobelManual', ...
            @() hypot(filter2D(toGray(I), info.kernel), filter2D(toGray(I), info.kernel')), 'filter2D');
        J = min(J / 4, 1);
    case 'prewitt'
        info.kernel = [-1 0 1; -1 0 1; -1 0 1];
        [J, info.functionName] = pick(manual, @() prewittManual(I), 'prewittManual', ...
            @() hypot(filter2D(toGray(I), info.kernel), filter2D(toGray(I), info.kernel')), 'filter2D');
        J = min(J / 3, 1);
    otherwise
        error('ImageLab:invalidParameter', 'Unknown filter "%s".', name);
end

if manual
    info.implementation = 'Manual implementation (explicit loops)';
elseif hasIPT()
    info.implementation = 'MATLAB Image Processing Toolbox';
else
    info.implementation = 'Vectorised base MATLAB (toolbox not installed)';
end
end

function [J, fname] = pick(manual, manualFn, manualName, fastFn, fastName)
if manual
    J = manualFn(); fname = manualName;
else
    J = fastFn(); fname = fastName;
end
end

function v = param(s, name, default)
if isstruct(s) && isfield(s, name) && ~isempty(s.(name)), v = double(s.(name)); else, v = default; end
end
