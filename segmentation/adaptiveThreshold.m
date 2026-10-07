function [BW, localMean] = adaptiveThreshold(I, windowSize, offset)
%ADAPTIVETHRESHOLD Local (adaptive) thresholding with the neighbourhood mean.
%       T(x,y) = mean of the windowSize x windowSize neighbourhood - offset
%       g(x,y) = 1 if f(x,y) > T(x,y)
%   Handles uneven illumination where a single global threshold fails.

if nargin < 2 || isempty(windowSize), windowSize = 15; end
if nargin < 3 || isempty(offset), offset = 0.02; end
G = toGray(I);
localMean = meanFilter(G, windowSize);
BW = G > localMean - offset;
end
