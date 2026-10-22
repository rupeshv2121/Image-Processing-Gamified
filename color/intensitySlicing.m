function [J, colors, edges] = intensitySlicing(I, nSlices, mapName)
%INTENSITYSLICING Pseudocolour by intensity (density) slicing.
%   [J, colors, edges] = intensitySlicing(I, nSlices, mapName)
%   The grey-level range is cut by nSlices - 1 planes into nSlices equal
%   intervals, and every interval gets its own colour:
%       f(x,y) = c_k   if  l_(k-1) <= f(x,y) < l_k
%   mapName: 'jet' | 'hot' | 'parula' | 'hsv' | 'cool' (base MATLAB colormaps)
%
%   People can tell apart thousands of colours but only a few dozen grey
%   levels, so slicing reveals small intensity differences (X-ray
%   inspection, rainfall and temperature maps).
%       imshow(G, []); colormap(jet(n))      % display equivalent

if nargin < 2 || isempty(nSlices), nSlices = 8; end
if nargin < 3 || isempty(mapName), mapName = 'jet'; end
nSlices = max(2, min(64, round(nSlices)));
if ~any(strcmpi(mapName, {'jet', 'hot', 'parula', 'hsv', 'cool'}))
    error('ImageLab:invalidParameter', 'Unknown colour map "%s".', mapName);
end
colors = feval(lower(mapName), nSlices);
G = toGray(I);
edges = (0:nSlices) / nSlices;
k = min(floor(G * nSlices) + 1, nSlices);         % slice index of every pixel
J = reshape(colors(k(:), :), [size(G) 3]);
end
