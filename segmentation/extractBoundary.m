function B = extractBoundary(BW)
%EXTRACTBOUNDARY Boundary pixels of a binary region:  B = A - (A eroded by 3x3).
%   A pixel is on the boundary if it is foreground and at least one of its
%   8 neighbours is background. Erosion = minimum filter on a binary image.

BW = logical(BW);
eroded = min(neighborhoodStack(double(BW), 3, 3, 'zero'), [], 3) > 0;
B = BW & ~eroded;
end
