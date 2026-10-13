function [F, holes] = fillHoles(BW)
%FILLHOLES Fill the holes of a binary image (like imfill(BW, 'holes')).
%   [F, holes] = fillHoles(BW) returns the filled image F and the mask of the
%   pixels that were filled.
%
%   A HOLE is a background region that cannot be reached from the image
%   border. The textbook algorithm grows the background from the border by
%   repeated conditional dilation:
%
%       X0 = border pixels of A^c
%       Xk = (Xk-1 ⊕ B) ∩ A^c      (B = 4-connected cross)  until Xk = Xk-1
%       F  = (Xk)^c
%
%   The result of that iteration is exactly "every background pixel that is
%   4-connected to the border", so it is computed here in one pass with
%   connected-component labelling (much faster than hundreds of dilations).

BW = logical(BW);
background = ~BW;
L = labelComponents(background, 4);                 % 4-connected background regions
borderLabels = unique([L(1, :), L(end, :), L(:, 1)', L(:, end)']);
borderLabels(borderLabels == 0) = [];
reachable = ismember(L, borderLabels);              % = Xk at convergence
F = ~reachable;
holes = F & ~BW;
end
