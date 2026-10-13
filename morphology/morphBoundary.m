function B = morphBoundary(BW, SE)
%MORPHBOUNDARY Boundary of a binary object:  β(A) = A − (A ⊖ B).
%   B = morphBoundary(BW, SE) keeps the object pixels that disappear when
%   the object is eroded by SE. A 3x3 square gives a boundary 1 pixel thick
%   (8-connected outline, like bwperim(BW, 4)); a larger SE gives a
%   thicker boundary.

if nargin < 2 || isempty(SE), SE = true(3); end
BW = logical(BW);
B = BW & ~erodeImage(BW, SE);
end
