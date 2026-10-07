function J = applyBlock(I, block, params)
%APPLYBLOCK Apply one processing block (used by the pipeline and challenge games).
%   block: mean | median | gaussian | min | max | midpoint | weighted |
%          alphatrimmed | laplacian | unsharp | highboost | histeq | clahe |
%          gamma | stretch | none
%   params: optional struct with k, sigma, gamma, amount

if nargin < 3 || isempty(params), params = struct(); end
k = round(p(params, 'k', 3));
switch lower(block)
    case 'mean',         J = meanFilter(I, k);
    case 'weighted',     J = weightedMeanFilter(I, k);
    case 'gaussian',     J = gaussianFilter(I, max(k, 5), p(params, 'sigma', 1));
    case 'median',       J = medianFilter(I, k);
    case 'min',          J = minFilter(I, k);
    case 'max',          J = maxFilter(I, k);
    case 'midpoint',     J = midpointFilter(I, k);
    case 'alphatrimmed', J = alphaTrimmedMeanFilter(I, k, 2);
    case 'laplacian',    J = laplacianSharpen(I, 0.2, p(params, 'amount', 0.7));
    case 'unsharp',      J = unsharpMask(I, p(params, 'sigma', 1.5), p(params, 'amount', 1));
    case 'highboost',    J = highBoostFilter(I, p(params, 'amount', 2), k);
    case 'histeq',       J = histogramEqualization(I);
    case 'clahe',        J = clahe(I, [8 8], 0.01);
    case 'gamma',        J = gammaCorrection(I, p(params, 'gamma', 0.6));
    case 'stretch',      J = contrastStretch(I);
    case 'none',         J = toDouble(I);
    otherwise
        error('ImageLab:invalidParameter', 'Unknown processing block "%s".', block);
end
end

function v = p(s, name, default)
if isstruct(s) && isfield(s, name) && ~isempty(s.(name)), v = double(s.(name)); else, v = default; end
end
