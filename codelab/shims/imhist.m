function [counts, x] = imhist(I, n)
%IMHIST Code Lab stand-in for the toolbox imhist (base MATLAB).
%   imhist(I) draws the 256-bin histogram; [counts, x] = imhist(I) returns it.

if nargin < 2, n = 256; end
if islogical(I), n = 2; end
X = toDouble(I);
idx = min(floor(X(:) * n), n - 1) + 1;
c = accumarray(idx, 1, [n 1]);
centres = linspace(0, 1, n)';
if isa(I, 'uint8'), centres = round(centres * 255); end
if nargout == 0
    stem(gca, centres, c, 'Marker', 'none', 'Color', [0.12 0.35 0.65]);
    xlim(gca, [centres(1) centres(end)]);
    xlabel(gca, 'Grey level'); ylabel(gca, 'Pixels');
else
    counts = c; x = centres;
end
end
