function J = alphaTrimmedMeanFilter(I, k, d)
%ALPHATRIMMEDMEANFILTER Alpha-trimmed mean filter (restoration filter).
%   Sorts each k-by-k window, discards the d/2 lowest and d/2 highest values
%   and averages the rest:
%       d = 0        -> mean filter
%       d = k^2 - 1  -> median filter
%   Useful for images with a MIXTURE of Gaussian and salt & pepper noise.

if nargin < 2 || isempty(k), k = 3; end
if nargin < 3 || isempty(d), d = 2; end
validateKernelSize(k);
N = k * k;
if d < 0 || d >= N || mod(d, 2) ~= 0
    error('ImageLab:invalidParameter', 'd must be an even number between 0 and %d.', N - 1);
end
J = applyPerChannel(@(X) trimmed(X, k, d), I);
end

function Y = trimmed(X, k, d)
S = sort(neighborhoodStack(X, k, k, 'symmetric'), 3);
Y = mean(S(:,:,d/2+1:end-d/2), 3);
end
