function [mag, gx, gy] = prewittManual(I)
%PREWITTMANUAL Prewitt gradient computed manually with loops.
%
%       Kx = [-1 0 1        Ky = [-1 -1 -1
%             -1 0 1               0  0  0
%             -1 0 1]              1  1  1]
%
%   Equal weights: simpler than Sobel, slightly more sensitive to noise.

Kx = [-1 0 1; -1 0 1; -1 0 1];
Ky = Kx';
[mag, gx, gy] = gradientOperatorManual(I, Kx, Ky);
end
