function [BW, R] = pointDetection(I, T)
%POINTDETECTION Detect isolated points with the Laplacian-type mask
%       [-1 -1 -1
%        -1  8 -1
%        -1 -1 -1]
%   A point is detected where |R| >= T * max|R|  (T in 0..1).
%   The mask sums to zero, so flat regions give no response.

if nargin < 2 || isempty(T), T = 0.9; end
K = [-1 -1 -1; -1 8 -1; -1 -1 -1];
R = filter2D(toGray(I), K, 'replicate');
BW = abs(R) >= T * max(abs(R(:)));
end
