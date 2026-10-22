function [CMYK, CMY] = rgbToCmyk(I)
%RGBTOCMYK Subtractive colour models used in printing.
%   [CMYK, CMY] = rgbToCmyk(I), all channels in [0,1].
%
%   CMY: cyan, magenta and yellow pigments each ABSORB one primary:
%       C = 1 - R,   M = 1 - G,   Y = 1 - B
%   CMYK adds black (K), because equal C, M, Y inks give a muddy brown:
%       K = min(C, M, Y),   C' = (C - K) / (1 - K)   (same for M', Y')

I = toDouble(I);
CMY = 1 - I;
K = min(CMY, [], 3);
CMYK = cat(3, (CMY - K) ./ max(1 - K, eps), K);     % pure black: C' = M' = Y' = 0
end
