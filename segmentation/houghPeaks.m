function peaks = houghPeaks(H, numPeaks, threshold, nhood)
%HOUGHPEAKS Strongest cells of a Hough accumulator.
%   peaks = houghPeaks(H, numPeaks, threshold, nhood) returns an n-by-2
%   list of [rhoIndex thetaIndex]. Repeatedly takes the maximum of H and
%   clears an nhood = [rows cols] neighbourhood around it, so one thick
%   line is not reported several times. Cells below threshold (votes)
%   are ignored.
%       peaks = houghpeaks(H, numPeaks, 'Threshold', T);    % toolbox

if nargin < 2 || isempty(numPeaks), numPeaks = 5; end
if nargin < 3 || isempty(threshold), threshold = 0.3 * max(H(:)); end
if nargin < 4 || isempty(nhood)
    nhood = max(2 * ceil(size(H) / 100) + 1, 3);
end
half = floor(nhood / 2);
peaks = zeros(0, 2);
H = double(H);
for n = 1:numPeaks
    [v, idx] = max(H(:));
    if v < threshold || v <= 0, break; end
    [r, t] = ind2sub(size(H), idx);
    peaks(end + 1, :) = [r t]; %#ok<AGROW>
    H(max(1, r - half(1)):min(end, r + half(1)), max(1, t - half(2)):min(end, t + half(2))) = 0;
end
end
