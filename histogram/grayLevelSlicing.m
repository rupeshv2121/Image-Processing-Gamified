function J = grayLevelSlicing(I, a, b, mode, level)
%GRAYLEVELSLICING Intensity-level slicing: highlight the grey levels in [a, b].
%   J = grayLevelSlicing(I, a, b, mode, level)
%   a, b  - the range of interest (0..1)
%   mode  - 'binary'   range -> level, everything else -> 0.1 (dark)
%           'preserve' range -> level, everything else unchanged
%   level - brightness given to the range (default 1, white)
%
%   Used to make features with a known intensity stand out, e.g. water
%   in satellite images or blood vessels in angiograms.
%       J = G; J(G >= a & G <= b) = 1;              % preserve
%       J = 0.1 * ones(size(G)); J(G >= a & G <= b) = 1;   % binary

if nargin < 4 || isempty(mode), mode = 'binary'; end
if nargin < 5 || isempty(level), level = 1; end
if a > b, [a, b] = deal(b, a); end
G = toGray(I);
inRange = G >= a & G <= b;
switch lower(mode)
    case 'binary',   J = 0.1 * ones(size(G));
    case 'preserve', J = G;
    otherwise
        error('ImageLab:invalidParameter', 'Unknown slicing mode "%s".', mode);
end
J(inRange) = level;
end
