function [mag, gx, gy] = sobelManual(I)
%SOBELMANUAL Sobel gradient computed manually with loops.
%
%       Kx = [-1 0 1        Ky = [-1 -2 -1
%             -2 0 2               0  0  0
%             -1 0 1]              1  2  1]
%
%   The 2 in the middle row/column gives extra weight to the centre, which
%   smooths noise slightly while differentiating.

Kx = [-1 0 1; -2 0 2; -1 0 1];
Ky = Kx';
[mag, gx, gy] = gradientOperatorManual(I, Kx, Ky);
end
