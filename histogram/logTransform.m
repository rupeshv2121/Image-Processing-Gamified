function J = logTransform(I, k)
%LOGTRANSFORM Logarithmic transformation:  s = c * log(1 + k*r).
%   c = 1/log(1+k) keeps the output in [0,1]. Expands dark values and
%   compresses bright values - useful for images with a huge dynamic range.
%   Larger k = stronger effect.

if nargin < 2 || isempty(k), k = 10; end
if k <= 0, error('ImageLab:invalidParameter', 'k must be positive.'); end
c = 1 / log(1 + k);
J = c * log(1 + k * toDouble(I));
end
