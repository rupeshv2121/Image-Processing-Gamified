function BW = globalThreshold(I, T)
%GLOBALTHRESHOLD Single global threshold:  g(x,y) = 1 if f(x,y) > T, else 0.
%   T is in [0,1]. One threshold for the whole image - works when the
%   object and background histogram modes are well separated.

if nargin < 2 || isempty(T), T = 0.5; end
if T < 0 || T > 1, error('ImageLab:invalidParameter', 'Threshold must be between 0 and 1.'); end
BW = toGray(I) > T;
end
