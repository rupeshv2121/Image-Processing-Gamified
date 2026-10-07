function [BW, T, iterations] = iterativeThreshold(I, tolerance)
%ITERATIVETHRESHOLD Basic global thresholding algorithm (Gonzalez & Woods).
%   1. Start with T = mean intensity.
%   2. Split pixels into G1 (> T) and G2 (<= T).
%   3. T_new = (mean(G1) + mean(G2)) / 2.
%   4. Repeat until T changes less than tolerance.

if nargin < 2 || isempty(tolerance), tolerance = 1e-4; end
G = toGray(I);
T = mean(G(:));
iterations = 0;
while true
    iterations = iterations + 1;
    above = G(G > T);
    below = G(G <= T);
    if isempty(above) || isempty(below), break; end
    Tnew = (mean(above) + mean(below)) / 2;
    done = abs(Tnew - T) < tolerance || iterations >= 100;
    T = Tnew;
    if done, break; end
end
BW = G > T;
end
