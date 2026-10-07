function [mag, gx, gy] = robertsManual(I)
%ROBERTSMANUAL Roberts cross-gradient operator (2x2 diagonal differences).
%
%       Kx = [1  0        Ky = [ 0 1
%             0 -1]              -1 0]
%
%   gx(i,j) = f(i,j)   - f(i+1,j+1)
%   gy(i,j) = f(i,j+1) - f(i+1,j)
%   The smallest possible derivative operator: very sharp, very noise-sensitive.

G = toGray(I);
P = padImage(G, 1, 1, 'replicate');
P = P(2:end, 2:end);                        % pad only bottom/right
gx = P(1:end-1, 1:end-1) - P(2:end, 2:end);
gy = P(1:end-1, 2:end)   - P(2:end, 1:end-1);
mag = sqrt(gx.^2 + gy.^2);
end
