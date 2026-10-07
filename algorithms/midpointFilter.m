function J = midpointFilter(I, k)
%MIDPOINTFILTER Midpoint filter: (min + max) / 2 of each neighbourhood.
%   Combines order statistics with averaging. Works well for randomly
%   distributed noise such as Gaussian or uniform noise, but performs badly
%   on salt & pepper noise (the extremes ARE the noise).

if nargin < 2 || isempty(k), k = 3; end
J = (minFilter(I, k) + maxFilter(I, k)) / 2;
end
