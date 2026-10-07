function [BW, R, K] = lineDetection(I, direction, T)
%LINEDETECTION Detect 1-pixel-thick lines in a given direction.
%   Masks (Gonzalez & Woods):
%     horizontal [-1 -1 -1; 2 2 2; -1 -1 -1]
%     +45        [ 2 -1 -1; -1 2 -1; -1 -1 2]
%     vertical   [-1 2 -1; -1 2 -1; -1 2 -1]
%     -45        [-1 -1 2; -1 2 -1; 2 -1 -1]
%   The preferred direction is weighted with the larger coefficient (2).
%   Keep pixels with R >= T * max(R).

if nargin < 2 || isempty(direction), direction = 'horizontal'; end
if nargin < 3 || isempty(T), T = 0.5; end
switch lower(direction)
    case 'horizontal', K = [-1 -1 -1; 2 2 2; -1 -1 -1];
    case '+45',        K = [2 -1 -1; -1 2 -1; -1 -1 2];
    case 'vertical',   K = [-1 2 -1; -1 2 -1; -1 2 -1];
    case '-45',        K = [-1 -1 2; -1 2 -1; 2 -1 -1];
    otherwise
        error('ImageLab:invalidParameter', 'Direction must be horizontal, vertical, +45 or -45.');
end
R = filter2D(toGray(I), K, 'replicate');
R(R < 0) = 0;
BW = R >= T * max(R(:)) & R > 0;
end
