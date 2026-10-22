function h = targetHistogram(shape, m, s)
%TARGETHISTOGRAM A desired 256-bin histogram for histogram matching.
%   h = targetHistogram(shape, m, s)
%   shape: 'gaussian'  bell curve with mean m and standard deviation s (0..1)
%          'bimodal'   two bells at m and 1 - m, each with spread s
%          'uniform'   flat (matching to it = histogram equalisation)
%          'rampup'    more bright pixels than dark ones
%          'rampdown'  more dark pixels than bright ones
%   h is normalised to sum to 1.

if nargin < 2 || isempty(m), m = 0.5; end
if nargin < 3 || isempty(s), s = 0.15; end
s = max(s, 0.01);
r = (0:255)' / 255;
switch lower(shape)
    case 'gaussian', h = exp(-(r - m).^2 / (2 * s^2));
    case 'bimodal',  h = exp(-(r - m).^2 / (2 * s^2)) + exp(-(r - (1 - m)).^2 / (2 * s^2));
    case 'uniform',  h = ones(256, 1);
    case 'rampup',   h = 0.05 + r;
    case 'rampdown', h = 1.05 - r;
    otherwise
        error('ImageLab:invalidParameter', 'Unknown histogram shape "%s".', shape);
end
h = h / sum(h);
end
