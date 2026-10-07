function [BW, thresh, response] = logEdgeManual(I, sigma, thresh)
%LOGEDGEMANUAL Laplacian-of-Gaussian (Marr-Hildreth) edge detector.
%   1. Filter with the LoG kernel (smooth + second derivative).
%   2. Edges are ZERO CROSSINGS of the response: places where it changes
%      sign between neighbouring pixels and the jump is larger than thresh.
%   Default thresh = 0.75 * mean(|response|), as in edge(I,'log').

if nargin < 2 || isempty(sigma), sigma = 2; end
G = toGray(I);
k = min(2 * ceil(3 * sigma) + 1, 31);
response = filter2D(G, logKernel(k, sigma), 'replicate');
if nargin < 3 || isempty(thresh)
    thresh = 0.75 * mean(abs(response(:)));
end

[h, w] = size(response);
BW = false(h, w);
% horizontal neighbours
a = response(:, 1:end-1); b = response(:, 2:end);
zc = (a .* b < 0) & abs(a - b) > thresh;
BW(:, 1:end-1) = BW(:, 1:end-1) | (zc & abs(a) <= abs(b));
BW(:, 2:end)   = BW(:, 2:end)   | (zc & abs(b) <  abs(a));
% vertical neighbours
a = response(1:end-1, :); b = response(2:end, :);
zc = (a .* b < 0) & abs(a - b) > thresh;
BW(1:end-1, :) = BW(1:end-1, :) | (zc & abs(a) <= abs(b));
BW(2:end, :)   = BW(2:end, :)   | (zc & abs(b) <  abs(a));
end
