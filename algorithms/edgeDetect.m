function [BW, threshUsed, mag, implementation] = edgeDetect(I, method, thresh, sigma)
%EDGEDETECT Binary edge map with Roberts, Prewitt, Sobel, Canny or LoG.
%   [BW, threshUsed, mag, implementation] = edgeDetect(I, method, thresh, sigma)
%
%   Uses edge() from the Image Processing Toolbox when available, otherwise
%   the manual implementations in this folder. Leave thresh empty for an
%   automatic threshold. mag is a [0,1] edge-strength image for display.
%
%   method : 'roberts' | 'prewitt' | 'sobel' | 'canny' | 'log'

if nargin < 2 || isempty(method), method = 'sobel'; end
if nargin < 3, thresh = []; end
if nargin < 4 || isempty(sigma)
    if strcmpi(method, 'canny'), sigma = sqrt(2); else, sigma = 2; end
end
G = toGray(I);
method = lower(method);
if ~ismember(method, {'roberts', 'prewitt', 'sobel', 'canny', 'log'})
    error('ImageLab:invalidParameter', 'Unknown edge detector "%s".', method);
end

% Edge-strength image (for display) from the manual operators
switch method
    case 'roberts', mag = robertsManual(G) / 2;
    case 'prewitt', mag = hypot(filter2D(G, [-1 0 1; -1 0 1; -1 0 1] / 6), ...
                                filter2D(G, [-1 -1 -1; 0 0 0; 1 1 1] / 6));
    otherwise,      mag = hypot(filter2D(G, [-1 0 1; -2 0 2; -1 0 1] / 8), ...
                                filter2D(G, [-1 -2 -1; 0 0 0; 1 2 1] / 8));
end

if hasIPT()
    implementation = 'toolbox';
    switch method
        case {'canny', 'log'}
            [BW, threshUsed] = edge(G, method, thresh, sigma);
        otherwise
            [BW, threshUsed] = edge(G, method, thresh);
    end
else
    implementation = 'manual';
    switch method
        case 'canny'
            if isempty(thresh)
                [BW, threshUsed] = cannyManual(G, sigma);
            elseif isscalar(thresh)
                [BW, threshUsed] = cannyManual(G, sigma, 0.4 * thresh, thresh);
            else
                [BW, threshUsed] = cannyManual(G, sigma, thresh(1), thresh(2));
            end
        case 'log'
            [BW, threshUsed] = logEdgeManual(G, sigma, thresh);
        otherwise
            [BW, threshUsed] = gradientEdges(mag, thresh);
    end
end
mag = min(mag / max(max(mag(:)), eps), 1);
end

function [BW, t] = gradientEdges(mag, t)
% Threshold the gradient magnitude and thin the edges (as edge() does).
b = mag.^2;
if isempty(t)
    cutoff = 4 * mean(b(:));          % same automatic rule as edge()
    t = sqrt(cutoff);
else
    cutoff = t^2;
end
[h, w] = size(b);
P = padImage(b, 1, 1, 'zero');
left = P(2:h+1, 1:w);  right = P(2:h+1, 3:w+2);
up   = P(1:h, 2:w+1);  down  = P(3:h+2, 2:w+1);
localMax = (b > left & b >= right) | (b > up & b >= down);
BW = b > cutoff & localMax;
end
