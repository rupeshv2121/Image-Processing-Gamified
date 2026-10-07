function J = meanFilter(I, k)
%MEANFILTER Arithmetic mean (box / averaging) filter - TOOLBOX version.
%   J = meanFilter(I, k) replaces every pixel by the average of its k-by-k
%   neighbourhood. It is a LINEAR smoothing filter: it reduces Gaussian noise
%   but also blurs edges, and it spreads impulse (salt & pepper) noise
%   instead of removing it.
%
%       h = fspecial('average',[k k]);    % every weight = 1/k^2
%       J = imfilter(I,h,'replicate');
%
%   Without the Image Processing Toolbox the same kernel is applied with
%   filter2D (conv2-based). See meanFilterManual for the loop version.

if nargin < 2 || isempty(k), k = 3; end
validateKernelSize(k);
I = toDouble(I);

if hasIPT()
    h = fspecial('average', [k k]);
    J = imfilter(I, h, 'replicate');
else
    h = ones(k) / k^2;
    J = filter2D(I, h, 'replicate');
end
end
