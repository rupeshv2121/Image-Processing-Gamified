function [J, limits] = contrastStretch(I, lowIn, highIn)
%CONTRASTSTRETCH Linear contrast stretching (like imadjust).
%   Maps the input range [lowIn, highIn] linearly to [0, 1]:
%
%       s = (r - lowIn) / (highIn - lowIn),   clipped to [0,1]
%
%   With no limits given, lowIn/highIn are the 1st and 99th percentiles of
%   the intensities (the same rule as stretchlim), so 1% of pixels saturate
%   at each end.
%       J = imadjust(I, stretchlim(I), []);   % toolbox

I = toDouble(I);
if nargin < 2 || isempty(lowIn) || nargin < 3 || isempty(highIn)
    sorted = sort(reshape(toGray(I), [], 1));
    n = numel(sorted);
    lowIn  = sorted(max(1, round(0.01 * n)));
    highIn = sorted(max(1, round(0.99 * n)));
end
if highIn <= lowIn
    error('ImageLab:invalidParameter', 'The high input limit must be greater than the low limit.');
end
limits = [lowIn highIn];

if hasIPT()
    J = imadjust(I, repmat(limits', 1, size(I, 3)), []);
else
    J = min(max((I - lowIn) / (highIn - lowIn), 0), 1);
end
end
