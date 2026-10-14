function BW = imbinarize(I, T)
%IMBINARIZE Code Lab stand-in for the toolbox imbinarize (global threshold).
%   imbinarize(I) uses Otsu's threshold; imbinarize(I, T) a fixed level.
G = toGray(I);
if nargin < 2 || (ischar(T) && strcmpi(T, 'global')), T = graythresh(G); end
if ischar(T)
    error('ImageLab:shim', 'imbinarize (Code Lab version) only supports global thresholds.');
end
BW = G > T;
end
